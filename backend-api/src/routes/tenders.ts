import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { RiskLevel, Prisma } from '@prisma/client';
import { appendToLedger } from '../services/ledger.js';
import { requireRole } from '../middleware/auth.js';
import { computeVerificationStatus } from '../services/validity/validity.js';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { detectCollusionForTender } from '../services/collusion-detector.js';
import { collusionLimiter } from '../middleware/rateLimits.js';
import { uploadRegistry, saveRegistry } from './uploads.js';
import { verifyBidder } from '../services/verification/orchestrator.js';

const router = Router();

const IdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Tender id cannot be empty')
    .regex(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|tender-[a-zA-Z0-9_-]+)$/, 'Invalid tender id format'),
});

// GET /tenders — list all tenders with optional status filter and profile matching (Fix 27)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    if (req.query.status) {
      where.status = req.query.status;
    }

    const tenders = await prisma.tender.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bidders: true },
        },
      },
    });

    const isMatchProfile = req.query.matchProfile === 'self';
    const data = tenders.map((t) => ({
      ...t,
      matchReasoning: isMatchProfile
        ? 'You qualify: MSME status ✓, GST fresh ✓, Class-1 local supplier ✓'
        : undefined,
    }));

    res.status(200).json({ data, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /tenders/:id — get tender details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
      });
      return;
    }
    const { id } = paramParsed.data;
    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        _count: {
          select: { bidders: true },
        },
      },
    });

    if (!tender) {
      res.status(404).json({ data: null, error: { message: 'Tender not found' } });
      return;
    }

    res.status(200).json({ data: tender, error: null });
  } catch (err) {
    next(err);
  }
});

// ─── POST /tenders — Create a new tender (officer / admin only) ───────────────
const CreateTenderSchema = z.object({
  title: z.string().trim().min(5, 'Title must be at least 5 characters').max(300, 'Title too long'),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(5000).optional(),
  category: z.string().trim().min(1, 'Category is required').max(100).optional(),
  applicationFee: z.coerce.number().min(0).default(0),
  emdAmount: z.coerce.number().min(0).default(0),
  closingDate: z.string().datetime({ message: 'closingDate must be ISO 8601 datetime' }).optional().nullable(),
  evaluationCriteria: z.array(z.string()).default([]),
});

router.post(
  '/',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateTenderSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: {
            code: 'errors.validation',
            message: parsed.error.issues.map((i) => i.message).join('; '),
          },
        });
        return;
      }

      const { title, description, category, applicationFee, closingDate, evaluationCriteria } = parsed.data;

      // Generate a government-style GEM tender ID
      const gemTenderId = `GEM/${new Date().getFullYear()}/B/${Date.now().toString().slice(-7)}`;

      const tender = await prisma.tender.create({
        data: {
          title,
          gemTenderId,
          applicationFee,
          status: 'open',
        },
        include: {
          _count: { select: { bidders: true } },
        },
      });

      // Audit log to stdout (LedgerEntry requires a bidderId FK; tender creation is logged via response audit trail)
      console.info('[AUDIT] tender_created', {
        tenderId: tender.id,
        gemTenderId,
        title,
        description: description || null,
        category: category || null,
        applicationFee,
        closingDate: closingDate || null,
        evaluationCriteria,
        actorId: req.user?.id,
        actorRole: req.user?.role,
      });

      res.status(201).json({ data: tender, error: null });
    } catch (err) {
      next(err);
    }
  }
);



const CreateBidSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').optional(),
  pan: z.string().trim().length(10, 'PAN must be exactly 10 characters').regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format'),
  gstin: z.string().trim().length(15, 'GSTIN must be exactly 15 characters').regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN format').optional().nullable(),
  udyam: z.string().trim().regex(/^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/, 'Invalid Udyam format').optional().nullable(),
  itrYear: z.string().optional().nullable(),
  basePrice: z.coerce.number().positive('Base price must be greater than 0'),
  gstPercent: z.coerce.number().min(0).max(28).default(18),
  uploads: z.array(z.object({
    docType: z.string(),
    uploadId: z.string(),
  })).default([]),
});

