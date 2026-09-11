import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { appendToLedger } from '../services/ledger.js';
import { requireRole } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

const DecisionSchema = z
  .object({
    status: z.enum(['qualified', 'disqualified', 'clarification_requested', 'pending']),
    reason: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'disqualified' || data.status === 'clarification_requested') {
      const trimmed = (data.reason || '').trim();
      if (!trimmed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: `Reason is mandatory when status is '${data.status}'`,
        });
      }
    }
  });

const ParamSchema = z.object({
  bidderId: z
    .string()
    .trim()
    .min(1, 'bidderId cannot be empty')
    .regex(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|bidder-[a-zA-Z0-9_-]+)$/, 'Invalid bidderId format'),
});

// POST /bidders/:bidderId/decision — officer only
router.post(
  '/:bidderId/decision',
  requireRole('officer'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const paramParsed = ParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        res.status(400).json({
          data: null,
          error: { message: paramParsed.error.issues[0]?.message || 'Invalid bidder id' },
        });
        return;
      }
      const { bidderId } = paramParsed.data;

      const parsed = DecisionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: {
            message: parsed.error.issues[0]?.message || 'Invalid decision payload',
            issues: parsed.error.issues,
          },
        });
        return;
      }

      const { status, reason } = parsed.data;

      const bidder = await prisma.bidder.findUnique({
        where: { id: bidderId },
        select: { id: true },
      });

      if (!bidder) {
        res.status(404).json({
          data: null,
          error: { message: 'Bidder not found' },
        });
        return;
      }

      const timestamp = new Date().toISOString();
      const officerId = req.user?.id || 'unknown-officer';

      const decisionPayload = {
        status,
        reason: reason ? reason.trim() : null,
        officer_id: officerId,
        timestamp,
      };

      // Wrap Bidder update and ledger append in a single atomic transaction
      const transactionResult = await prisma.$transaction(async (tx) => {
        const updatedBidder = await tx.bidder.update({
          where: { id: bidderId },
          data: {
            officerDecision: decisionPayload,
          },
        });

        const ledgerRecord = await appendToLedger(
          {
            bidderId,
            actorType: 'officer',
            actorId: officerId,
            action: 'officer_decision',
            detail: {
              status,
              reason: reason ? reason.trim() : null,
              timestamp,
            },
          },
          tx
        );

        return { updatedBidder, ledgerRecord };
      });

      res.status(200).json({
        data: {
          bidder: transactionResult.updatedBidder,
          ledgerId: transactionResult.ledgerRecord.id,
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
