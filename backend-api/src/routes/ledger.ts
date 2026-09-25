/**
 * Ledger Routes (src/routes/ledger.ts)
 *
 * Mounted at:
 *   /admin/ledger  (admin only — includes export)
 *   /ledger        (officer + admin)
 *
 * Endpoints:
 *   GET  /admin/ledger                  — rich filtered query
 *   GET  /admin/ledger/export           — CSV or PDF with SHA-256 chain hash
 *   GET  /ledger/tender/:tenderId       — all entries for a tender
 *   GET  /ledger/bidder/:id             — all entries for a bidder
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getLedgerForBidder, getLedgerForTender, queryLedger, computeLedgerChainHash } from '../services/ledger.js';

const router = Router();

// ─── Shared query schema ─────────────────────────────────────────────────────

const LedgerFilterSchema = z.object({
  from:       z.string().datetime({ offset: true }).optional(),
  to:         z.string().datetime({ offset: true }).optional(),
  actorType:  z.enum(['system', 'officer', 'admin', 'bidder']).optional(),
  action:     z.string().optional(),
  bidderId:   z.string().optional(),
  tenderId:   z.string().optional(),
  search:     z.string().max(200).optional(),
  limit:      z.coerce.number().int().min(1).max(500).default(100),
  offset:     z.coerce.number().int().min(0).default(0),
});

const ExportQuerySchema = LedgerFilterSchema.extend({
  format: z.enum(['csv', 'pdf']),
});

const TenderOrBidderParamSchema = z.object({
  id: z.string().trim().min(1),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestampIST(d: Date): string {
  return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }).replace(',', '');
}

function entriesToCsv(entries: any[], chainHash: string): string {
  const escape = (v: unknown): string => {
    const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = 'id,createdAt,bidderId,actorType,actorId,action,detail\r\n';
  const rows = entries.map((e) =>
    [e.id, e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
     e.bidderId, e.actorType, e.actorId ?? '', e.action, JSON.stringify(e.detail)]
     .map(escape).join(',')
  ).join('\r\n');
  return `${header}${rows}\r\n# SHA-256 Chain Hash: ${chainHash}\r\n`;
}

async function buildLedgerPdf(entries: any[], chainHash: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const PAGE_W = 842;
  const PAGE_H = 595;
  const MARGIN = 36;
  const ROW_H = 18;
  const COL = { id: MARGIN, ts: MARGIN + 80, actor: MARGIN + 250, action: MARGIN + 360, detail: MARGIN + 490 };

  const addPage = () => {
    const p = pdfDoc.addPage([PAGE_W, PAGE_H]);
    // Header band
    p.drawRectangle({ x: 0, y: PAGE_H - 50, width: PAGE_W, height: 50, color: rgb(0.12, 0.19, 0.34) });
    p.drawText('GeM Compliance — Officer Trust Ledger Export', {
      x: MARGIN, y: PAGE_H - 32, size: 13, font: boldFont, color: rgb(1, 1, 1),
    });
    p.drawText(`Exported: ${formatTimestampIST(new Date())} IST`, {
      x: MARGIN, y: PAGE_H - 46, size: 8, font, color: rgb(0.75, 0.85, 1),
    });
    // Column headers
    const colY = PAGE_H - 68;
    p.drawText('ID (prefix)', { x: COL.id, y: colY, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    p.drawText('Timestamp (IST)', { x: COL.ts, y: colY, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    p.drawText('Actor', { x: COL.actor, y: colY, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    p.drawText('Action', { x: COL.action, y: colY, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    p.drawText('Detail (truncated)', { x: COL.detail, y: colY, size: 8, font: boldFont, color: rgb(0.2, 0.2, 0.2) });
    return { page: p, currentY: colY - ROW_H };
  };

  let { page, currentY } = addPage();

  for (let i = 0; i < entries.length; i++) {
    if (currentY < MARGIN + 40) {
      ({ page, currentY } = addPage());
    }
    const e = entries[i];
    const ts = e.createdAt instanceof Date ? formatTimestampIST(e.createdAt) : String(e.createdAt);
    const detailStr = JSON.stringify(e.detail ?? {}).substring(0, 60);

    const rowColor = i % 2 === 0 ? rgb(0.96, 0.97, 1) : rgb(1, 1, 1);
    page.drawRectangle({ x: MARGIN - 2, y: currentY - 2, width: PAGE_W - 2 * MARGIN + 4, height: ROW_H, color: rowColor });

    page.drawText(String(e.id).substring(0, 10) + '…', { x: COL.id, y: currentY + 4, size: 7, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(ts, { x: COL.ts, y: currentY + 4, size: 7, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(`${e.actorType ?? ''}${e.actorId ? ' / ' + String(e.actorId).substring(0, 10) : ''}`, { x: COL.actor, y: currentY + 4, size: 7, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(String(e.action ?? ''), { x: COL.action, y: currentY + 4, size: 7, font, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(detailStr, { x: COL.detail, y: currentY + 4, size: 7, font, color: rgb(0.15, 0.15, 0.15) });
    currentY -= ROW_H;
  }

  // Footer with Merkle chain hash
  page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 32, color: rgb(0.12, 0.19, 0.34) });
  page.drawText(`SHA-256 Merkle Chain Hash: ${chainHash}`, {
    x: MARGIN, y: 12, size: 7, font, color: rgb(0.85, 0.9, 1),
  });
  page.drawText(`Total entries: ${entries.length}`, {
    x: PAGE_W - MARGIN - 80, y: 12, size: 7, font, color: rgb(0.85, 0.9, 1),
  });

  return pdfDoc.save();
}

// ─── GET /  (admin: full filtered ledger) ────────────────────────────────────

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LedgerFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid query parameters', issues: parsed.error.issues } });
      return;
    }
    const entries = await queryLedger(parsed.data);
    res.status(200).json({ data: entries, error: null });
  } catch (err) {
    next(err);
  }
});

// ─── GET /export  (admin: signed CSV or PDF) ─────────────────────────────────

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = ExportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ data: null, error: { message: parsed.error.issues[0]?.message ?? 'Invalid export parameters', issues: parsed.error.issues } });
      return;
    }
    const { format, ...filterOpts } = parsed.data;
    const entries = await queryLedger(filterOpts);

    // Compute Merkle chain hash (entries are already newest-first; hash is order-dependent,
    // so we reverse to get chronological for determinism)
    const chronological = [...entries].reverse();
    const chainHash = computeLedgerChainHash(chronological);

    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (format === 'csv') {
      const csv = entriesToCsv(entries, chainHash);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="ledger-export-${ts}.csv"`);
      res.setHeader('X-Ledger-Chain-Hash', chainHash);
      res.status(200).send(csv);
      return;
    }

    // PDF
    const pdfBytes = await buildLedgerPdf(entries, chainHash);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ledger-export-${ts}.pdf"`);
    res.setHeader('X-Ledger-Chain-Hash', chainHash);
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (err) {
    next(err);
  }
});

// ─── GET /tender/:id  (officer + admin) ──────────────────────────────────────

router.get('/tender/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = TenderOrBidderParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ data: null, error: { message: 'Invalid tender id' } });
      return;
    }
    const entries = await getLedgerForTender(parsed.data.id);
    res.status(200).json({ data: entries, error: null });
  } catch (err) {
    next(err);
  }
});

// ─── GET /bidder/:id  (officer + admin) ──────────────────────────────────────

router.get('/bidder/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = TenderOrBidderParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ data: null, error: { message: 'Invalid bidder id' } });
      return;
    }
    const entries = await getLedgerForBidder(parsed.data.id);
    res.status(200).json({ data: entries, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