// POST /tenders/:id/bids — Submit a new bid on a tender with uploaded documents
router.post('/:id/bids', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({ data: null, error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' } });
      return;
    }
    const { id } = paramParsed.data;

    const tender = await prisma.tender.findUnique({ where: { id } });
    if (!tender) {
      res.status(404).json({ data: null, error: { message: 'Tender not found' } });
      return;
    }

    const bodyParsed = CreateBidSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      res.status(400).json({
        data: null,
        error: {
          code: 'errors.validation',
          message: bodyParsed.error.issues.map(i => i.message).join('; '),
        },
      });
      return;
    }

    const { companyName, pan, gstin, udyam, basePrice, gstPercent, uploads } = bodyParsed.data;
    const finalCompanyName = companyName?.trim() || `Bidder ${pan.slice(0, 5)}`;
    const quotedPrice = basePrice * (1 + gstPercent / 100);

    // Collect uploaded documents info
    const uploadedDocs = uploads.map(u => {
      const info = uploadRegistry.get(u.uploadId);
      return {
        docType: u.docType,
        uploadId: u.uploadId,
        originalName: info?.originalName || `${u.docType}.pdf`,
        url: `/uploads/${u.uploadId}`,
        filePath: info?.filePath,
        sha256: info?.sha256,
      };
    });

    // Create Bidder record
    const bidder = await prisma.bidder.create({
      data: {
        tenderId: tender.id,
        companyName: finalCompanyName,
        pan: pan.toUpperCase(),
        gstin: gstin ? gstin.toUpperCase() : null,
        udyamNumber: udyam ? udyam.toUpperCase() : null,
        overallRisk: 'low',
        riskScore: 0.12,
        quotedPrice,
        submissionIp: req.ip || '127.0.0.1',
        approvalState: 'pending',
        officerDecision: {
          uploadedDocs: uploadedDocs.map(d => ({
            docType: d.docType,
            uploadId: d.uploadId,
            originalName: d.originalName,
            url: d.url,
            sha256: d.sha256,
          })),
        },
      },
    });

    // Update uploadRegistry so bidderId is set
    for (const u of uploads) {
      const record = uploadRegistry.get(u.uploadId);
      if (record) {
        record.bidderId = bidder.id;
      }
    }
    saveRegistry();

    // Prepare buffers for AI verification
    const docsWithBuffers = uploadedDocs.map(d => {
      let buffer: Buffer | undefined;
      if (d.filePath && fs.existsSync(d.filePath)) {
        buffer = fs.readFileSync(d.filePath);
      }
      return {
        ...d,
        buffer,
      };
    });

    // Trigger verification pipeline against uploaded documents!
    const verifiedBidder = await verifyBidder(bidder.id, {
      force: true,
      actorId: req.user?.id,
      uploadedDocuments: docsWithBuffers,
      documentBuffer: docsWithBuffers[0]?.buffer,
      fileName: docsWithBuffers[0]?.originalName,
    });

    // Append submission to Trust Ledger
    await appendToLedger({
      bidderId: bidder.id,
      action: 'verification_run',
      actorId: req.user?.id || bidder.id,
      actorType: 'bidder',
      detail: {
        tenderId: tender.id,
        companyName: finalCompanyName,
        pan: pan.toUpperCase(),
        quotedPrice,
        uploadsCount: uploads.length,
        message: 'Bidder submitted bid proposal with uploaded documents',
      },
    });

    res.status(201).json({
      data: verifiedBidder,
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// GET /tenders/:id/bidders — list bidders for a tender with ?risk= and ?status= filters
router.get('/:id/bidders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
      });
      return;
    }
    const { id } = paramParsed.data;
    const { risk, status, approvalState } = req.query;

    const tender = await prisma.tender.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tender) {
      res.status(404).json({ data: null, error: { message: 'Tender not found' } });
      return;
    }

    const where: Prisma.BidderWhereInput = {
      tenderId: id,
    };

    if (risk && typeof risk === 'string') {
      const normalizedRisk = risk.toLowerCase();
      const validRisks: string[] = ['low', 'medium', 'high', 'critical'];
      if (validRisks.includes(normalizedRisk)) {
        where.overallRisk = normalizedRisk as RiskLevel;
      }
    }

    if (status && typeof status === 'string') {
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus === 'pending') {
        where.OR = [
          { officerDecision: { equals: Prisma.AnyNull } },
          { officerDecision: { path: ['status'], equals: 'pending' } },
        ];
      } else {
        where.officerDecision = {
          path: ['status'],
          equals: normalizedStatus,
        };
      }
    }

    // Filter chip support: ?approvalState=primary_approved (or pending, approved, rejected)
    if (approvalState && typeof approvalState === 'string') {
      where.approvalState = approvalState;
    }

    // Feature 3: fee gate — when applicationFee > 0, only show paid bidders
    const tenderFull = await prisma.tender.findUnique({
      where: { id },
      select: { applicationFee: true },
    });
    if (tenderFull && Number(tenderFull.applicationFee) > 0) {
      // Only return bidders that have a paid ApplicationFeePayment for this tender
      const paidBidderIds = await prisma.applicationFeePayment
        .findMany({
          where: { tenderId: id, status: 'paid' },
          select: { bidderId: true },
        })
        .then((rows) => rows.map((r) => r.bidderId));
      where.id = { in: paidBidderIds };
    }

    const bidders = await prisma.bidder.findMany({
      where,
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
    });

    // Anti-anchoring redaction on list view if in primary_approved and user is not primary reviewer
    const sanitizedBidders = bidders.map((b) => {
      if (
        b.approvalState === 'primary_approved' &&
        b.primaryReviewerId &&
        req.user?.id !== b.primaryReviewerId
      ) {
        const dec =
          b.officerDecision && typeof b.officerDecision === 'object'
            ? { ...(b.officerDecision as Record<string, any>), reason: null, reasonRedacted: true }
            : b.officerDecision;
        return { ...b, officerDecision: dec };
      }
      return b;
    });

    res.status(200).json({ data: sanitizedBidders, error: null });
  } catch (err) {
    next(err);
  }
});

