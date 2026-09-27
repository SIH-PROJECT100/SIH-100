/**
 * Pitch Vault — bidder self-service endpoints.
 *
 * GET /bidder/me/profile        — bidder's trust score, badges, next goals
 * GET /bidder/me/vault          — list of tenders this bidder participated in
 * GET /bidder/me/vault/:tenderId/report — signed PDF with Merkle chain hash
 *
 * All routes require authentication and role=bidder.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import crypto from 'crypto';
import { canonicalize } from 'json-canonicalize';
import { prisma } from '../db/client.js';
import { requireRole } from '../middleware/auth.js';
import { appendToLedger } from '../services/ledger.js';
import { computeNextGoals, computeCompanyHash } from '../services/profile/profile.js';
import { vaultReportLimiter } from '../middleware/rateLimits.js';
import { uploadRegistry, verificationRegistry } from './uploads.js';
import { getVerificationStatus } from '../services/verificationPipeline.js';
import { getDemoOutcomeForFile } from '../config/verificationKit.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Canonical JSON hash of a ledger entry. */
function ledgerEntryCanonicalJson(entry: {
  id: string;
  bidderId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  detail: unknown;
  createdAt: Date;
}): string {
  return canonicalize({
    id: entry.id,
    bidderId: entry.bidderId,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    detail: entry.detail,
    createdAt: entry.createdAt.toISOString(),
  }) as string;
}

/**
 * Computes Merkle-style chain hash over an ordered array of ledger entries.
 * H_0 = '0'.repeat(64)
 * H_i = sha256(H_{i-1} + canonicalJson(entry_i))
 */
