/**
 * Delivery Tracker Routes (src/routes/delivery.ts)
 *
 * Feature 11 — Post-Award Delivery Tracker
 *
 * Endpoints:
 *   POST  /awards/:id/milestones        — Seed 6 default milestones (Admin only)
 *   GET   /awards/:id/milestones        — Full milestone details (Officer, Admin)
 *   POST  /awards/:id/close             — Close award & tender, auto-classify missed milestones, recompute profile (Admin only)
 *   PATCH /milestones/:id/complete      — Auto-classify on_time / late, ledger delivery_milestone, recompute profile (Officer, Admin)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { appendToLedger } from '../services/ledger.js';
import { recomputeBidderProfile } from '../services/profile/profile.js';
import { getRulesConfig } from '../services/rulesEngine.js';
import { requireRole } from '../middleware/auth.js';
import { ActorType } from '@prisma/client';

export const awardsRouter = Router();
export const milestonesRouter = Router();

// ─── Default Milestones Definition ───────────────────────────────────────────

export const DEFAULT_MILESTONE_LABELS = [
  { label: 'PO_issued', offsetDays: 3 },
  { label: 'shipped', offsetDays: 10 },
  { label: 'received', offsetDays: 17 },
  { label: 'inspected', offsetDays: 22 },
  { label: 'accepted', offsetDays: 27 },
  { label: 'payment_released', offsetDays: 35 },
] as const;

// ─── Validation Schemas ──────────────────────────────────────────────────────

const IdParamSchema = z.object({
  id: z.string().trim().min(1, 'ID is required'),
});

const SeedMilestonesBodySchema = z.object({
  milestones: z
    .array(
      z.object({
        label: z.string().trim().min(1, 'Milestone label is required'),
        dueDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
      })
    )
    .optional(),
});

const CompleteMilestoneBodySchema = z.object({
  completedAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
    .optional(),
  proofDocs: z.any().optional(),
});

// ─── POST /awards/:id/milestones (Admin only) ────────────────────────────────

awardsRouter.post(
  '/:id/milestones',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParam = IdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        res.status(400).json({ data: null, error: { message: parsedParam.error.issues[0]?.message } });
        return;
      }
      const awardId = parsedParam.data.id;

      const parsedBody = SeedMilestonesBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json({ data: null, error: { message: parsedBody.error.issues[0]?.message } });
        return;
      }

      const award = await prisma.awardDecision.findUnique({
        where: { id: awardId },
        include: { milestones: true, winningBidder: true },
      });

      if (!award) {
        res.status(404).json({ data: null, error: { message: 'Award not found' } });
        return;
      }

      if (award.milestones.length > 0) {
        res.status(409).json({ data: null, error: { message: 'Milestones already seeded for this award' } });
        return;
      }

      const baseDate = award.finalizedAt ?? award.submittedAt ?? new Date();

      let milestonesToCreate: Array<{ awardId: string; label: string; dueDate: Date; status: string }>;

      if (parsedBody.data.milestones && parsedBody.data.milestones.length > 0) {
        milestonesToCreate = parsedBody.data.milestones.map((m) => ({
          awardId,
          label: m.label,
          dueDate: new Date(m.dueDate),
          status: 'pending',
        }));
      } else {
        milestonesToCreate = DEFAULT_MILESTONE_LABELS.map((def) => {
          const dueDate = new Date(baseDate.getTime() + def.offsetDays * 24 * 60 * 60 * 1000);
          return {
            awardId,
            label: def.label,
            dueDate,
            status: 'pending',
          };
        });
      }

      const created = await prisma.$transaction(async (tx) => {
        const rows = [];
        for (const item of milestonesToCreate) {
          const row = await tx.deliveryMilestone.create({ data: item });
          rows.push(row);
        }
        return rows;
      });

      res.status(201).json({ data: created, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /awards/:id/milestones (Officer, Admin) ─────────────────────────────

awardsRouter.get(
  '/:id/milestones',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParam = IdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        res.status(400).json({ data: null, error: { message: parsedParam.error.issues[0]?.message } });
        return;
      }
      const awardId = parsedParam.data.id;

      const award = await prisma.awardDecision.findUnique({
        where: { id: awardId },
        select: { id: true },
      });

      if (!award) {
        res.status(404).json({ data: null, error: { message: 'Award not found' } });
        return;
      }

      const milestones = await prisma.deliveryMilestone.findMany({
        where: { awardId },
        orderBy: { dueDate: 'asc' },
      });

      res.status(200).json({ data: milestones, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /awards/:id/close (Admin only) ─────────────────────────────────────

awardsRouter.post(
  '/:id/close',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParam = IdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        res.status(400).json({ data: null, error: { message: parsedParam.error.issues[0]?.message } });
        return;
      }
      const awardId = parsedParam.data.id;

      const award = await prisma.awardDecision.findUnique({
        where: { id: awardId },
        include: {
          tender: true,
          winningBidder: true,
          milestones: true,
        },
      });

      if (!award) {
        res.status(404).json({ data: null, error: { message: 'Award not found' } });
        return;
      }

      if (award.tender.status === 'closed') {
        res.status(409).json({ data: null, error: { message: 'Tender is already closed' } });
        return;
      }

      // Grace period from RulesConfig (default: 7 days)
      let graceDays = 7;
      try {
        const rules = await getRulesConfig();
        graceDays = rules.delivery?.graceDays ?? 7;
      } catch {
        graceDays = 7;
      }

      const closeAt = new Date();
      const adminUserId = req.user!.id;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Auto-classify overdue pending milestones as 'missed'
        const pendingMilestones = award.milestones.filter((m) => m.status === 'pending');

        for (const m of pendingMilestones) {
          const dueWithGrace = new Date(m.dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
          if (closeAt > dueWithGrace) {
            await tx.deliveryMilestone.update({
              where: { id: m.id },
              data: { status: 'missed' },
            });

            await appendToLedger(
              {
                bidderId: award.winningBidderId,
                actorType: 'admin',
                actorId: adminUserId,
                action: 'delivery_milestone',
                detail: {
                  awardId: award.id,
                  milestoneId: m.id,
                  label: m.label,
                  dueDate: m.dueDate.toISOString(),
                  completedAt: null,
                  autoMissedAt: closeAt.toISOString(),
                  status: 'missed',
                  reason: `Overdue past grace period of ${graceDays} days at contract close`,
                },
              },
              tx
            );
          }
        }

        // 2. Transition tender status to closed
        await tx.tender.update({
          where: { id: award.tenderId },
          data: { status: 'closed' },
        });

        // 3. Mark award finalizedAt if not yet set
        if (!award.finalizedAt) {
          await tx.awardDecision.update({
            where: { id: award.id },
            data: { finalizedAt: closeAt },
          });
        }

        // 4. Gather updated delivery summary
        const updatedMilestones = await tx.deliveryMilestone.findMany({
          where: { awardId: award.id },
          orderBy: { dueDate: 'asc' },
        });

        const onTimeCount = updatedMilestones.filter((m) => m.status === 'on_time').length;
        const lateCount = updatedMilestones.filter((m) => m.status === 'late').length;
        const missedCount = updatedMilestones.filter((m) => m.status === 'missed').length;
        const remainingPending = updatedMilestones.filter((m) => m.status === 'pending').length;

        // 5. Append award_closed ledger entry
        await appendToLedger(
          {
            bidderId: award.winningBidderId,
            actorType: 'admin',
            actorId: adminUserId,
            action: 'award_closed',
            detail: {
              awardId: award.id,
              tenderId: award.tenderId,
              winningBidderId: award.winningBidderId,
              totalMilestones: updatedMilestones.length,
              onTimeDeliveries: onTimeCount,
              lateDeliveries: lateCount,
              failedDeliveries: missedCount,
              remainingPending,
              closedAt: closeAt.toISOString(),
            },
          },
          tx
        );

        // 6. Recompute BidderProfile for the winning bidder
        let profile = null;
        if (award.winningBidder?.pan) {
          profile = await recomputeBidderProfile(
            award.winningBidder.pan,
            award.winningBidder.companyName,
            award.winningBidderId,
            tx
          );
        }

        return {
          awardId: award.id,
          tenderId: award.tenderId,
          status: 'closed',
          closedAt: closeAt.toISOString(),
          deliverySummary: {
            totalMilestones: updatedMilestones.length,
            onTimeDeliveries: onTimeCount,
            lateDeliveries: lateCount,
            failedDeliveries: missedCount,
            remainingPending,
          },
          milestones: updatedMilestones,
          profile,
        };
      });

      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// ─── PATCH /milestones/:id/complete (Officer, Admin) ─────────────────────────

milestonesRouter.patch(
  '/:id/complete',
  requireRole('officer', 'admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsedParam = IdParamSchema.safeParse(req.params);
      if (!parsedParam.success) {
        res.status(400).json({ data: null, error: { message: parsedParam.error.issues[0]?.message } });
        return;
      }
      const milestoneId = parsedParam.data.id;

      const parsedBody = CompleteMilestoneBodySchema.safeParse(req.body ?? {});
      if (!parsedBody.success) {
        res.status(400).json({ data: null, error: { message: parsedBody.error.issues[0]?.message } });
        return;
      }

      const milestone = await prisma.deliveryMilestone.findUnique({
        where: { id: milestoneId },
        include: {
          award: {
            include: {
              winningBidder: true,
              tender: true,
            },
          },
        },
      });

      if (!milestone) {
        res.status(404).json({ data: null, error: { message: 'Milestone not found' } });
        return;
      }

      if (milestone.status !== 'pending') {
        res.status(409).json({
          data: null,
          error: { message: `Milestone is already marked as ${milestone.status}` },
        });
        return;
      }

      const completedAtDate = parsedBody.data.completedAt
        ? new Date(parsedBody.data.completedAt)
        : new Date();

      // Auto-classify: on_time vs late
      const isDueDateMet = completedAtDate.getTime() <= milestone.dueDate.getTime();
      const status = isDueDateMet ? 'on_time' : 'late';

      // Derive actorType strictly from JWT role
      const callerRole = req.user!.role as string;
      const actorType: ActorType = callerRole === 'admin' ? 'admin' : 'officer';
      const actorId = req.user!.id;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Update milestone record
        const updated = await tx.deliveryMilestone.update({
          where: { id: milestoneId },
          data: {
            status,
            completedAt: completedAtDate,
            proofDocs: parsedBody.data.proofDocs ?? milestone.proofDocs,
          },
        });

        // 2. Append delivery_milestone ledger entry
        await appendToLedger(
          {
            bidderId: milestone.award.winningBidderId,
            actorType,
            actorId,
            action: 'delivery_milestone',
            detail: {
              awardId: milestone.awardId,
              milestoneId: milestone.id,
              label: milestone.label,
              dueDate: milestone.dueDate.toISOString(),
              completedAt: completedAtDate.toISOString(),
              status,
              proofDocs: parsedBody.data.proofDocs ?? null,
            },
          },
          tx
        );

        // 3. Immediately recompute winning bidder's profile
        let profile = null;
        if (milestone.award.winningBidder?.pan) {
          profile = await recomputeBidderProfile(
            milestone.award.winningBidder.pan,
            milestone.award.winningBidder.companyName,
            milestone.award.winningBidderId,
            tx
          );
        }

        return {
          milestone: updated,
          profile,
        };
      });

      res.status(200).json({ data: result, error: null });
    } catch (err) {
      next(err);
    }
  }
);