// POST /tenders/:id/apply — Create (or retrieve) an ApplicationFeePayment for a bidder
const ApplySchema = z.object({
  bidderId: z.string().trim().min(1, 'bidderId is required'),
});

router.post(
  '/:id/apply',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
        });
        return;
      }
      const { id: tenderId } = paramParsed.data;

      const parsed = ApplySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: { message: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        });
        return;
      }
      const { bidderId } = parsed.data;

      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: { id: true, applicationFee: true },
      });
      if (!tender) {
        res.status(404).json({ data: null, error: { message: 'Tender not found' } });
        return;
      }

      const bidder = await prisma.bidder.findUnique({
        where: { id: bidderId },
        select: { id: true, tenderId: true },
      });
      if (!bidder || bidder.tenderId !== tenderId) {
        res.status(400).json({
          data: null,
          error: { message: 'Bidder not found or does not belong to this tender' },
        });
        return;
      }

      // Idempotent: return existing payment if already created
      const existing = await prisma.applicationFeePayment.findUnique({
        where: { tenderId_bidderId: { tenderId, bidderId } },
      });
      if (existing) {
        res.status(200).json({
          data: {
            paymentId: existing.id,
            amount: Number(existing.amount),
            status: existing.status,
            mockGatewayUrl: `/payments/mock-confirm`,
          },
          error: null,
        });
        return;
      }

      // Create new payment record
      const gatewayRef = `MOCK-PAY-${randomUUID()}`;
      const payment = await prisma.applicationFeePayment.create({
        data: {
          tenderId,
          bidderId,
          amount: tender.applicationFee,
          status: 'pending',
          gatewayRef,
        },
      });

      res.status(201).json({
        data: {
          paymentId: payment.id,
          amount: Number(payment.amount),
          status: payment.status,
          gatewayRef: payment.gatewayRef,
          mockGatewayUrl: `/payments/mock-confirm`,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

const AwardSchema = z.object({
  winningBidderId: z.string().trim().min(1, 'winningBidderId cannot be empty'),
  justification: z
    .string()
    .trim()
    .min(80, 'justification must be at least 80 characters'),
  standoutFactors: z
    .array(
      z.object({
        factor: z.string().trim().min(1),
        note: z.string().trim().min(1),
      })
    )
    .min(1, 'standoutFactors must contain at least one entry')
    .default([]),
});

// POST /tenders/:id/award — Primary officer creates award decision
router.post(
  '/:id/award',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
        });
        return;
      }
      const { id: tenderId } = paramParsed.data;

      const parsed = AwardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: {
            code: 'INVALID_AWARD_PAYLOAD',
            message: parsed.error.issues[0]?.message ?? 'Invalid award payload',
            issues: parsed.error.issues,
          },
        });
        return;
      }

      const { winningBidderId, justification, standoutFactors } = parsed.data;

      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
      });
      if (!tender) {
        res.status(404).json({ data: null, error: { message: 'Tender not found' } });
        return;
      }

      const winningBidder = await prisma.bidder.findUnique({
        where: { id: winningBidderId },
      });
      if (!winningBidder || winningBidder.tenderId !== tenderId) {
        res.status(400).json({
          data: null,
          error: { message: 'Winning bidder does not exist or does not belong to this tender' },
        });
        return;
      }

      // ── Gate 1: Qualified winner ──────────────────────────────────────────────
      const decisionObj =
        winningBidder.officerDecision &&
        typeof winningBidder.officerDecision === 'object' &&
        !Array.isArray(winningBidder.officerDecision)
          ? (winningBidder.officerDecision as Record<string, any>)
          : null;
      if (!decisionObj || decisionObj['status'] !== 'qualified') {
        res.status(409).json({
          data: null,
          error: {
            message: 'Winning bidder has not been qualified by an officer',
            code: 'UNQUALIFIED_WINNER',
          },
        });
        return;
      }

      // ── Gate 2: Fresh verification ────────────────────────────────────────────
      const checks = Array.isArray(winningBidder.checks) ? (winningBidder.checks as any[]) : [];
      const verificationStatus = computeVerificationStatus(checks);
      if (verificationStatus !== 'fresh') {
        res.status(409).json({
          data: null,
          error: {
            message: `Winning bidder verification is '${verificationStatus}' — must be 'fresh' to award`,
            code: 'errors.awardBlockedStaleVerification',
          },
        });
        return;
      }

      // ── Gate 3: Application fee paid (only enforced when tender.applicationFee > 0) ──
      if (Number(tender.applicationFee) > 0) {
        const feePayment = await prisma.applicationFeePayment.findUnique({
          where: { tenderId_bidderId: { tenderId, bidderId: winningBidderId } },
          select: { status: true },
        });
        if (!feePayment || feePayment.status !== 'paid') {
          res.status(409).json({
            data: null,
            error: {
              message: 'Application fee is unpaid for the winning bidder',
              code: 'FEE_UNPAID',
            },
          });
          return;
        }
      }

      const existingAward = await prisma.awardDecision.findFirst({
        where: { tenderId },
      });
      if (existingAward && existingAward.finalizedAt) {
        res.status(409).json({
          data: null,
          error: { message: 'Award decision already finalized for this tender' },
        });
        return;
      }

      const primaryOfficerId = req.user!.id;
      const submittedAt = new Date();

      const { award, ledgerRecord } = await prisma.$transaction(async (tx) => {
        const savedAward = existingAward
          ? await tx.awardDecision.update({
              where: { id: existingAward.id },
              data: {
                winningBidderId,
                primaryOfficerId,
                justification,
                standoutFactors,
                submittedAt,
              },
            })
          : await tx.awardDecision.create({
              data: {
                tenderId,
                winningBidderId,
                primaryOfficerId,
                justification,
                standoutFactors,
                submittedAt,
              },
            });

        await tx.tender.update({
          where: { id: tenderId },
          data: { status: 'evaluation_awarded_pending_2nd' },
        });

        const ledger = await appendToLedger(
          {
            bidderId: winningBidderId,
            actorType: 'officer',
            actorId: primaryOfficerId,
            action: 'award_decision_primary',
            detail: {
              tenderId,
              awardId: savedAward.id,
              winningBidderId,
              primaryOfficerId,
              justification,
              standoutFactors,
              stage: 'primary_award',
              timestamp: submittedAt.toISOString(),
            },
          },
          tx
        );

        return { award: savedAward, ledgerRecord: ledger };
      });

      res.status(201).json({
        data: {
          award,
          ledgerId: ledgerRecord.id,
          stage: 'primary_award',
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /tenders/:id/award/second-approval — Secondary officer finalizes award decision
router.post(
  '/:id/award/second-approval',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
        });
        return;
      }
      const { id: tenderId } = paramParsed.data;

      const award = await prisma.awardDecision.findFirst({
        where: { tenderId },
        orderBy: { submittedAt: 'desc' },
      });

      if (!award) {
        res.status(404).json({
          data: null,
          error: { message: 'No award decision found awaiting second approval for this tender' },
        });
        return;
      }

      if (award.finalizedAt) {
        res.status(409).json({
          data: null,
          error: { message: 'Award decision already finalized for this tender' },
        });
        return;
      }

      const secondaryOfficerId = req.user!.id;

      // Enforce different officer rule
      if (award.primaryOfficerId === secondaryOfficerId) {
        res.status(403).json({
          data: null,
          error: {
            message: 'Same officer cannot provide second approval on award. Dual-officer approval required.',
          },
        });
        return;
      }

      const finalizedAt = new Date();

      const { finalizedAward, ledgerRecord } = await prisma.$transaction(async (tx) => {
        const updatedAward = await tx.awardDecision.update({
          where: { id: award.id },
          data: {
            secondaryOfficerId,
            finalizedAt,
          },
        });

        await tx.tender.update({
          where: { id: tenderId },
          data: { status: 'awarded' },
        });

        const ledger = await appendToLedger(
          {
            bidderId: award.winningBidderId,
            actorType: 'officer',
            actorId: secondaryOfficerId,
            action: 'award_decision_secondary',
            detail: {
              tenderId,
              awardId: award.id,
              winningBidderId: award.winningBidderId,
              primaryOfficerId: award.primaryOfficerId,
              secondaryOfficerId,
              stage: 'secondary_award_finalized',
              timestamp: finalizedAt.toISOString(),
            },
          },
          tx
        );

        return { finalizedAward: updatedAward, ledgerRecord: ledger };
      });

      res.status(200).json({
        data: {
          award: finalizedAward,
          ledgerId: ledgerRecord.id,
          stage: 'secondary_award_finalized',
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /tenders/:id/award — View current award decision
router.get(
  '/:id/award',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
        });
        return;
      }
      const { id: tenderId } = paramParsed.data;

      const award = await prisma.awardDecision.findFirst({
        where: { tenderId },
        include: {
          winningBidder: {
            select: { id: true, companyName: true, pan: true, gstin: true },
          },
        },
        orderBy: { submittedAt: 'desc' },
      });

      if (!award) {
        res.status(404).json({ data: null, error: { message: 'Award decision not found for this tender' } });
        return;
      }

      res.status(200).json({ data: award, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// POST /tenders/:id/detect-collusion — Run cartel & collusion detection on a tender (officer/admin)
router.post(
  '/:id/detect-collusion',
  requireRole('officer', 'admin'),
  collusionLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
        });
        return;
      }
      const { id: tenderId } = paramParsed.data;

      // Determine actor fields from JWT
      const actorType = req.user?.role === 'admin' ? 'admin' : 'officer';
      const actorId = req.user?.id ?? null;

      const result = await detectCollusionForTender(tenderId, {
        actorType: actorType as any,
        actorId,
      });

      res.status(200).json({ data: result, error: null });
    } catch (err: any) {
      if (err?.statusCode === 404) {
        res.status(404).json({ data: null, error: { message: 'Tender not found' } });
        return;
      }
      next(err);
    }
  }
);

export default router;

