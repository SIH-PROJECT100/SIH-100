import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/db/client.js';
import { config } from '../../src/config.js';

const BASE_URL = `http://localhost:${config.PORT}`;

describe('Phase 3: Two-Officer Sequential Approval & Anti-Anchoring (Feature 4)', () => {
  const officerAId = 'user-officer-001'; // Seeded primary officer
  const officerBId = 'user-officer-002-test'; // Distinct secondary officer

  const officerAToken = jwt.sign({ id: officerAId, role: 'officer' }, config.JWT_SECRET);
  const officerBToken = jwt.sign({ id: officerBId, role: 'officer' }, config.JWT_SECRET);

  const testBidderId = 'bidder-005';
  const testTenderId = 'tender-001';

  beforeAll(async () => {
    const freshExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const existingBidder = await prisma.bidder.findUnique({ where: { id: testBidderId } });
    const checks = ((existingBidder?.checks as any[]) || []).map((c: any) => ({
      ...c,
      verificationExpiresAt: freshExpiry,
    }));

    // Reset test bidder to clean pending state with fresh verification checks
    await prisma.bidder.update({
      where: { id: testBidderId },
      data: {
        approvalState: 'pending',
        primaryReviewerId: null,
        primaryReviewedAt: null,
        secondaryReviewerId: null,
        secondaryReviewedAt: null,
        officerDecision: null,
        checks: checks.length > 0 ? checks : [{ id: 'chk-1', category: 'gst', status: 'verified', verificationExpiresAt: freshExpiry }],
      },
    });

    // Clean up any pre-existing test award decisions on tender-001
    await prisma.awardDecision.deleteMany({
      where: { tenderId: testTenderId },
    });

    await prisma.tender.update({
      where: { id: testTenderId },
      data: { status: 'evaluation' },
    });

    // Ensure application fee is recorded as paid for bidder-005 on tender-001 (Gate 3 requirement)
    await prisma.applicationFeePayment.upsert({
      where: { tenderId_bidderId: { tenderId: testTenderId, bidderId: testBidderId } },
      create: {
        tenderId: testTenderId,
        bidderId: testBidderId,
        amount: 5000,
        status: 'paid',
        gatewayRef: 'PAY-TEST-TWO-OFFICER',
        paidAt: new Date(),
      },
      update: {
        status: 'paid',
      },
    });
  });

  afterAll(async () => {
    // Teardown: restore test bidder and tender to clean state
    await prisma.bidder.update({
      where: { id: testBidderId },
      data: {
        approvalState: 'pending',
        primaryReviewerId: null,
        primaryReviewedAt: null,
        secondaryReviewerId: null,
        secondaryReviewedAt: null,
        officerDecision: null,
      },
    });

    await prisma.awardDecision.deleteMany({
      where: { tenderId: testTenderId },
    });

    await prisma.tender.update({
      where: { id: testTenderId },
      data: { status: 'evaluation' },
    });

    await prisma.$disconnect();
  });

  it('Step 1: Primary officer submits decision -> transitions to primary_approved and logs primary_decision ledger entry', async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        status: 'qualified',
        reason: 'Primary review verified Udyam and GST certificates completely valid',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.bidder.approvalState).toBe('primary_approved');
    expect(body.data.stage).toBe('primary');
    expect(body.data.bidder.primaryReviewerId).toBe(officerAId);

    // Verify ledger entry
    const ledger = await prisma.ledgerEntry.findFirst({
      where: {
        bidderId: testBidderId,
        action: 'primary_decision',
      },
      orderBy: { createdAt: 'desc' },
    });

    expect(ledger).toBeDefined();
    expect(ledger!.actorId).toBe(officerAId);
    expect((ledger!.detail as any).stage).toBe('primary');
  });

  it('Step 2: Same officer attempting secondary review is blocked with 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`, // Same officer A
      },
      body: JSON.stringify({
        status: 'qualified',
        reason: 'Attempting to self-approve and double sign',
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error.message).toMatch(/Same officer cannot perform secondary review/i);
  });

  it('Step 3: Anti-anchoring: secondary reviewer cannot see primary reviewer reason while in primary_approved state', async () => {
    // 1. Fetch as Officer B (secondary reviewer, different officer)
    const resB = await fetch(`${BASE_URL}/bidders/${testBidderId}`, {
      headers: {
        Authorization: `Bearer ${officerBToken}`,
      },
    });

    expect(resB.status).toBe(200);
    const bodyB = await resB.json();
    expect(bodyB.data.approvalState).toBe('primary_approved');
    expect(bodyB.data.officerDecision.reason).toBeNull(); // Redacted to prevent anchoring bias

    // 2. Fetch as Officer A (primary reviewer themselves)
    const resA = await fetch(`${BASE_URL}/bidders/${testBidderId}`, {
      headers: {
        Authorization: `Bearer ${officerAToken}`,
      },
    });

    expect(resA.status).toBe(200);
    const bodyA = await resA.json();
    expect(bodyA.data.officerDecision.reason).toBe(
      'Primary review verified Udyam and GST certificates completely valid'
    );
  });

  it('Step 4: Different officer submits secondary review -> transitions to approved and logs secondary_decision ledger entry', async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerBToken}`, // Different officer B
      },
      body: JSON.stringify({
        status: 'qualified',
        reason: 'Independent secondary review confirmed financial standing and technical capabilities',
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.bidder.approvalState).toBe('approved');
    expect(body.data.stage).toBe('secondary');
    expect(body.data.bidder.secondaryReviewerId).toBe(officerBId);

    // Verify both ledger entries are present
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        bidderId: testBidderId,
        action: { in: ['primary_decision', 'secondary_decision'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(ledgerEntries.length).toBeGreaterThanOrEqual(2);
    const actions = ledgerEntries.map((e) => e.action);
    expect(actions).toContain('primary_decision');
    expect(actions).toContain('secondary_decision');
  });

  it('Step 5: Anti-anchoring post-secondary: primary and secondary reasons are now fully revealed to all officers', async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}`, {
      headers: {
        Authorization: `Bearer ${officerBToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.approvalState).toBe('approved');
    expect(body.data.officerDecision.reason).not.toBeNull();
    expect(body.data.officerDecision.secondaryDecision.reason).toBe(
      'Independent secondary review confirmed financial standing and technical capabilities'
    );
  });

  it('Step 6: Attempting to review an already finalized bidder returns 409 Conflict', async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/decision`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerBToken}`,
      },
      body: JSON.stringify({
        status: 'qualified',
        reason: 'Attempting to change finalized decision',
      }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.data).toBeNull();
    expect(body.error.message).toMatch(/Decision already finalized/i);
  });

  it('Step 7: Filter chip: GET /tenders/:id/bidders?approvalState= filters correctly', async () => {
    // tender-002 has bidder-011 in primary_approved state
    const res = await fetch(
      `${BASE_URL}/tenders/tender-002/bidders?approvalState=primary_approved`,
      {
        headers: {
          Authorization: `Bearer ${officerAToken}`,
        },
      }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const b of body.data) {
      expect(b.approvalState).toBe('primary_approved');
    }
  });

  it('Step 8: Dual-Gate Award: primary officer initiates, same officer blocked, secondary officer finalizes award', async () => {
    // 1. Primary officer initiates award
    const awardRes = await fetch(`${BASE_URL}/tenders/${testTenderId}/award`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`,
      },
      body: JSON.stringify({
        winningBidderId: testBidderId,
        justification: 'Selected as the lowest compliant bidder with verified MSME status and impeccable past performance records across all previous contracts.',
        standoutFactors: [
          { factor: 'Cost', note: '12% below estimated ceiling' },
          { factor: 'Delivery', note: 'Past performance shows 100% on-time delivery' },
        ],
      }),

    });

    expect(awardRes.status).toBe(201);
    const awardBody = await awardRes.json();
    expect(awardBody.data.stage).toBe('primary_award');
    expect(awardBody.data.award.primaryOfficerId).toBe(officerAId);
    expect(awardBody.data.award.finalizedAt).toBeNull();

    // Check tender status updated
    const tenderPending = await prisma.tender.findUnique({ where: { id: testTenderId } });
    expect(tenderPending!.status).toBe('evaluation_awarded_pending_2nd');

    // 2. Same officer attempts second approval -> 403 Forbidden
    const blockRes = await fetch(`${BASE_URL}/tenders/${testTenderId}/award/second-approval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerAToken}`, // Same officer A
      },
    });

    expect(blockRes.status).toBe(403);
    const blockBody = await blockRes.json();
    expect(blockBody.error.message).toMatch(/Same officer cannot provide second approval on award/i);

    // 3. Different officer B provides second approval -> 200 OK & finalized
    const approveRes = await fetch(`${BASE_URL}/tenders/${testTenderId}/award/second-approval`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${officerBToken}`, // Different officer B
      },
    });

    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json();
    expect(approveBody.data.stage).toBe('secondary_award_finalized');
    expect(approveBody.data.award.secondaryOfficerId).toBe(officerBId);
    expect(approveBody.data.award.finalizedAt).not.toBeNull();

    // Check tender status updated to awarded
    const tenderFinal = await prisma.tender.findUnique({ where: { id: testTenderId } });
    expect(tenderFinal!.status).toBe('awarded');

    // Verify both award ledger entries
    const awardLedgers = await prisma.ledgerEntry.findMany({
      where: {
        bidderId: testBidderId,
        action: { in: ['award_decision_primary', 'award_decision_secondary'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(awardLedgers.length).toBeGreaterThanOrEqual(2);
    const awardActions = awardLedgers.map((l) => l.action);
    expect(awardActions).toContain('award_decision_primary');
    expect(awardActions).toContain('award_decision_secondary');
  });
});
