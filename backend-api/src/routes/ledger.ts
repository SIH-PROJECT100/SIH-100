import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { getLedgerForBidder, getFullLedger } from '../services/ledger.js';

const router = Router();

const LedgerQuerySchema = z.object({
  bidderId: z
    .string()
    .trim()
    .min(1, 'bidderId cannot be empty')
    .regex(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|bidder-[a-zA-Z0-9_-]+)$/, 'Invalid bidderId format')
    .optional(),
});

// GET /admin/ledger?bidderId= — returns ledger trail for bidder or full ledger
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LedgerQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: {
          message: parsed.error.issues[0]?.message ?? 'Invalid query parameters',
          issues: parsed.error.issues,
        },
      });
      return;
    }

    const { bidderId } = parsed.data;

    if (bidderId) {
      const entries = await getLedgerForBidder(bidderId);
      res.status(200).json({ data: entries, error: null });
      return;
    }

    const entries = await getFullLedger();
    res.status(200).json({ data: entries, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
