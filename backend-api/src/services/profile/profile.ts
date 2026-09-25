/**
 * Bidder Profile service — aggregates metrics, computes trust score & badges,
 * persists to BidderProfile, and appends badge_awarded ledger entries for new badges.
 * All writes happen inside a Prisma transaction for atomicity.
 */

import crypto from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.js';
import { appendToLedger } from '../ledger.js';
import { computeTrustScore } from './score.js';
import { evaluateBadges } from './badges.js';

/**
 * Computes sha256(pan) for use as the stable, privacy-safe company identifier.
 */
export function computeCompanyHash(pan: string): string {
  return crypto.createHash('sha256').update(pan).digest('hex');
}

/**
 * Returns next-badge goals: which badges are not yet earned and what remains.
 */
export interface NextBadgeGoal {
  badge: string;
  remaining: Record<string, number>;
}

export function computeNextGoals(
  profile: {
    totalBidsSubmitted: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    failedDeliveries: number;
    disqualifications: number;
    trustScore: number;
    badges: string[];
  }
): NextBadgeGoal[] {
  const goals: NextBadgeGoal[] = [];
  const earned = new Set(profile.badges);

  if (!earned.has('first_bid') && profile.totalBidsSubmitted < 1) {
    goals.push({ badge: 'first_bid', remaining: { bidsNeeded: 1 - profile.totalBidsSubmitted } });
  }
  if (!earned.has('five_bids') && profile.totalBidsSubmitted < 5) {
    goals.push({ badge: 'five_bids', remaining: { bidsNeeded: 5 - profile.totalBidsSubmitted } });
  }
  if (!earned.has('ten_bids') && profile.totalBidsSubmitted < 10) {
    goals.push({ badge: 'ten_bids', remaining: { bidsNeeded: 10 - profile.totalBidsSubmitted } });
  }
  if (!earned.has('on_time_streak_3')) {
    goals.push({
      badge: 'on_time_streak_3',
      remaining: {
        onTimeNeeded: Math.max(0, 3 - profile.onTimeDeliveries),
        lateAllowed: 0,
        failedAllowed: 0,
      },
    });
  }
  if (!earned.has('verified_veteran')) {
    goals.push({
      badge: 'verified_veteran',
      remaining: {
        bidsNeeded: Math.max(0, 10 - profile.totalBidsSubmitted),
        trustScoreNeeded: Math.max(0, 75 - profile.trustScore),
      },
    });
  }
  if (!earned.has('clean_slate')) {
    goals.push({
      badge: 'clean_slate',
      remaining: {
        disqualificationsAllowed: 0,
        failedDeliveriesAllowed: 0,
      },
    });
  }
  if (!earned.has('msme_verified')) {
    goals.push({
      badge: 'msme_verified',
      remaining: {
        udyamRegistrationActive: 1,
      },
    });
  }
  if (!earned.has('zero_gst_defaults')) {
    goals.push({
      badge: 'zero_gst_defaults',
      remaining: {
        cleanFilingMonthsNeeded: 24,
      },
    });
  }
  if (!earned.has('class_1_local_supplier')) {
    goals.push({
      badge: 'class_1_local_supplier',
      remaining: {
        localContentPercentNeeded: 50,
      },
    });
  }
  if (!earned.has('clean_anti_cartel')) {
    goals.push({
      badge: 'clean_anti_cartel',
      remaining: {
        zeroCollusionFlags: 1,
      },
    });
  }

  return goals;
}

type AnyPrismaClient = PrismaClient | Prisma.TransactionClient;

/**
 * Ensures a BidderProfile row exists for the given PAN.
 * Creates with defaults if absent.
 */
export async function getOrCreateBidderProfile(
  pan: string,
  displayName: string,
  client: AnyPrismaClient = prisma
) {
  const companyHash = computeCompanyHash(pan);

  const existing = await (client as PrismaClient).bidderProfile.findUnique({
    where: { bidderCompanyId: companyHash },
  });

  if (existing) return existing;

  return (client as PrismaClient).bidderProfile.create({
    data: {
      bidderCompanyId: companyHash,
      displayName,
    },
  });
}

