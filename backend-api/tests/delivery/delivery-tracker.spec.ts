/**
 * Phase 7: Post-Award Delivery Tracker Integration Tests (tests/delivery/delivery-tracker.spec.ts)
 *
 * Feature 11 — Post-Award Delivery Tracker
 *
 * Tests:
 *   1. Milestone seeding (POST /awards/:id/milestones) — 6 default milestones (Admin only)
 *   2. Role guards on seeding (Admin only; Officer/Bidder -> 403)
 *   3. Conflict guard (Seeding already seeded award -> 409)
 *   4. Milestone retrieval (GET /awards/:id/milestones) for Officer & Admin
 *   5. Bidder self-service vault endpoint (GET /bidder/me/awards/:awardId/milestones) — scoped to winning bidder
 *   6. Milestone completion (PATCH /milestones/:id/complete) — auto-classify on_time (completedAt <= dueDate)
 *   7. Milestone completion (PATCH /milestones/:id/complete) — auto-classify late (completedAt > dueDate)
 *   8. Profile score reflection (+5 on_time, -8 late, +2 completed)
 *   9. Milestone auto-classification 'missed' at award close (overdue past grace period)
 *  10. Profile deduction for missed/failed delivery (-15)
 *  11. Award close (POST /awards/:id/close) — Admin only, tender status closed, award_closed ledger
 *  12. Complete end-to-end lifecycle loop test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/db/client.js';
import { adminPrisma, deleteLedgerEntriesAdmin } from '../helpers/adminDb.js';
import { config } from '../../src/config.js';
import { computeCompanyHash } from '../../src/services/profile/profile.js';

const BASE_URL = `http://localhost:${config.PORT}`;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Phase 7: Post-Award Delivery Tracker (Feature 11)', () => {
  const adminToken = jwt.sign({ id: 'user-admin-p7', role: 'admin' }, config.JWT_SECRET);
  const officerToken = jwt.sign({ id: 'user-officer-p7', role: 'officer' }, config.JWT_SECRET);
  const winningBidderToken = jwt.sign({ id: 'user-bidder-winner-p7', role: 'bidder' }, config.JWT_SECRET);
  const otherBidderToken = jwt.sign({ id: 'user-bidder-other-p7', role: 'bidder' }, config.JWT_SECRET);

  let tenderId: string;
  let winningBidderId: string;
  let otherBidderId: string;
  let awardId: string;
  const WINNING_PAN = 'DELIV1234A';
  const OTHER_PAN = 'OTHER5678B';
  const winningCompanyHash = computeCompanyHash(WINNING_PAN);

  beforeAll(async () => {
    // 1. Create Tender
    const tender = await prisma.tender.create({
      data: {
        title: 'Phase 7 Delivery Tracker Test Tender',
        gemTenderId: `GEM-P7-DELIV-${Date.now()}`,
        status: 'evaluation',
      },
    });
    tenderId = tender.id;

    // 2. Create Winning Bidder
    const winner = await prisma.bidder.create({
      data: {
        tenderId,
        companyName: 'Apex Delivery Solutions Pvt Ltd',
        pan: WINNING_PAN,
        gstin: '07DELIV1234A1Z5',
        approvalState: 'awarded',
        overallRisk: 'low',
        riskScore: 0.1,
      },
    });
    winningBidderId = winner.id;

    // Link winning bidder user token to this bidder via a ledger entry
    await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'replica';");
    try {
      await adminPrisma.ledgerEntry.create({
        data: {
          bidderId: winningBidderId,
          actorType: 'bidder',
          actorId: 'user-bidder-winner-p7',
          action: 'verification_run',
          detail: { note: 'auth link' },
        },
      });
    } finally {
      await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'origin';");
    }

    // 3. Create Other Bidder
    const other = await prisma.bidder.create({
      data: {
        tenderId,
        companyName: 'Competitor Logistics Ltd',
        pan: OTHER_PAN,
        gstin: '07OTHER5678B1Z9',
        approvalState: 'rejected',
        overallRisk: 'medium',
        riskScore: 0.5,
      },
    });
    otherBidderId = other.id;

    // Link other bidder user token
    await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'replica';");
    try {
      await adminPrisma.ledgerEntry.create({
        data: {
          bidderId: otherBidderId,
          actorType: 'bidder',
          actorId: 'user-bidder-other-p7',
          action: 'verification_run',
          detail: { note: 'auth link' },
        },
      });
    } finally {
      await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'origin';");
    }

    // 4. Create AwardDecision
    const award = await prisma.awardDecision.create({
      data: {
        tenderId,
        winningBidderId,
        primaryOfficerId: 'user-officer-p7',
        justification: 'Highest technical score with full compliance and lowest price verified.',
        standoutFactors: [{ factor: 'Delivery Speed', note: 'Guaranteed 35-day turnaround' }],
        submittedAt: new Date(Date.now() - 5 * DAY_MS),
        finalizedAt: new Date(Date.now() - 4 * DAY_MS),
      },
    });
    awardId = award.id;

    // Clean any prior profile
    await prisma.bidderProfile.deleteMany({
      where: { bidderCompanyId: winningCompanyHash },
    });
  });

  afterAll(async () => {
    await prisma.deliveryMilestone.deleteMany({ where: { awardId } });
    await prisma.awardDecision.deleteMany({ where: { tenderId } });
    await deleteLedgerEntriesAdmin({ bidderId: { in: [winningBidderId, otherBidderId] } });
    await prisma.bidder.deleteMany({ where: { tenderId } });
    await prisma.tender.deleteMany({ where: { id: tenderId } });
    await prisma.bidderProfile.deleteMany({ where: { bidderCompanyId: winningCompanyHash } });
  });

  // ─── 1. Milestone Seeding (POST /awards/:id/milestones) ──────────────────────

  it('officer gets 403 on POST /awards/:id/milestones (Admin only)', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('bidder gets 403 on POST /awards/:id/milestones', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${winningBidderToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent award on seeding', async () => {
    const res = await fetch(`${BASE_URL}/awards/non-existent-award-999/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });

  it('admin seeds 6 default milestones successfully', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBe(6);

    const labels = body.data.map((m: any) => m.label);
    expect(labels).toEqual([
      'PO_issued',
      'shipped',
      'received',
      'inspected',
      'accepted',
      'payment_released',
    ]);

    for (const m of body.data) {
      expect(m.status).toBe('pending');
      expect(m.completedAt).toBeNull();
      expect(m.awardId).toBe(awardId);
    }
  });

  it('returns 409 when attempting to re-seed milestones on same award', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toMatch(/already seeded/i);
  });

  // ─── 2. Milestone Retrieval ──────────────────────────────────────────────────

  it('officer can GET /awards/:id/milestones and receives ordered list', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(6);
    expect(body.data[0].label).toBe('PO_issued');
  });

  it('admin can GET /awards/:id/milestones', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.length).toBe(6);
  });

  it('bidder gets 403 on internal GET /awards/:id/milestones', async () => {
    const res = await fetch(`${BASE_URL}/awards/${awardId}/milestones`, {
      headers: { Authorization: `Bearer ${winningBidderToken}` },
    });
    expect(res.status).toBe(403);
  });

  // ─── 3. Bidder Self-Service Tracker Endpoint (Feature 5 Vault Pattern) ───────

  it('winning bidder can view their award milestones via GET /bidder/me/awards/:awardId/milestones', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/awards/${awardId}/milestones`, {
      headers: { Authorization: `Bearer ${winningBidderToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.awardId).toBe(awardId);
    expect(body.data.milestones.length).toBe(6);
  });

  it('competing bidder gets 403 when requesting an award won by another organization', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/awards/${awardId}/milestones`, {
      headers: { Authorization: `Bearer ${otherBidderToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/access denied/i);
  });

  // ─── 4. Milestone Completion: on_time Auto-Classification ────────────────────

  it('officer completes milestone on-time (completedAt <= dueDate) -> status=on_time & score reflects', async () => {
    const milestones = await prisma.deliveryMilestone.findMany({
      where: { awardId },
      orderBy: { dueDate: 'asc' },
    });
    const firstMilestone = milestones[0]; // PO_issued

    // Complete BEFORE or ON due date
    const onTimeCompletion = new Date(firstMilestone.dueDate.getTime() - 1000).toISOString();

    const res = await fetch(`${BASE_URL}/milestones/${firstMilestone.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${officerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedAt: onTimeCompletion,
        proofDocs: { poNumber: 'PO-2026-001', verifiedBy: 'Officer Verma' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.milestone.status).toBe('on_time');
    expect(body.data.milestone.completedAt).toBeDefined();

    // Verify ledger entry
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        action: 'delivery_milestone',
        bidderId: winningBidderId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry!.actorType).toBe('officer');
    expect(ledgerEntry!.actorId).toBe('user-officer-p7');
    expect((ledgerEntry!.detail as any).status).toBe('on_time');
    expect((ledgerEntry!.detail as any).milestoneId).toBe(firstMilestone.id);

    // Verify profile score: 1 on_time (+5) + 1 completed (+2) -> Base 50 + 5 + 2 = 57
    const profile = await prisma.bidderProfile.findUnique({
      where: { bidderCompanyId: winningCompanyHash },
    });
    expect(profile).toBeDefined();
    expect(profile!.onTimeDeliveries).toBe(1);
    expect(profile!.lateDeliveries).toBe(0);
    expect(profile!.trustScore).toBe(57);
  });

  // ─── 5. Milestone Completion: late Auto-Classification ──────────────────────

  it('admin completes milestone late (completedAt > dueDate) -> status=late & score drops', async () => {
    const milestones = await prisma.deliveryMilestone.findMany({
      where: { awardId },
      orderBy: { dueDate: 'asc' },
    });
    const secondMilestone = milestones[1]; // shipped

    // Complete AFTER due date (+2 days late)
    const lateCompletion = new Date(secondMilestone.dueDate.getTime() + 2 * DAY_MS).toISOString();

    const res = await fetch(`${BASE_URL}/milestones/${secondMilestone.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedAt: lateCompletion,
        proofDocs: { courierRef: 'BLUEDART-LATE-123' },
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.milestone.status).toBe('late');

    // Verify ledger entry has actorType=admin
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        action: 'delivery_milestone',
        bidderId: winningBidderId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(ledgerEntry).toBeDefined();
    expect(ledgerEntry!.actorType).toBe('admin');
    expect(ledgerEntry!.actorId).toBe('user-admin-p7');
    expect((ledgerEntry!.detail as any).status).toBe('late');

    // Verify profile score:
    // 1 on_time (+5), 1 late (-8), 2 completed (+4)
    // 50 + 5 - 8 + 4 = 51
    const profile = await prisma.bidderProfile.findUnique({
      where: { bidderCompanyId: winningCompanyHash },
    });
    expect(profile!.onTimeDeliveries).toBe(1);
    expect(profile!.lateDeliveries).toBe(1);
    expect(profile!.trustScore).toBe(51);
  });

  it('returns 409 when attempting to complete an already completed milestone', async () => {
    const milestones = await prisma.deliveryMilestone.findMany({
      where: { awardId },
      orderBy: { dueDate: 'asc' },
    });
    const firstMilestone = milestones[0]; // already 'on_time'

    const res = await fetch(`${BASE_URL}/milestones/${firstMilestone.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${officerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toMatch(/already marked/i);
  });

  // ─── 6. Missed Milestone Auto-Classification at Award Close (Requirement 1) ─

  it('award close auto-classifies overdue pending milestones as missed (-15 deduction)', async () => {
    // Deliberately set the third milestone (received) due date to 30 days in the past
    const milestones = await prisma.deliveryMilestone.findMany({
      where: { awardId, status: 'pending' },
      orderBy: { dueDate: 'asc' },
    });
    const overdueMilestone = milestones[0];

    const pastDueDate = new Date(Date.now() - 30 * DAY_MS);
    await prisma.deliveryMilestone.update({
      where: { id: overdueMilestone.id },
      data: { dueDate: pastDueDate },
    });

    // Close award as admin
    const closeRes = await fetch(`${BASE_URL}/awards/${awardId}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(closeRes.status).toBe(200);
    const closeBody = await closeRes.json();
    expect(closeBody.error).toBeNull();
    expect(closeBody.data.status).toBe('closed');

    // 1. Assert overdue milestone is now 'missed'
    const updatedOverdue = await prisma.deliveryMilestone.findUnique({
      where: { id: overdueMilestone.id },
    });
    expect(updatedOverdue!.status).toBe('missed');
    expect(updatedOverdue!.completedAt).toBeNull();

    // 2. Assert delivery_milestone ledger entry appended with status: 'missed'
    const missedLedger = await prisma.ledgerEntry.findFirst({
      where: {
        action: 'delivery_milestone',
        bidderId: winningBidderId,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect((missedLedger!.detail as any).status).toBe('missed');
    expect((missedLedger!.detail as any).milestoneId).toBe(overdueMilestone.id);

    // 3. Assert tender status is closed
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    expect(tender!.status).toBe('closed');

    // 4. Assert award_closed ledger entry exists
    const closeLedger = await prisma.ledgerEntry.findFirst({
      where: {
        action: 'award_closed',
        bidderId: winningBidderId,
      },
    });
    expect(closeLedger).toBeDefined();
    expect(closeLedger!.actorType).toBe('admin');
    expect((closeLedger!.detail as any).failedDeliveries).toBeGreaterThanOrEqual(1);

    // 5. Assert BidderProfile: failedDeliveries = 1, trustScore drops by 15
    // Previous: 1 on_time (+5), 1 late (-8), 2 completed (+4) = 51
    // Now: +1 missed (-15) -> 51 - 15 = 36
    const profile = await prisma.bidderProfile.findUnique({
      where: { bidderCompanyId: winningCompanyHash },
    });
    expect(profile!.failedDeliveries).toBe(1);
    expect(profile!.trustScore).toBe(36);
  });

  // ─── 7. Role Enforcement on Award Close (Requirement 2a) ────────────────────

  it('officer gets 403 on POST /awards/:id/close (Admin only per V2 spec)', async () => {
    // Create temporary award to test role guard
    const tempTender = await prisma.tender.create({
      data: {
        title: 'Role Guard Tender',
        gemTenderId: `GEM-ROLE-TEST-${Date.now()}`,
        status: 'evaluation',
      },
    });
    const tempAward = await prisma.awardDecision.create({
      data: {
        tenderId: tempTender.id,
        winningBidderId,
        primaryOfficerId: 'user-officer-p7',
        justification: 'Valid justification with more than eighty characters for role test.',
      },
    });

    const res = await fetch(`${BASE_URL}/awards/${tempAward.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(403);

    await prisma.awardDecision.delete({ where: { id: tempAward.id } });
    await prisma.tender.delete({ where: { id: tempTender.id } });
  });

  // ─── 8. Complete Lifecycle Loop Gate Test ────────────────────────────────────

  it('Phase 7 Gate: complete loop from award -> 6 milestones -> close -> profile score verified', async () => {
    const loopPan = 'LOOPPAN999Z';
    const loopCompanyHash = computeCompanyHash(loopPan);

    // Seed dedicated tender and award
    const loopTender = await prisma.tender.create({
      data: {
        title: 'Complete Lifecycle Loop Test Tender',
        gemTenderId: `GEM-LOOP-TEST-${Date.now()}`,
        status: 'evaluation',
      },
    });
    const loopBidder = await prisma.bidder.create({
      data: {
        tenderId: loopTender.id,
        companyName: 'Omni Logistics Loop Corp',
        pan: loopPan,
        gstin: '07LOOPPAN999Z1Z1',
        approvalState: 'awarded',
        overallRisk: 'low',
        riskScore: 0.1,
      },
    });
    const loopAward = await prisma.awardDecision.create({
      data: {
        tenderId: loopTender.id,
        winningBidderId: loopBidder.id,
        primaryOfficerId: 'user-officer-p7',
        justification: 'Selected through fair and transparent bidding with verified capacity.',
      },
    });

    // Step A: Admin seeds 6 milestones
    const seedRes = await fetch(`${BASE_URL}/awards/${loopAward.id}/milestones`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(seedRes.status).toBe(201);
    const seeded = (await seedRes.json()).data;
    expect(seeded.length).toBe(6);

    // Step B: Officer completes first 3 milestones on time
    for (let i = 0; i < 3; i++) {
      const m = seeded[i];
      const completeRes = await fetch(`${BASE_URL}/milestones/${m.id}/complete`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${officerToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completedAt: new Date(new Date(m.dueDate).getTime() - 1000).toISOString(),
        }),
      });
      expect(completeRes.status).toBe(200);
      expect((await completeRes.json()).data.milestone.status).toBe('on_time');
    }

    // Step C: Officer completes 4th milestone late
    const m4 = seeded[3];
    const lateRes = await fetch(`${BASE_URL}/milestones/${m4.id}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${officerToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedAt: new Date(new Date(m4.dueDate).getTime() + 2 * DAY_MS).toISOString(),
      }),
    });
    expect(lateRes.status).toBe(200);
    expect((await lateRes.json()).data.milestone.status).toBe('late');

    // Step D: Set 5th milestone past due (overdue)
    const m5 = seeded[4];
    await prisma.deliveryMilestone.update({
      where: { id: m5.id },
      data: { dueDate: new Date(Date.now() - 20 * DAY_MS) },
    });

    // Step E: Admin closes the award
    const closeRes = await fetch(`${BASE_URL}/awards/${loopAward.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(closeRes.status).toBe(200);
    const closeData = (await closeRes.json()).data;
    expect(closeData.status).toBe('closed');
    expect(closeData.deliverySummary.onTimeDeliveries).toBe(3);
    expect(closeData.deliverySummary.lateDeliveries).toBe(1);
    expect(closeData.deliverySummary.failedDeliveries).toBe(1);

    // Step F: Final trust score calculation check:
    // Base: 50
    // +3 on_time (+15)
    // -1 late (-8)
    // -1 failed (-15)
    // +4 completed (+8)
    // Expected: 50 + 15 - 8 - 15 + 8 = 50
    const finalProfile = await prisma.bidderProfile.findUnique({
      where: { bidderCompanyId: loopCompanyHash },
    });
    expect(finalProfile!.onTimeDeliveries).toBe(3);
    expect(finalProfile!.lateDeliveries).toBe(1);
    expect(finalProfile!.failedDeliveries).toBe(1);
    expect(finalProfile!.trustScore).toBe(50);

    // Cleanup loop test
    await prisma.deliveryMilestone.deleteMany({ where: { awardId: loopAward.id } });
    await prisma.awardDecision.delete({ where: { id: loopAward.id } });
    await deleteLedgerEntriesAdmin({ bidderId: loopBidder.id });
    await prisma.bidder.delete({ where: { id: loopBidder.id } });
    await prisma.tender.delete({ where: { id: loopTender.id } });
    await prisma.bidderProfile.deleteMany({ where: { bidderCompanyId: loopCompanyHash } });
  });
});
