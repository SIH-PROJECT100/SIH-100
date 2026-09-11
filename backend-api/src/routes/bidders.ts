import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { verifyBidder } from '../services/orchestrator.js';
import { appendToLedger } from '../services/ledger.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// ─── Param validation ────────────────────────────────────────────────────────
const IdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Bidder id cannot be empty')
    .regex(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|bidder-[a-zA-Z0-9_-]+)$/, 'Invalid bidder id format'),
});

// ─── PII masking helpers — arch doc §8: "ABCDE****F"-style ──────────────────
/**
 * PAN is exactly 10 chars (AAAAA9999A).
 * Mask: first 5 + "****" + last 1  →  ABCDE****F
 */
function maskPan(pan: string | null | undefined): string | null {
  if (!pan) return null;
  if (pan.length <= 5) return '****';
  return pan.slice(0, 5) + '****' + pan.slice(-1);
}

/**
 * GSTIN is exactly 15 chars (07AAAAA9999A1Z5).
 * Mask: first 5 + "****" + last 1  →  07AAA****5
 * (same arch-doc style, preserves state code prefix)
 */
function maskGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  if (gstin.length <= 5) return '****';
  return gstin.slice(0, 5) + '****' + gstin.slice(-1);
}

// GET /bidders/:id — Bidder detail with PAN/GSTIN masked per arch doc §8
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid bidder id' },
      });
      return;
    }

    const { id } = paramParsed.data;
    const bidder = await prisma.bidder.findUnique({
      where: { id },
      include: {
        tender: {
          select: { id: true, title: true, gemTenderId: true, status: true },
        },
      },
    });

    if (!bidder) {
      res.status(404).json({ data: null, error: { message: 'Bidder not found' } });
      return;
    }

    // Mask PII before returning to caller — arch doc §8
    const masked = {
      ...bidder,
      pan: maskPan(bidder.pan),
      gstin: maskGstin(bidder.gstin),
    };

    res.status(200).json({ data: masked, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /bidders/:id/pii — Officer or admin only.
// Returns unmasked PAN/GSTIN inside a prisma.$transaction that simultaneously
// appends a pii_reveal ledger entry. If the ledger write fails, the response
// is never sent — no PII without an audit trail.
router.get(
  '/:id/pii',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = IdParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid bidder id' },
        });
        return;
      }

      const { id } = paramParsed.data;
      const actorId = req.user!.id;
      const actorType = (req.user!.role === 'admin' ? 'admin' : 'officer') as 'officer' | 'admin';

      // Atomic: fetch PII + write ledger — reveal fails cleanly if ledger write fails
      const result = await prisma.$transaction(async (tx) => {
        const bidder = await tx.bidder.findUnique({
          where: { id },
          select: { id: true, companyName: true, pan: true, gstin: true, udyamNumber: true },
        });

        if (!bidder) return null;

        const auditRecord = await appendToLedger(
          {
            bidderId: id,
            actorType,
            actorId,
            action: 'pii_reveal',
            detail: {
              fields: ['pan', 'gstin'],
              officer_id: actorId,
              bidderId: id,
              timestamp: new Date().toISOString(),
            },
          },
          tx
        );

        return { bidder, auditRecord };
      });

      if (!result) {
        res.status(404).json({ data: null, error: { message: 'Bidder not found' } });
        return;
      }

      res.status(200).json({
        data: {
          id: result.bidder.id,
          companyName: result.bidder.companyName,
          pan: result.bidder.pan,
          gstin: result.bidder.gstin,
          udyamNumber: result.bidder.udyamNumber,
          _auditId: result.auditRecord.id,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /bidders/:id/verify — trigger verification pipeline
router.post('/:id/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid bidder id' },
      });
      return;
    }

    const { id } = paramParsed.data;
    const force = req.query.force === 'true' || req.body?.force === true;
    const verifiedBidder = await verifyBidder(id, {
      force,
      actorId: req.user?.id,
    });

    res.status(200).json({ data: verifiedBidder, error: null });
  } catch (err: any) {
    if (err.statusCode === 404 || err.message === 'Bidder not found') {
      res.status(404).json({ data: null, error: { message: 'Bidder not found' } });
      return;
    }
    next(err);
  }
});

export default router;