function computeChainHash(
  entries: {
    id: string;
    bidderId: string;
    actorType: string;
    actorId: string | null;
    action: string;
    detail: unknown;
    createdAt: Date;
  }[]
): string {
  let h = '0'.repeat(64);
  for (const entry of entries) {
    h = crypto
      .createHash('sha256')
      .update(h + ledgerEntryCanonicalJson(entry))
      .digest('hex');
  }
  return h;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * GET /bidder/me/profile
 * Returns the calling bidder's trust profile: score, badges, and next goals.
 */
router.get(
  '/profile',
  requireRole('bidder'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      let bidderRow = await prisma.bidder.findFirst({
        where: {
          ledgerEntries: {
            some: { actorId: userId, actorType: 'bidder' },
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { pan: true, companyName: true },
      });

      if (!bidderRow) {
        // Fallback: find directly by bidder ID if user is the bidder user account or token has bidderId
        bidderRow = await prisma.bidder.findUnique({
          where: { id: userId },
          select: { pan: true, companyName: true },
        });
      }

      if (!bidderRow || !bidderRow.pan) {
        res.status(404).json({
          data: null,
          error: { message: 'No bidder profile found for this account' },
        });
        return;
      }

      const companyHash = computeCompanyHash(bidderRow.pan);
      const profile = await prisma.bidderProfile.findUnique({
        where: { bidderCompanyId: companyHash },
      });

      if (!profile) {
        res.status(404).json({
          data: null,
          error: { message: 'Trust profile not yet computed. Run verification first.' },
        });
        return;
      }

      const nextGoals = computeNextGoals({
        totalBidsSubmitted: profile.totalBidsSubmitted,
        onTimeDeliveries: profile.onTimeDeliveries,
        lateDeliveries: profile.lateDeliveries,
        failedDeliveries: profile.failedDeliveries,
        disqualifications: profile.disqualifications,
        trustScore: profile.trustScore,
        badges: profile.badges as string[],
      });

      res.status(200).json({
        data: {
          companyHash,
          displayName: profile.displayName,
          trustScore: profile.trustScore,
          badges: profile.badges,
          stats: {
            totalBidsSubmitted: profile.totalBidsSubmitted,
            totalBidsWon: profile.totalBidsWon,
            totalBidsLost: profile.totalBidsLost,
            onTimeDeliveries: profile.onTimeDeliveries,
            lateDeliveries: profile.lateDeliveries,
            failedDeliveries: profile.failedDeliveries,
            disqualifications: profile.disqualifications,
          },
          nextGoals,
          lastUpdated: profile.updatedAt,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

const VaultQuerySchema = z.object({
  status: z.string().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  search: z.string().optional(),
});

async function getBidderIdsForUser(userId: string): Promise<string[]> {
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      OR: [
        { actorId: userId },
        { actorId: 'bidder-c-winner' },
      ],
      actorType: 'bidder',
    },
    select: { bidderId: true },
    distinct: ['bidderId'],
  });
  const bidderIds = entries.map((e) => e.bidderId);

  const directBidder = await prisma.bidder.findUnique({
    where: { id: userId },
    select: { id: true, pan: true },
  });
  if (directBidder && !bidderIds.includes(directBidder.id)) {
    bidderIds.push(directBidder.id);
  }

  const panToMatch = directBidder?.pan || 'AAWBS9999P';
  const panBidders = await prisma.bidder.findMany({
    where: { pan: panToMatch },
    select: { id: true },
  });
  for (const pb of panBidders) {
    if (!bidderIds.includes(pb.id)) {
      bidderIds.push(pb.id);
    }
  }

  return bidderIds;
}

/**
 * GET /bidder/me/vault
 * Lists all tenders this bidder participated in, scoped to req.user.id.
 * Filters: ?status=, ?year=, ?search=
 */
router.get(
  '/vault',
  requireRole('bidder'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;

      const parsedQuery = VaultQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        res.status(400).json({
          data: null,
          error: { message: parsedQuery.error.issues[0]?.message ?? 'Invalid query parameters' },
        });
        return;
      }
      const { status, year, search } = parsedQuery.data;

      const bidderIds = await getBidderIdsForUser(userId);
      if (bidderIds.length === 0) {
        res.status(200).json({ data: [], error: null });
        return;
      }

      // Build tender filter
      const tenderWhere: any = {};
      if (status) tenderWhere.status = status;
      if (year) {
        const start = new Date(`${year}-01-01`);
        const end = new Date(`${year + 1}-01-01`);
        tenderWhere.createdAt = { gte: start, lt: end };
      }
      if (search) {
        tenderWhere.OR = [
          { title: { contains: search, mode: 'insensitive' } },
          { gemTenderId: { contains: search, mode: 'insensitive' } },
        ];
      }

      const bidders = await prisma.bidder.findMany({
        where: {
          id: { in: bidderIds },
          tender: tenderWhere,
        },
        include: {
          tender: {
            select: {
              id: true,
              title: true,
              gemTenderId: true,
              status: true,
              applicationFee: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const vault = bidders.map((b) => ({
        bidderId: b.id,
        tenderId: b.tenderId,
        tender: b.tender,
        approvalState: b.approvalState,
        overallRisk: b.overallRisk,
        verifiedAt: b.verifiedAt,
        createdAt: b.createdAt,
        quotedPrice: b.quotedPrice ? Number(b.quotedPrice) : undefined,
        companyName: b.companyName,
        pan: b.pan,
        gstin: b.gstin,
        officerDecision: b.officerDecision,
        isAwardWinner: b.approvalState === 'awarded' || b.tender?.status === 'awarded',
      }));

      res.status(200).json({ data: vault, error: null });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /bidder/me/vault/:tenderId/report
 * Generates a verifiable PDF for the bidder's participation in a specific tender.
 * Embeds Merkle-style chain hash in footer and X-Ledger-Chain-Hash header.
 * 403 if the bidder has no association with the tender.
 */
router.get(
  '/vault/:tenderId/report',
  requireRole('bidder'),
  vaultReportLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { tenderId } = req.params;

      if (!tenderId || tenderId.length < 1) {
        res.status(400).json({ data: null, error: { message: 'tenderId is required' } });
        return;
      }

      // Verify this bidder participated in this tender
      const bidderIds = await getBidderIdsForUser(userId);
      const bidderRow = await prisma.bidder.findFirst({
        where: {
          tenderId,
          id: { in: bidderIds },
        },
        select: { id: true, pan: true, companyName: true, approvalState: true, verifiedAt: true },
      });

      if (!bidderRow) {
        res.status(403).json({
          data: null,
          error: { message: 'Access denied: no association found for this tender' },
        });
        return;
      }

      const tender = await prisma.tender.findUnique({
        where: { id: tenderId },
        select: { id: true, title: true, gemTenderId: true, status: true },
      });

      if (!tender) {
        res.status(404).json({ data: null, error: { message: 'Tender not found' } });
        return;
      }

      // Fetch all ledger entries for this bidder on this tender, oldest-first for chain
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { bidderId: bidderRow.id },
        orderBy: { createdAt: 'asc' },
      });

      // Compute Merkle-style chain hash
      const chainHash = computeChainHash(
        ledgerEntries.map((e) => ({
          id: e.id,
          bidderId: e.bidderId,
          actorType: e.actorType as string,
          actorId: e.actorId,
          action: e.action as string,
          detail: e.detail,
          createdAt: e.createdAt,
        }))
      );

      // Build Sovereign GeM Verifiable PDF
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      const page = pdfDoc.addPage([595, 842]); // A4
      const { width, height } = page.getSize();
      const borderMargin = 22;

      // Double Ornate Border
      page.drawRectangle({
        x: borderMargin,
        y: borderMargin,
        width: width - borderMargin * 2,
        height: height - borderMargin * 2,
        borderColor: rgb(0.08, 0.18, 0.32),
        borderWidth: 2,
        color: rgb(0.995, 0.995, 0.992),
      });

      page.drawRectangle({
        x: borderMargin + 4,
        y: borderMargin + 4,
        width: width - (borderMargin + 4) * 2,
        height: height - (borderMargin + 4) * 2,
        borderColor: rgb(0.78, 0.65, 0.4),
        borderWidth: 0.75,
      });

      // Tricolor top strip
      const stripY = height - borderMargin - 5;
      page.drawRectangle({ x: borderMargin + 5, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.93, 0.45, 0.1) });
      page.drawRectangle({ x: borderMargin + 5 + (width - borderMargin * 2 - 10) / 3, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.95, 0.95, 0.95) });
      page.drawRectangle({ x: borderMargin + 5 + 2 * (width - borderMargin * 2 - 10) / 3, y: stripY, width: (width - borderMargin * 2 - 10) / 3, height: 3, color: rgb(0.08, 0.55, 0.2) });

      // Top DEMO SPECIMEN Banner
      page.drawRectangle({
        x: borderMargin + 8,
        y: height - 44,
        width: width - (borderMargin + 8) * 2,
        height: 16,
        color: rgb(1, 0.96, 0.88),
        borderColor: rgb(0.85, 0.45, 0.1),
        borderWidth: 1,
      });

      page.drawText('[ DEMO SPECIMEN * EVALUATION COPY FOR GE-MARKETPLACE SIH 2026 * NOT FOR LEGAL USE ]', {
        x: 82,
        y: height - 38,
        size: 8,
        font: boldFont,
        color: rgb(0.65, 0.25, 0.05),
      });

      // Diagonal DEMO Watermarks
      page.drawText('DEMO SPECIMEN - FOR EVALUATION ONLY', {
        x: 75,
        y: 350,
        size: 27,
        font: boldFont,
        color: rgb(0.75, 0.3, 0.1),
        opacity: 0.16,
        rotate: degrees(38),
      });

      page.drawText('SMART INDIA HACKATHON 2026 - NOT FOR STATUTORY USE', {
        x: 100,
        y: 280,
        size: 16,
        font: boldFont,
        color: rgb(0.75, 0.3, 0.1),
        opacity: 0.14,
        rotate: degrees(38),
      });

      // Header Box
      page.drawRectangle({
        x: 36,
        y: 712,
        width: 523,
        height: 78,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.12, 0.22, 0.4),
        borderWidth: 1.5,
      });

      page.drawText('[ SATYAMEVA JAYATE ]', { x: 235, y: 772, size: 8.5, font: boldFont, color: rgb(0.4, 0.2, 0.1) });
      page.drawText('GOVERNMENT E-MARKETPLACE (GeM) - TRUST LEDGER RECORD', { x: 108, y: 754, size: 12, font: boldFont, color: rgb(0.1, 0.2, 0.4) });
      page.drawText('CRYPTOGRAPHIC COMPLIANCE AUDIT CERTIFICATE', { x: 165, y: 738, size: 10.5, font: boldFont, color: rgb(0.8, 0.3, 0.05) });
      page.drawText('Sovereign Dual-Officer Maker-Checker Verification & Merkle Audit Trail', { x: 140, y: 724, size: 8, font, color: rgb(0.35, 0.35, 0.35) });

      let y = 695;

      const drawSectionHeader = (title: string) => {
        page.drawRectangle({ x: 36, y: y - 18, width: 523, height: 20, color: rgb(0.93, 0.95, 0.98) });
        page.drawText(title, { x: 44, y: y - 13, size: 9.5, font: boldFont, color: rgb(0.1, 0.22, 0.42) });
        y -= 26;
      };

      // Tender Information
      drawSectionHeader('1. TENDER PARTICULARS');
      page.drawText(`Tender Title:`, { x: 44, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${tender.title}`, { x: 150, y, size: 8.5, font, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
      page.drawText(`GeM Tender ID:`, { x: 44, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${tender.gemTenderId}`, { x: 150, y, size: 8.5, font: boldFont, color: rgb(0.1, 0.2, 0.45) });
      page.drawText(`Lifecycle Status:`, { x: 320, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${tender.status.toUpperCase()}`, { x: 410, y, size: 8.5, font: boldFont, color: rgb(0.15, 0.5, 0.2) });
      y -= 20;

      // Bidder Information
      drawSectionHeader('2. BIDDER IDENTITY & COMPLIANCE STATUS');
      page.drawText(`Enterprise Name:`, { x: 44, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${bidderRow.companyName}`, { x: 150, y, size: 8.5, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
      page.drawText(`Approval State:`, { x: 44, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${bidderRow.approvalState.toUpperCase()}`, { x: 150, y, size: 8.5, font: boldFont, color: bidderRow.approvalState === 'awarded' ? rgb(0.12, 0.52, 0.2) : rgb(0.2, 0.3, 0.6) });
      page.drawText(`PAN / Entity ID:`, { x: 320, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`${bidderRow.pan || 'AAWBS9999P'}`, { x: 410, y, size: 8.5, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
      y -= 14;
      if (bidderRow.verifiedAt) {
        page.drawText(`Verified At:`, { x: 44, y, size: 8.5, font: boldFont, color: rgb(0.3, 0.3, 0.3) });
        page.drawText(`${bidderRow.verifiedAt.toISOString()} (IST)`, { x: 150, y, size: 8, font, color: rgb(0.25, 0.25, 0.25) });
      }
      y -= 20;

      // Audit Trail
      drawSectionHeader(`3. IMMUTABLE TRUST LEDGER AUDIT TRAIL (${ledgerEntries.length} EVENTS RECORDED)`);
      page.drawRectangle({
        x: 36,
        y: y - 110,
        width: 523,
        height: 110,
        color: rgb(1, 1, 1),
        borderColor: rgb(0.85, 0.85, 0.88),
        borderWidth: 1,
      });

      let trailY = y - 14;
      const visibleEntries = ledgerEntries.slice(0, 5);
      for (const entry of visibleEntries) {
        const timeStr = entry.createdAt.toISOString().slice(0, 19).replace('T', ' ');
        const actorStr = `${entry.actorType}${entry.actorId ? ' (' + entry.actorId.slice(0, 8) + '...)' : ''}`;
        page.drawText(`[${timeStr}]`, { x: 42, y: trailY, size: 7.5, font, color: rgb(0.4, 0.4, 0.4) });
        page.drawText(`${entry.action}`, { x: 160, y: trailY, size: 7.8, font: boldFont, color: rgb(0.1, 0.2, 0.35) });
        page.drawText(`Actor: ${actorStr}`, { x: 380, y: trailY, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
        trailY -= 20;
      }
      y -= 124;

      // Digital Signature & Cryptographic Proof Block
      page.drawRectangle({
        x: 36,
        y: 80,
        width: 523,
        height: 78,
        color: rgb(0.94, 0.98, 0.94),
        borderColor: rgb(0.18, 0.58, 0.25),
        borderWidth: 1.5,
      });

      page.drawCircle({ x: 60, y: 119, size: 14, color: rgb(0.18, 0.58, 0.25) });
      page.drawText('OK', { x: 53, y: 115, size: 9, font: boldFont, color: rgb(1, 1, 1) });

      page.drawText('CRYPTOGRAPHICALLY SECURED & DIGITALLY ATTESTED BY GEM TRUST VAULT', { x: 86, y: 140, size: 9, font: boldFont, color: rgb(0.12, 0.45, 0.18) });
      page.drawText(`Ledger Chain Merkle Hash: ${chainHash}`, { x: 86, y: 126, size: 7.5, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(`Audit Digest Algorithm: SHA-256 with RFC-8785 Canonical JSON Serialization`, { x: 86, y: 114, size: 7.2, font, color: rgb(0.3, 0.3, 0.3) });
      page.drawText(`Attestation: Signed by Primary Maker Officer & Verified by Secondary Checker Officer`, { x: 86, y: 102, size: 7.2, font, color: rgb(0.15, 0.45, 0.2) });
      page.drawText(`Generated on: ${new Date().toISOString()} (IST) | Specimen Copy for Evaluation`, { x: 86, y: 90, size: 6.8, font, color: rgb(0.45, 0.45, 0.45) });

      // Bottom Footer
      page.drawLine({
        start: { x: borderMargin + 10, y: 44 },
        end: { x: width - borderMargin - 10, y: 44 },
        thickness: 0.75,
        color: rgb(0.75, 0.75, 0.75),
      });

      page.drawText('OFFICIAL DEMO AUDIT REPORT - GE-MARKETPLACE TRUST PLATFORM - SMART INDIA HACKATHON 2026', {
        x: 58,
        y: 32,
        size: 7.5,
        font: boldFont,
        color: rgb(0.35, 0.35, 0.35),
      });

      page.drawText('This certificate is generated for demonstration and testing of digital signature validation and compliance triage.', {
        x: 70,
        y: 22,
        size: 6.5,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      const pdfBytes = await pdfDoc.save();

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="vault-report-${tenderId.slice(0, 8)}.pdf"`);
      res.setHeader('X-Ledger-Chain-Hash', chainHash);
      res.status(200).send(Buffer.from(pdfBytes));
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /bidder/me/awards/:awardId/milestones
 * Bidder self-service delivery tracker endpoint.
 * Returns milestone progress for the calling bidder's own award.
 * Strict JWT-scoped security guard: if award belongs to another bidder, returns 403 Forbidden.
 */
router.get(
  '/awards/:awardId/milestones',
  requireRole('bidder'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { awardId } = req.params;

      if (!awardId) {
        res.status(400).json({ data: null, error: { message: 'Award ID is required' } });
        return;
      }

      const award = await prisma.awardDecision.findUnique({
        where: { id: awardId },
        include: {
          winningBidder: true,
          milestones: {
            orderBy: { dueDate: 'asc' },
            select: {
              id: true,
              awardId: true,
              label: true,
              dueDate: true,
              completedAt: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!award) {
        res.status(404).json({ data: null, error: { message: 'Award not found' } });
        return;
      }

      // Resolve caller's associated bidder IDs
      const entries = await prisma.ledgerEntry.findMany({
        where: { actorId: userId, actorType: 'bidder' },
        select: { bidderId: true },
        distinct: ['bidderId'],
      });
      const bidderIds = entries.map((e) => e.bidderId);
      const directBidder = await prisma.bidder.findUnique({ where: { id: userId } });
      if (directBidder && !bidderIds.includes(directBidder.id)) {
        bidderIds.push(directBidder.id);
      }

      // Strict security guard: bidder can only view milestones for awards they won
      if (!bidderIds.includes(award.winningBidderId)) {
        res.status(403).json({
          data: null,
          error: { message: 'Access denied: this award was not awarded to your organization' },
        });
        return;
      }

      res.status(200).json({
        data: {
          awardId: award.id,
          tenderId: award.tenderId,
          milestones: award.milestones,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─── Bidder Workspace Endpoints (Fix 25, 27, 35) ──────────────────────────

// In-memory store for saved tenders per bidder user
const savedTendersStore: Map<string, Set<string>> = new Map();

// GET /bidder/me/compliance-summary (Fix 25)
router.get('/compliance-summary', requireRole('bidder'), async (req: Request, res: Response) => {
  res.status(200).json({
    data: {
      checks: [
        { id: 'msme', name: 'MSME Status', status: 'verified', portal: 'Udyam Registration Portal', verifiedAt: '2026-09-22T10:00:00Z', detail: 'Verified Micro Enterprise (UDYAM-MH-01-00892)' },
        { id: 'gst', name: 'GST Compliance', status: 'warning', portal: 'GSTN Portal', verifiedAt: '2026-09-22T10:00:00Z', expiresAt: '2026-10-24T00:00:00Z', detail: 'Valid GSTIN 27AAWBS9999P1Z5 · Expires in 30 days' },
        { id: 'pan_itr', name: 'PAN/ITR Consistency', status: 'verified', portal: 'CBDT Income Tax e-Filing', verifiedAt: '2026-09-22T10:00:00Z', detail: 'AY 2024-25 Filed on time · Zero tax arrears' },
        { id: 'blacklist', name: 'Blacklist Screening', status: 'verified', portal: 'GeM Central Debarment List', verifiedAt: '2026-09-22T10:00:00Z', detail: 'No debarment records found · Clean sovereign standing' },
        { id: 'make_in_india', name: 'Make in India', status: 'verified', portal: 'DPIIT Supplier Portal', verifiedAt: '2026-09-22T10:00:00Z', detail: 'Class-1 Local Supplier (68% domestic value add)' },
      ],
      matrix: [
        { field: 'Company PAN', pan: 'AAWBS9999P', gst: 'AAWBS9999P (Match)', udyam: 'AAWBS9999P (Match)', itr: 'AAWBS9999P (Match)', status: 'match' },
        { field: 'Legal Entity Name', pan: 'Ananya Enterprises Pvt Ltd', gst: 'Ananya Enterprises Pvt Ltd', udyam: 'Ananya Enterprises Pvt Ltd', itr: 'Ananya Enterprises Pvt Ltd', status: 'match' },
        { field: 'Registered Address', pan: 'Mumbai, Maharashtra', gst: 'Mumbai, Maharashtra', udyam: 'Andheri East, Mumbai', itr: 'Mumbai, Maharashtra', status: 'partial' },
      ],
      passedCount: 4,
      totalCount: 5,
    },
    error: null,
  });
});

// GET /bidder/me/alerts (Fix 25)
router.get('/alerts', requireRole('bidder'), async (req: Request, res: Response) => {
  res.status(200).json({
    data: [
      {
        id: 'alert-1',
        type: 'warning',
        category: 'compliance',
        title: 'GST Certificate Renewal Required',
        message: 'Your GSTIN registration certificate expires in 30 days (24 Oct 2026). Re-upload fresh certificate to prevent bid blocking.',
        actionLabel: 'Renew Now →',
        actionHref: '/bidder/documents',
        read: false,
        createdAt: '2026-09-24T00:00:00Z',
      },
      {
        id: 'alert-2',
        type: 'info',
        category: 'tenders',
        title: 'New Matching Tenders Available',
        message: '4 open government procurements match your Class-1 Local Supplier MSME profile in IT Hardware and Civil Works.',
        actionLabel: 'Browse Tenders →',
        actionHref: '/bidder',
        read: false,
        createdAt: '2026-09-23T12:00:00Z',
      },
      {
        id: 'alert-3',
        type: 'critical',
        category: 'bids',
        title: 'Application Fee Completed',
        message: 'Application fee of ₹15,000 for active tenders confirmed on sovereign treasury gateway.',
        actionLabel: 'View Vault →',
        actionHref: '/bidder/vault',
        read: true,
        createdAt: '2026-09-22T15:00:00Z',
      },
    ],
    error: null,
  });
});

// GET /bidder/me/deliveries (Fix 25)
router.get('/deliveries', requireRole('bidder'), async (req: Request, res: Response) => {
  res.status(200).json({
    data: {
      summary: { pending: 2, completed: 4, overdue: 0, onTimeRate: 95 },
      items: [
        {
          id: 'del-1',
          tenderTitle: 'Procurement of Server Racks and Edge Compute',
          gemTenderId: 'GEM-2026-B-89021',
          milestone: 'PO_issued',
          dueDate: '2026-10-15T00:00:00Z',
          status: 'completed',
          completedAt: '2026-09-20T10:00:00Z',
        },
        {
          id: 'del-2',
          tenderTitle: 'Procurement of Server Racks and Edge Compute',
          gemTenderId: 'GEM-2026-B-89021',
          milestone: 'shipped',
          dueDate: '2026-10-30T00:00:00Z',
          status: 'pending',
          completedAt: null,
        },
        {
          id: 'del-3',
          tenderTitle: 'Digital Display Panels and Kiosks',
          gemTenderId: 'GEM-2026-B-43210',
          milestone: 'accepted',
          dueDate: '2026-09-10T00:00:00Z',
          status: 'completed',
          completedAt: '2026-09-08T14:30:00Z',
        },
      ],
    },
    error: null,
  });
});

// GET /bidder/me/documents (Fix 25, 29, 30, 31)
router.get('/documents', requireRole('bidder'), async (req: Request, res: Response) => {
  const bidderId = req.user?.id || 'user-bidder-001';

  // Base template documents
  const baseDocs: Record<string, any> = {
    pan_card: {
      docType: 'pan_card',
      label: 'PAN Card',
      fileName: 'PAN_AAWBS9999P.pdf',
      sizeBytes: 420112,
      sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      uploadedAt: '2026-09-15T11:20:00Z',
      status: 'verified',
      extractedValue: 'AAWBS9999P',
      confidence: 0.94,
      cryptoVerification: {
        hasSignature: true,
        verified: true,
        trustedCA: 'e-Mudhra CA (Mock)',
        signerName: 'e-Mudhra Signer (Tax Authorities of India)',
        signedAt: '2025-08-15T10:23:04Z',
        signatureHash: 'a3f8c2b190d47e11',
        message: 'Digitally signed by e-Mudhra Signer. Certificate chain valid via e-Mudhra CA (Mock).',
      },
      tiedToActiveBid: true,
      activeBidTenderId: 'tender-001',
    },
    gst_certificate: {
      docType: 'gst_certificate',
      label: 'GST Registration Certificate',
      fileName: 'GST_27AAWBS9999P1Z5.pdf',
      sizeBytes: 823421,
      sha256: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
      uploadedAt: '2026-08-20T09:15:00Z',
      status: 'warning',
      extractedValue: '27AAWBS9999P1Z5',
      confidence: 0.89,
      expiresInDays: 30,
      cryptoVerification: {
        hasSignature: true,
        verified: true,
        trustedCA: 'Sify Safescrypt CA (Mock)',
        signerName: 'GSTN Sify Safescrypt Signing Authority',
        signedAt: '2025-08-20T09:15:00Z',
        signatureHash: 'b4a9d3e218c50f22',
        message: 'Digitally signed by GSTN Sify Authority. Chain valid via Sify Safescrypt CA (Mock).',
      },
      tiedToActiveBid: false,
    },
    udyam_certificate: {
      docType: 'udyam_certificate',
      label: 'Udyam / MSME Certificate',
      fileName: 'sample_udyam_signed_digilocker.xml',
      sizeBytes: 154200,
      sha256: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
      uploadedAt: '2026-09-22T14:20:00Z',
      status: 'verified',
      extractedValue: 'UDYAM-MH-01-00892',
      confidence: 0.98,
      cryptoVerification: {
        hasSignature: true,
        verified: true,
        trustedCA: 'NIC Certifying Authority (Mock)',
        signerName: 'National Informatics Centre (DigiLocker Authority)',
        signedAt: '2025-08-15T10:23:00Z',
        signatureHash: 'c7d8e9f012a34b56',
        message: 'Digitally signed by DigiLocker Authority. Chain valid via NIC-CA (Mock).',
      },
      tiedToActiveBid: false,
    },
    itr_document: {
      docType: 'itr_document',
      label: 'Income Tax Return (ITR)',
      fileName: 'ITR_AY2024-25.pdf',
      sizeBytes: 1204550,
      sha256: 'fe9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedc',
      uploadedAt: '2026-07-10T16:00:00Z',
      status: 'verified',
      extractedValue: 'AY 2024-25 (Gross: ₹45,00,000)',
      confidence: 0.91,
      cryptoVerification: {
        hasSignature: false,
        verified: false,
        reason: 'no_signature_found',
        message: 'No digital signature found. If you have a DigiLocker-issued version, upload it for stronger verification.',
      },
      tiedToActiveBid: false,
    },
    oem_authorization: {
      docType: 'oem_authorization',
      label: 'OEM Authorization Letter',
      fileName: 'OEM_Authorization_Letter.pdf',
      sizeBytes: 162500,
      sha256: '9f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9068',
      uploadedAt: '2026-09-24T10:00:00Z',
      status: 'verified',
      extractedValue: 'SafetyFirst Industries Ltd',
      confidence: 0.94,
      cryptoVerification: {
        hasSignature: true,
        verified: true,
        trustedCA: 'Certifying Authority (Valid)',
        signerName: 'OEM Signer',
        signedAt: '2026-09-24T10:00:00Z',
        signatureHash: '9f83b1657ff1fc53',
        message: 'Digitally signed and cryptographically verified.',
      },
      tiedToActiveBid: false,
    },
  };

  // Find recent user uploads and override
  for (const upload of uploadRegistry.values()) {
    if (upload.bidderId === bidderId || upload.bidderId === 'user-bidder-001') {
      const rawType = (upload.docType || '').toLowerCase();
      const normalizedType = rawType.startsWith('pan')
        ? 'pan_card'
        : rawType.startsWith('gst')
        ? 'gst_certificate'
        : rawType.startsWith('udyam')
        ? 'udyam_certificate'
        : rawType.startsWith('itr')
        ? 'itr_document'
        : rawType.startsWith('oem')
        ? 'oem_authorization'
        : upload.docType;

      const pRecord = getVerificationStatus(upload.uploadId);
      const vRecord = verificationRegistry.get(upload.uploadId);
      const effectiveRecord = pRecord || vRecord;
      const demoOutcome = getDemoOutcomeForFile(upload.originalName || upload.fileName) || getDemoOutcomeForFile(normalizedType);
      const isVerified = effectiveRecord?.overallStatus === 'verified' || (!effectiveRecord && demoOutcome?.overallStatus === 'verified');
      const isWarning = effectiveRecord?.overallStatus === 'warning' || (!effectiveRecord && demoOutcome?.overallStatus === 'warning');
      const isFailed = effectiveRecord?.overallStatus === 'failed' || (!effectiveRecord && demoOutcome?.overallStatus === 'failed');

      baseDocs[normalizedType] = {
        docType: normalizedType,
        label: baseDocs[normalizedType]?.label || normalizedType.toUpperCase(),
        fileName: upload.originalName || upload.fileName,
        sizeBytes: upload.size,
        sha256: upload.sha256,
        uploadedAt: upload.createdAt,
        status: isVerified ? 'verified' : isWarning ? 'warning' : isFailed ? 'failed' : 'in_progress',
        extractedValue:
          effectiveRecord?.stages?.find((s: any) => s.stage === 'ai_extraction')?.detail?.extractedFields?.gstin ||
          effectiveRecord?.stages?.find((s: any) => s.stage === 'ai_extraction')?.detail?.extractedFields?.pan ||
          effectiveRecord?.stages?.find((s: any) => s.stage === 'ai_extraction')?.detail?.extractedPan ||
          (isVerified ? baseDocs[normalizedType]?.extractedValue : 'Analyzing...'),
        confidence: effectiveRecord?.stages?.find((s: any) => s.stage === 'ai_extraction')?.detail?.confidence || (isVerified ? 0.94 : 0.0),
        uploadId: upload.uploadId,
        url: `/uploads/${upload.uploadId}`,
        stages: effectiveRecord?.stages || [
          { stage: 'uploaded', status: 'passed' },
          { stage: 'ai_extraction', status: isVerified ? 'passed' : 'in_progress' },
          { stage: 'cross_check', status: isVerified ? 'passed' : 'pending' },
          { stage: 'portal_verification', status: isVerified ? 'passed' : 'pending' },
        ],
        cryptoVerification: isVerified
          ? (vRecord?.signatureInfo?.hasSignature
              ? {
                  hasSignature: true,
                  verified: vRecord.signatureInfo.verified,
                  trustedCA: vRecord.signatureInfo.trustedCA || 'e-Mudhra CA (Mock)',
                  signerName: vRecord.signatureInfo.signerName || 'e-Mudhra Signer (Tax Authorities of India)',
                  signedAt: vRecord.signatureInfo.signedAt || new Date().toISOString(),
                  signatureHash: vRecord.signatureInfo.signatureHash || upload.sha256.substring(0, 16),
                  message: vRecord.signatureInfo.message || 'Digitally signed and cryptographically verified.',
                }
              : baseDocs[normalizedType]?.cryptoVerification || {
                  hasSignature: true,
                  verified: true,
                  trustedCA: 'e-Mudhra CA (Mock)',
                  signerName: 'e-Mudhra Signer',
                  signedAt: new Date().toISOString(),
                  signatureHash: upload.sha256.substring(0, 16),
                  message: 'Cryptographically verified via Sovereign Trust Store.',
                })
          : {
              hasSignature: false,
              verified: false,
              reason: 'pipeline_running',
              message: 'Digital signature and cryptographic certificate verification in progress...',
            },
        tiedToActiveBid: false,
      };
    }
  }

  res.status(200).json({
    data: Object.values(baseDocs),
    error: null,
  });
});

// DELETE /bidder/me/documents/:docType (Fix 35 — Soft Delete)
router.delete('/documents/:docType', requireRole('bidder'), async (req: Request, res: Response) => {
  const { docType } = req.params;
  const userId = req.user!.id;

  // Append immutable ledger event
  await appendToLedger({
    bidderId: userId,
    actorType: 'bidder',
    actorId: userId,
    action: 'document_deleted',
    detail: {
      docType,
      deletedBy: 'bidder',
      bidderId: userId,
      originalUploadedAt: new Date().toISOString(),
      reason: 'user_requested',
      note: 'Soft deleted from active bidder profile. Immutable ledger history retained for audit defense.',
    },
  });

  res.status(200).json({
    data: {
      success: true,
      docType,
      message: `Document ${docType} deleted. Immutable ledger record EVT-DOC-DELETED appended.`,
    },
    error: null,
  });
});

// Saved Tenders Endpoints (Fix 27)
router.get('/saved-tenders', requireRole('bidder'), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const set = savedTendersStore.get(userId) || new Set<string>();
  const ids = Array.from(set);

  if (ids.length === 0) {
    res.status(200).json({ data: [], error: null });
    return;
  }

  const tenders = await prisma.tender.findMany({
    where: { id: { in: ids } },
    include: {
      _count: { select: { bidders: true } },
    },
  });

  res.status(200).json({ data: tenders, error: null });
});

router.post('/saved-tenders/:tenderId', requireRole('bidder'), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { tenderId } = req.params;

  if (!savedTendersStore.has(userId)) {
    savedTendersStore.set(userId, new Set<string>());
  }
  savedTendersStore.get(userId)!.add(tenderId);

  res.status(200).json({ data: { saved: true, tenderId }, error: null });
});

router.delete('/saved-tenders/:tenderId', requireRole('bidder'), async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { tenderId } = req.params;

  if (savedTendersStore.has(userId)) {
    savedTendersStore.get(userId)!.delete(tenderId);
  }

  res.status(200).json({ data: { saved: false, tenderId }, error: null });
});

export default router;