/**
 * Full recompute of a bidder's trust profile.
 *
 * Aggregates all Bidder rows sharing the same PAN, recomputes score + badges,
 * appends badge_awarded ledger entries for newly unlocked badges,
 * and upserts BidderProfile — all inside a single transaction.
 *
 * @param pan              The bidder's PAN (cross-tender identity key).
 * @param displayName      Human-readable company name (used for upsert only).
 * @param actorBidderId    bidderId to attach badge_awarded ledger entries to.
 * @param tx               Optional outer transaction client.
 */
export async function recomputeBidderProfile(
  pan: string,
  displayName: string,
  actorBidderId: string,
  tx?: Prisma.TransactionClient
) {
  const run = async (client: PrismaClient | Prisma.TransactionClient) => {
    const db = client as PrismaClient;
    const companyHash = computeCompanyHash(pan);

    // Aggregate all bidder rows for this PAN
    const bidderRows = await db.bidder.findMany({
      where: { pan },
      select: {
        id: true,
        approvalState: true,
      },
    });

    const totalBidsSubmitted = bidderRows.length;
    const totalBidsWon = bidderRows.filter(
      (b) => b.approvalState === 'awarded'
    ).length;
    const totalBidsLost = bidderRows.filter(
      (b) => b.approvalState === 'rejected' || b.approvalState === 'disqualified'
    ).length;
    const disqualifications = bidderRows.filter(
      (b) => b.approvalState === 'rejected'
    ).length;

    // Aggregate delivery milestones from award decisions linked to these bidders
    const awardRows = await db.awardDecision.findMany({
      where: { winningBidderId: { in: bidderRows.map((b) => b.id) } },
      include: { milestones: { select: { status: true } } },
    });

    let onTimeDeliveries = 0;
    let lateDeliveries = 0;
    let failedDeliveries = 0;

    for (const award of awardRows) {
      for (const m of award.milestones) {
        if (m.status === 'on_time') onTimeDeliveries++;
        else if (m.status === 'late') lateDeliveries++;
        else if (m.status === 'missed') failedDeliveries++;
      }
    }

    // Compute trust score
    const trustScore = computeTrustScore({
      onTimeDeliveries,
      lateDeliveries,
      failedDeliveries,
      disqualifications,
    });

    // Load existing profile (for badge monotonicity)
    const existingProfile = await db.bidderProfile.findUnique({
      where: { bidderCompanyId: companyHash },
    });
    const existingBadges: string[] = Array.isArray(existingProfile?.badges)
      ? (existingProfile!.badges as string[])
      : [];

    const profileMetrics = {
      totalBidsSubmitted,
      onTimeDeliveries,
      lateDeliveries,
      failedDeliveries,
      disqualifications,
      trustScore,
    };

    const { newBadges, allBadges } = evaluateBadges(profileMetrics, existingBadges);

    // Append badge_awarded entries for newly unlocked badges
    for (const badge of newBadges) {
      await appendToLedger(
        {
          bidderId: actorBidderId,
          actorType: 'system',
          actorId: null,
          action: 'badge_awarded',
          detail: {
            badge,
            pan,
            companyHash,
            trustScore,
            totalBidsSubmitted,
            awardedAt: new Date().toISOString(),
          },
        },
        client as Prisma.TransactionClient
      );
    }

    // Upsert profile
    const updatedProfile = await db.bidderProfile.upsert({
      where: { bidderCompanyId: companyHash },
      update: {
        displayName,
        totalBidsSubmitted,
        totalBidsWon,
        totalBidsLost,
        onTimeDeliveries,
        lateDeliveries,
        failedDeliveries,
        disqualifications,
        trustScore,
        badges: allBadges,
      },
      create: {
        bidderCompanyId: companyHash,
        displayName,
        totalBidsSubmitted,
        totalBidsWon,
        totalBidsLost,
        onTimeDeliveries,
        lateDeliveries,
        failedDeliveries,
        disqualifications,
        trustScore,
        badges: allBadges,
      },
    });

    return { profile: updatedProfile, newBadges, allBadges };
  };

  if (tx) {
    return run(tx);
  }
  return prisma.$transaction(run as Parameters<typeof prisma.$transaction>[0]);
}
