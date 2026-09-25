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

// POST /bidders/:bidderId/decision — officer or admin
router.post(
  '/:bidderId/decision',
  requireRole('officer', 'admin'),
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
      // Derive actorType: admin actions log as 'admin', all others as 'officer'
      const actorTypeForDecision = req.user?.role === 'admin' ? 'admin' : 'officer';
      const currentApprovalState = bidder.approvalState || 'pending';

      // 1. If already finalized (approved or rejected), reject with 409 Conflict
      if (currentApprovalState === 'approved' || currentApprovalState === 'rejected') {
        res.status(409).json({
          data: null,
          error: { message: `Decision already finalized for this bidder (${currentApprovalState})` },
        });
        return;
      }

      // 2. Secondary Review State: primary_approved
      if (currentApprovalState === 'primary_approved') {
        // Enforce different-officer rule
        if (bidder.primaryReviewerId && bidder.primaryReviewerId === officerId) {
          res.status(403).json({
            data: null,
            error: { message: 'Same officer cannot perform secondary review. Dual-officer approval required.' },
          });
          return;
        }

        let nextApprovalState = 'approved';
        if (status === 'disqualified') {
          nextApprovalState = 'rejected';
        } else if (status === 'clarification_requested') {
          nextApprovalState = 'pending';
        }

        const primaryDecision =
          bidder.officerDecision && typeof bidder.officerDecision === 'object'
            ? (bidder.officerDecision as Record<string, any>)
            : {};

        const decisionPayload = {
          ...primaryDecision,
          status,
          reason: reason ? reason.trim() : null,
          officer_id: officerId,
          secondaryOfficerId: officerId,
          secondaryDecision: {
            status,
            reason: reason ? reason.trim() : null,
            officer_id: officerId,
            timestamp,
          },
          finalizedAt: timestamp,
          stage: 'secondary',
        };

        const transactionResult = await prisma.$transaction(async (tx) => {
          const updatedBidder = await tx.bidder.update({
            where: { id: bidderId },
            data: {
              officerDecision: decisionPayload,
              secondaryReviewerId: officerId,
              secondaryReviewedAt: new Date(timestamp),
              approvalState: nextApprovalState,
            },
          });

          const ledgerRecord = await appendToLedger(
            {
              bidderId,
              actorType: actorTypeForDecision,
              actorId: officerId,
              action: 'secondary_decision',
              detail: {
                status,
                reason: reason ? reason.trim() : null,
                stage: 'secondary',
                primaryReviewerId: bidder.primaryReviewerId,
                secondaryReviewerId: officerId,
                approvalState: nextApprovalState,
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
            officerDecision: decisionPayload,
            ledgerId: transactionResult.ledgerRecord.id,
            stage: 'secondary',
          },
          error: null,
        });
        return;
      }

      // 3. Primary Review State: pending (or null)
      let nextApprovalState = 'primary_approved';
      if (status === 'disqualified') {
        nextApprovalState = 'rejected';
      } else if (status === 'clarification_requested') {
        nextApprovalState = 'pending';
      }

      const decisionPayload = {
        status,
        reason: reason ? reason.trim() : null,
        officer_id: officerId,
        primaryReviewerId: officerId,
        timestamp,
        stage: 'primary',
      };

      const transactionResult = await prisma.$transaction(async (tx) => {
        const updatedBidder = await tx.bidder.update({
          where: { id: bidderId },
          data: {
            officerDecision: decisionPayload,
            primaryReviewerId: officerId,
            primaryReviewedAt: new Date(timestamp),
            approvalState: nextApprovalState,
          },
        });

        const ledgerRecord = await appendToLedger(
          {
            bidderId,
            actorType: actorTypeForDecision,
            actorId: officerId,
            action: 'primary_decision',
            detail: {
              status,
              reason: reason ? reason.trim() : null,
              stage: 'primary',
              primaryReviewerId: officerId,
              approvalState: nextApprovalState,
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
          officerDecision: decisionPayload,
          ledgerId: transactionResult.ledgerRecord.id,
          stage: 'primary',
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
