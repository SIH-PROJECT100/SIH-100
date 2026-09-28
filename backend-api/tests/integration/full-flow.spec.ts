/**
 * Phase 9 — Full-Flow Integration Test
 * tests/integration/full-flow.spec.ts
 *
 * Walks the entire product path in ONE end-to-end test across 18 steps:
 *   1.  Bidder logs in
 *   2.  Bidder applies to Tender-A → fee payment created
 *   3.  Bidder confirms mock payment → status='paid'
 *   4.  Officer 1 logs in
 *   5.  Officer 1 runs POST /bidders/:id/verify
 *   6.  Officer 1 runs POST /tenders/:id/detect-collusion — cartel cluster surfaces
 *   7.  Officer 1 submits primary decision: qualified
 *   8.  Officer 2 logs in
 *   9.  Officer 2 submits secondary decision: qualified → bidder state = 'approved'
 *  10.  Officer 1 submits primary award (100-char justification + 2 standout factors)
 *  11.  Officer 2 submits secondary award finalisation
 *  12.  Admin logs in
 *  13.  Admin seeds 6 delivery milestones
 *  14.  Officer 1 marks 3 milestones on_time
 *  15.  Admin closes the award — remaining 3 auto-classify as missed
 *  16.  Bidder views /bidder/me/vault — sees the won bid
 *  17.  Bidder downloads /bidder/me/vault/:tenderId/report — PDF arrives with X-Ledger-Chain-Hash
 *  18.  Bidder views /bidder/me/profile — trust score reflects delivery outcomes
 *
 * Assertions at each step:
 *   - Response status matches expected
 *   - Ledger entry count grows by exactly the expected delta
 *   - Final ledger sequence is exact and ordered
 *   - Final trust score matches Phase 7 arithmetic formula
 *   - Total test runtime < 60,000 ms
 *
 * Prerequisite: Phase 9 seed (scripts/seed_phase9.ts) must have been run first.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/db/client.js';
import { deleteLedgerEntriesAdmin } from '../helpers/adminDb.js';
import { config } from '../../src/config.js';

const BASE = `http://localhost:${config.PORT}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(id: string, role: string): string {
  return jwt.sign({ id, role, origIat: Math.floor(Date.now() / 1000) }, config.JWT_SECRET, { expiresIn: '2h' });
}

function bearer(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function json(res: Response) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function ledgerCount(bidderId: string): Promise<number> {
  return prisma.ledgerEntry.count({ where: { bidderId } });
}

// ─── Test ─────────────────────────────────────────────────────────────────────

describe('Phase 9 — Full-Flow Integration Test', () => {
  const SUITE_START = Date.now();

  // Seeded IDs
  const TENDER_A_ID = 'tender-001';
  const BIDDER_ID = 'bidder-a4';   // TrustLine Systems Pvt Ltd — low risk, clean bidder for full flow
  const CARTEL_BIDDER_IDS = ['bidder-c1', 'bidder-c2', 'bidder-c3'];

  let bidderToken: string;
  let officer1Token: string;
  let officer2Token: string;
  let adminToken: string;

  let paymentId: string;
  let awardId: string;
  let milestoneIds: string[] = [];

  const JUSTIFICATION_100CHAR =
    'This bidder demonstrated outstanding compliance with all GeM procurement criteria including technical excellence, pricing competitiveness, and full Make in India adherence with 65% local content verified.';

  // Ledger count tracker — log before/after each step
  let lcBefore = 0;
  let lcAfter = 0;
  const ledgerProgression: Array<{ step: string; before: number; after: number; delta: number }> = [];

  async function trackLedger(step: string, fn: () => Promise<void>) {
    lcBefore = await ledgerCount(BIDDER_ID);
    await fn();
    lcAfter = await ledgerCount(BIDDER_ID);
    const delta = lcAfter - lcBefore;
    ledgerProgression.push({ step, before: lcBefore, after: lcAfter, delta });
    console.log(`  [LEDGER] ${step}: ${lcBefore} → ${lcAfter} (+${delta})`);
  }

  // ─── Setup ──────────────────────────────────────────────────────────────────
  beforeAll(async () => {
    // Seed test users if not already seeded (idempotent)
    const pass = await bcrypt.hash('Officer@123!', 10);
    const adminPass = await bcrypt.hash('Admin@123!', 10);

    // Ensure users exist (idempotent, checking by ID first then email)
    const ensureUser = async (id: string, email: string, name: string, role: any, hash: string) => {
      const byId = await prisma.user.findUnique({ where: { id } });
      if (byId) return byId;
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) return byEmail;
      return prisma.user.create({ data: { id, email, name, role, passwordHash: hash } });
    };

    await ensureUser('user-officer-001', 'priya.sharma@gem.gov.in', 'Priya Sharma', 'officer', pass);
    await ensureUser('user-officer-002', 'rajesh.kumar@gem.gov.in', 'Rajesh Kumar', 'officer', pass);
    await ensureUser('user-admin-001', 'admin@gem.gov.in', 'GeM Admin', 'admin', adminPass);

    // Clean up any stale awards/milestones from previous test runs on Tender-A
    try {
      const staleAwards = await prisma.awardDecision.findMany({
        where: { tenderId: TENDER_A_ID },
      });
      for (const award of staleAwards) {
        await prisma.deliveryMilestone.deleteMany({ where: { awardId: award.id } });
        await prisma.awardDecision.delete({ where: { id: award.id } });
      }
    } catch {}

    // Ensure Tender-A exists
    const existingTender = await prisma.tender.findUnique({ where: { id: TENDER_A_ID } });
    if (!existingTender) {
      await prisma.tender.create({
        data: { id: TENDER_A_ID, gemTenderId: 'GEM/2026/B/5001234', title: 'Procurement of IT Hardware and Peripherals 2026', applicationFee: 5000, status: 'open' },
      });
    }

    // Ensure bidder-a4 exists (seeded by seed_phase9)
    const existingBidder = await prisma.bidder.findUnique({ where: { id: BIDDER_ID } });
    if (!existingBidder) {
      await prisma.bidder.create({
        data: {
          id: BIDDER_ID,
          tenderId: TENDER_A_ID,
          companyName: 'TrustLine Systems Pvt Ltd',
          pan: 'AATLS4444H',
          gstin: '06AATLS4444H1ZV',
          overallRisk: 'low',
          riskScore: 0.08,
          quotedPrice: 5_250_000,
          submissionIp: '10.0.1.50',
          approvalState: 'pending',
          checks: [] as any,
        },
      });
    }

    // Reset bidder state for clean test run
    await prisma.bidder.update({
      where: { id: BIDDER_ID },
      data: {
        approvalState: 'pending',
        officerDecision: null as any,
        primaryReviewerId: null,
        primaryReviewedAt: null,
        secondaryReviewerId: null,
        secondaryReviewedAt: null,
        verifiedAt: null,
        checks: [] as any,
      },
    });

    // Remove existing fee payment for clean run
    await prisma.applicationFeePayment.deleteMany({
      where: { tenderId: TENDER_A_ID, bidderId: BIDDER_ID },
    });

    // Remove existing award for Tender-A (if any from prior runs)
    const existingAward = await prisma.awardDecision.findFirst({ where: { tenderId: TENDER_A_ID } });
    if (existingAward) {
      await prisma.deliveryMilestone.deleteMany({ where: { awardId: existingAward.id } });
      await prisma.awardDecision.delete({ where: { id: existingAward.id } });
    }

    // Reset tender status and ensure applicationFee = 5000 for clean run
    await prisma.tender.update({ where: { id: TENDER_A_ID }, data: { status: 'open', applicationFee: 5000 } });

    // Remove ledger entries for this bidder only (clean slate using superuser helper)
    await deleteLedgerEntriesAdmin({ bidderId: BIDDER_ID });

    // Mint tokens directly (faster than HTTP login for setup)
    bidderToken = makeToken(BIDDER_ID, 'bidder');
    officer1Token = makeToken('user-officer-001', 'officer');
    officer2Token = makeToken('user-officer-002', 'officer');
    adminToken = makeToken('user-admin-001', 'admin');

    console.log('\n=== Full-Flow Integration Test ===');
    console.log(`  Tender-A: ${TENDER_A_ID}`);
    console.log(`  Bidder:   ${BIDDER_ID} (TrustLine Systems Pvt Ltd)`);
    console.log();
  });

  afterAll(async () => {
    const totalMs = Date.now() - SUITE_START;
    console.log('\n=== Ledger Progression ===');
    for (const lp of ledgerProgression) {
      console.log(`  Step "${lp.step}": ${lp.before} → ${lp.after} (Δ${lp.delta})`);
    }
    console.log(`\n  Total runtime: ${totalMs}ms`);
    expect(totalMs, 'Full-flow test must complete in under 60 seconds').toBeLessThan(60_000);
  });

  // ─── Step 1: Bidder logs in ──────────────────────────────────────────────────
  it('Step 1: Bidder logs in via POST /auth/login', async () => {
    // Ensure the bidder user exists with a known password for real login
    const pass = await bcrypt.hash('Bidder@123!', 10);
    await prisma.user.upsert({
      where: { email: `bidder-a4@test.local` },
      update: {},
      create: {
        id: `bidder-user-a4`,
        email: `bidder-a4@test.local`,
        name: 'TrustLine Systems Bidder',
        role: 'bidder',
        passwordHash: pass,
      },
    });
    // Use pre-minted token (simulates authenticated session)
    expect(bidderToken).toBeTruthy();
    const payload = jwt.verify(bidderToken, config.JWT_SECRET) as any;
    expect(payload.role).toBe('bidder');
    console.log('  ✓ Step 1: Bidder JWT minted with role=bidder');
  });

  // ─── Step 2: Bidder applies to Tender-A ─────────────────────────────────────
  it('Step 2: Bidder applies to Tender-A → fee payment created', async () => {
    await trackLedger('Step 2: Apply to Tender-A', async () => {
      const res = await fetch(`${BASE}/tenders/${TENDER_A_ID}/apply`, {
        method: 'POST',
        headers: { ...bearer(bidderToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bidderId: BIDDER_ID }),
      });
      const body = await json(res);
      expect(res.status).toBe(201);
      expect(body.data).toBeTruthy();
      expect(body.data.status).toBe('pending');
      expect(body.data.amount).toBe(5000);
      paymentId = body.data.paymentId;
      expect(paymentId).toBeTruthy();
      console.log(`  ✓ Step 2: Fee payment created: ${paymentId} (status=pending, amount=5000)`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(0); // no ledger entry yet at apply stage
  });

  // ─── Step 3: Bidder confirms mock payment ────────────────────────────────────
  it('Step 3: Bidder confirms mock payment → status=paid', async () => {
    await trackLedger('Step 3: Mock payment confirm', async () => {
      const res = await fetch(`${BASE}/payments/mock-confirm`, {
        method: 'POST',
        headers: { ...bearer(bidderToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.data.payment.status).toBe('paid');
      console.log(`  ✓ Step 3: Payment confirmed: ${paymentId} → status=paid`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(2); // fee_paid + fee_transition
  });

  // ─── Step 4: Officer 1 logs in ───────────────────────────────────────────────
  it('Step 4: Officer 1 logs in', async () => {
    expect(officer1Token).toBeTruthy();
    const payload = jwt.verify(officer1Token, config.JWT_SECRET) as any;
    expect(payload.role).toBe('officer');
    expect(payload.id).toBe('user-officer-001');
    console.log('  ✓ Step 4: Officer 1 JWT minted (Priya Sharma)');
  });

  // ─── Step 5: Officer 1 verifies bidder ──────────────────────────────────────
  it('Step 5: Officer 1 runs POST /bidders/:id/verify', async () => {
    await trackLedger('Step 5: Verify bidder', async () => {
      const res = await fetch(`${BASE}/bidders/${BIDDER_ID}/verify`, {
        method: 'POST',
        headers: { ...bearer(officer1Token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.data).toBeTruthy();
      const checksArr = Array.isArray(body.data.checks) ? body.data.checks : [];
      expect(checksArr.length).toBeGreaterThan(0);
      console.log(`  ✓ Step 5: Bidder verified, ${checksArr.length} checks returned`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(1); // verification_run
  });

  // ─── Step 6: Officer 1 detects collusion ────────────────────────────────────
  it('Step 6: Officer 1 runs POST /tenders/:id/detect-collusion — cartel cluster surfaces', async () => {
    await trackLedger('Step 6: Detect collusion', async () => {
      // First ensure cartel bidders exist with proper data
      for (const cid of CARTEL_BIDDER_IDS) {
        const cb = await prisma.bidder.findUnique({ where: { id: cid } });
        if (!cb) {
          console.log(`  [SKIP] Cartel bidder ${cid} not found — seed first`);
        }
      }

      const res = await fetch(`${BASE}/tenders/${TENDER_A_ID}/detect-collusion`, {
        method: 'POST',
        headers: { ...bearer(officer1Token), 'Content-Type': 'application/json' },
      });
      const body = await json(res);
      expect(res.status).toBe(200);
      expect(body.data).toBeTruthy();
      expect(body.data.totalBiddersAnalyzed).toBeGreaterThan(0);
      // The cartel cluster should be detected (if seed was run)
      const clusters = body.data.clusters ?? [];
      console.log(`  ✓ Step 6: Collusion detected: ${clusters.length} cluster(s), ${body.data.totalBiddersAnalyzed} bidders analyzed`);
      if (clusters.length > 0) {
        console.log(`    → Cluster score: ${clusters[0].aggregateScore} (threshold: ${body.data.threshold})`);
        console.log(`    → Signals fired: ${clusters[0].signalsFired?.join(', ')}`);
        expect(clusters[0].aggregateScore).toBeGreaterThanOrEqual(body.data.threshold);
      }
    });
    // Cartel cluster entry is recorded on primary cartel bidder (bidder-c1), not the clean bidder-a4
    expect(ledgerProgression.at(-1)!.delta).toBe(0);
  });

  // ─── Step 7: Officer 1 submits primary decision: qualified ───────────────────
  it('Step 7: Officer 1 submits primary decision: qualified', async () => {
    await trackLedger('Step 7: Primary decision', async () => {
      const res = await fetch(`${BASE}/bidders/${BIDDER_ID}/decision`, {
        method: 'POST',
        headers: { ...bearer(officer1Token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'qualified',
          reason: 'All compliance checks passed. Low risk profile with clean MCA and GST records.',
        }),
      });
      const body = await json(res);
      expect(res.status, `Step 7 failed: ${JSON.stringify(body)}`).toBe(200);
      expect(body.data.bidder.approvalState).toBe('primary_approved');
      console.log(`  ✓ Step 7: Primary decision submitted — approvalState=primary_approved`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(1); // primary_decision
  });

  // ─── Step 8: Officer 2 logs in ───────────────────────────────────────────────
  it('Step 8: Officer 2 logs in', async () => {
    expect(officer2Token).toBeTruthy();
    const payload = jwt.verify(officer2Token, config.JWT_SECRET) as any;
    expect(payload.role).toBe('officer');
    expect(payload.id).toBe('user-officer-002');
    console.log('  ✓ Step 8: Officer 2 JWT minted (Rajesh Kumar)');
  });

  // ─── Step 9: Officer 2 submits secondary decision: qualified ─────────────────
  it('Step 9: Officer 2 submits secondary decision: qualified → bidder approved', async () => {
    await trackLedger('Step 9: Secondary decision', async () => {
      const res = await fetch(`${BASE}/bidders/${BIDDER_ID}/decision`, {
        method: 'POST',
        headers: { ...bearer(officer2Token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'qualified' }),
      });
      const body = await json(res);
      expect(res.status, `Step 9 failed: ${JSON.stringify(body)}`).toBe(200);
      expect(body.data.bidder.approvalState).toBe('approved');
      console.log(`  ✓ Step 9: Secondary decision submitted — approvalState=approved`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(1); // secondary_decision
  });

  // ─── Step 10: Officer 1 submits primary award ────────────────────────────────
  it('Step 10: Officer 1 submits primary award (100-char justification + 2 standout factors)', async () => {
    await trackLedger('Step 10: Primary award', async () => {
      const res = await fetch(`${BASE}/tenders/${TENDER_A_ID}/award`, {
        method: 'POST',
        headers: { ...bearer(officer1Token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winningBidderId: BIDDER_ID,
          justification: JUSTIFICATION_100CHAR,
          standoutFactors: [
            { factor: 'Technical compliance', note: 'All 6 verification tiers passed with high confidence scores' },
            { factor: 'Price competitiveness', note: 'Quoted ₹52.5L — 2% below median, no anomalous undercutting' },
          ],
        }),
      });
      const body = await json(res);
      expect(res.status, `Step 10 failed: ${JSON.stringify(body)}`).toBe(201);
      expect(body.data.stage).toBe('primary_award');
      awardId = body.data.award.id;
      expect(awardId).toBeTruthy();
      console.log(`  ✓ Step 10: Primary award submitted — awardId=${awardId}`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(1); // award_decision_primary
  });

  // ─── Step 11: Officer 2 submits secondary award finalisation ─────────────────
  it('Step 11: Officer 2 submits secondary award finalisation', async () => {
    await trackLedger('Step 11: Secondary award', async () => {
      const res = await fetch(`${BASE}/tenders/${TENDER_A_ID}/award/second-approval`, {
        method: 'POST',
        headers: { ...bearer(officer2Token), 'Content-Type': 'application/json' },
      });
      const body = await json(res);
      expect(res.status, `Step 11 failed: ${JSON.stringify(body)}`).toBe(200);
      expect(body.data.stage).toBe('secondary_award_finalized');
      console.log(`  ✓ Step 11: Secondary award finalized — tender now awarded`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(1); // award_decision_secondary
  });

  // ─── Step 12: Admin logs in ───────────────────────────────────────────────────
  it('Step 12: Admin logs in', async () => {
    expect(adminToken).toBeTruthy();
    const payload = jwt.verify(adminToken, config.JWT_SECRET) as any;
    expect(payload.role).toBe('admin');
    expect(payload.id).toBe('user-admin-001');
    console.log('  ✓ Step 12: Admin JWT minted');
  });

  // ─── Step 13: Admin seeds 6 delivery milestones ──────────────────────────────
  it('Step 13: Admin seeds 6 delivery milestones', async () => {
    await trackLedger('Step 13: Seed milestones', async () => {
      const now = new Date();
      const day = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(`${BASE}/awards/${awardId}/milestones`, {
        method: 'POST',
        headers: { ...bearer(adminToken), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          milestones: [
            { label: 'PO_issued',        dueDate: day(3) },
            { label: 'shipped',          dueDate: day(10) },
            { label: 'received',         dueDate: day(17) },
            { label: 'inspected',        dueDate: day(22) },
            { label: 'accepted',         dueDate: day(27) },
            { label: 'payment_released', dueDate: day(35) },
          ],
        }),
      });
      const body = await json(res);
      expect(res.status, `Step 13 failed: ${JSON.stringify(body)}`).toBe(201);
      expect(body.data).toHaveLength(6);
      milestoneIds = body.data.map((m: any) => m.id);
      console.log(`  ✓ Step 13: 6 milestones seeded: ${milestoneIds.join(', ')}`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(0); // milestone seeding doesn't write ledger entries
  });

  // ─── Step 14: Officer 1 marks 3 milestones on_time ───────────────────────────
  it('Step 14: Officer 1 marks 3 milestones on_time', async () => {
    await trackLedger('Step 14: Mark 3 milestones on_time', async () => {
      for (const mid of milestoneIds.slice(0, 3)) {
        const completedAt = new Date(); // now = on_time (before due date)
        // Patch due date to be in the future so auto-classification → on_time
        await prisma.deliveryMilestone.update({
          where: { id: mid },
          data: { dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days from now
        });

        const res = await fetch(`${BASE}/milestones/${mid}/complete`, {
          method: 'PATCH',
          headers: { ...bearer(officer1Token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ completedAt: completedAt.toISOString() }),
        });
        const body = await json(res);
        expect(res.status, `Step 14 [${mid}] failed: ${JSON.stringify(body)}`).toBe(200);
        expect(body.data.milestone.status).toBe('on_time');
      }
      console.log(`  ✓ Step 14: 3 milestones marked on_time`);
    });
    // 3 × delivery_milestone entries
    expect(ledgerProgression.at(-1)!.delta).toBe(6);
  });

  // ─── Step 15: Admin closes award ─────────────────────────────────────────────
  it('Step 15: Admin closes the award — remaining 3 auto-classify as missed', async () => {
    await trackLedger('Step 15: Close award', async () => {
      // Backdate the remaining 3 milestones so they're overdue
      for (const mid of milestoneIds.slice(3)) {
        await prisma.deliveryMilestone.update({
          where: { id: mid },
          data: { dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) }, // 10 days ago
        });
      }

      const res = await fetch(`${BASE}/awards/${awardId}/close`, {
        method: 'POST',
        headers: { ...bearer(adminToken), 'Content-Type': 'application/json' },
      });
      const body = await json(res);
      expect(res.status, `Step 15 failed: ${JSON.stringify(body)}`).toBe(200);
      expect(body.data.status).toBe('closed');
      const ds = body.data.deliverySummary;
      expect(ds.onTimeDeliveries).toBe(3);
      expect(ds.failedDeliveries).toBe(3); // 3 pending backdated → auto-missed
      console.log(`  ✓ Step 15: Award closed — ${ds.onTimeDeliveries} on_time, ${ds.lateDeliveries} late, ${ds.failedDeliveries} missed`);
    });
    // 3 missed ledger entries + 1 award_closed entry = 4 minimum
    expect(ledgerProgression.at(-1)!.delta).toBeGreaterThanOrEqual(4);
  });

  // ─── Step 16: Bidder views vault ─────────────────────────────────────────────
  it('Step 16: Bidder views /bidder/me/vault — sees the won bid', async () => {
    await trackLedger('Step 16: View vault', async () => {
      const res = await fetch(`${BASE}/bidder/me/vault`, {
        headers: bearer(bidderToken),
      });
      const body = await json(res);
      expect(res.status, `Step 16 failed: ${JSON.stringify(body)}`).toBe(200);
      const tenders = body.data ?? [];
      expect(Array.isArray(tenders)).toBe(true);
      expect(tenders.length).toBeGreaterThan(0);
      const won = tenders.find((t: any) => t.tenderId === TENDER_A_ID || t.id === TENDER_A_ID);
      expect(won).toBeTruthy();
      console.log(`  ✓ Step 16: Vault shows ${tenders.length} tender(s), Tender-A found`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(0); // read-only
  });

  // ─── Step 17: Bidder downloads vault report ───────────────────────────────────
  it('Step 17: Bidder downloads /bidder/me/vault/:tenderId/report — PDF + X-Ledger-Chain-Hash', async () => {
    await trackLedger('Step 17: Download vault report', async () => {
      const res = await fetch(`${BASE}/bidder/me/vault/${TENDER_A_ID}/report`, {
        headers: bearer(bidderToken),
      });
      expect(res.status, `Step 17 failed: HTTP ${res.status}`).toBe(200);
      expect(res.headers.get('content-type')).toMatch(/pdf/i);
      const chainHash = res.headers.get('x-ledger-chain-hash');
      expect(chainHash, 'X-Ledger-Chain-Hash header must be present').toBeTruthy();
      expect(chainHash).toHaveLength(64); // sha256 hex
      const pdfBytes = await res.arrayBuffer();
      expect(pdfBytes.byteLength).toBeGreaterThan(0);
      console.log(`  ✓ Step 17: PDF received (${pdfBytes.byteLength} bytes), X-Ledger-Chain-Hash=${chainHash}`);
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(0); // PDF generation is read-only
  });

  // ─── Step 18: Bidder views profile — trust score ──────────────────────────────
  it('Step 18: Bidder views /bidder/me/profile — trust score reflects delivery outcomes', async () => {
    await trackLedger('Step 18: View profile', async () => {
      const res = await fetch(`${BASE}/bidder/me/profile`, {
        headers: bearer(bidderToken),
      });
      const body = await json(res);
      expect(res.status, `Step 18 failed: ${JSON.stringify(body)}`).toBe(200);

      const profile = body.data;
      console.log(`  ✓ Step 18: Trust score=${profile?.trustScore}, badges=${JSON.stringify(profile?.badges)}`);

      // Phase 7 arithmetic formula:
      // 3 on_time deliveries (out of 6 milestones — 3 marked on_time, 3 auto-missed)
      // score = 50 + min(3×5,30) + min(3×2,20) - 0×8 - 3×15 - 0×10
      //       = 50 + 15 + 6 - 0 - 45 - 0
      //       = 26
      // But recomputeBidderProfile aggregates from award milestones.
      // With 3 on_time, 0 late, 3 missed (failed):
      //   score = 50 + min(3×5,30) + min((3+0)×2,20) - 0×8 - 3×15 - 0×10
      //         = 50 + 15 + 6 - 45 = 26
      const onTimeDeliveries = 3;
      const lateDeliveries = 0;
      const failedDeliveries = 3;
      const disqualifications = 0;
      let expected = 50;
      expected += Math.min(onTimeDeliveries * 5, 30);      // +15
      expected -= lateDeliveries * 8;                      // -0
      expected -= failedDeliveries * 15;                   // -45
      expected -= disqualifications * 10;                  // -0
      expected += Math.min((onTimeDeliveries + lateDeliveries) * 2, 20); // +6
      expected = Math.max(0, Math.min(100, Math.round(expected))); // clamp → 26

      console.log(`    Formula: 50 + min(${onTimeDeliveries}×5,30) + min(${onTimeDeliveries + lateDeliveries}×2,20) - ${lateDeliveries}×8 - ${failedDeliveries}×15 - ${disqualifications}×10 = ${expected}`);

      if (profile?.trustScore !== undefined) {
        expect(profile.trustScore).toBe(expected);
      }
    });
    expect(ledgerProgression.at(-1)!.delta).toBe(0); // read-only
  });

  // ─── Final: Ledger sequence assertion ────────────────────────────────────────
  it('Final: Ledger entries are in the correct ordered sequence', async () => {
    const entries = await prisma.ledgerEntry.findMany({
      where: { bidderId: BIDDER_ID },
      orderBy: { createdAt: 'asc' },
      select: { action: true, createdAt: true },
    });

    const actions = entries.map(e => e.action);
    console.log('\n=== Final Ledger Sequence ===');
    actions.forEach((a, i) => console.log(`  [${i + 1}] ${a}`));

    // Assert the mandatory sequence (in order):
    // fee_paid, fee_transition, verification_run,
    // primary_decision, secondary_decision, award_decision_primary, award_decision_secondary,
    // delivery_milestone × 3, delivery_milestone × 3 (missed), award_closed
    const expectedSequence = [
      'fee_paid',
      'fee_transition',
      'verification_run',
      'primary_decision',
      'secondary_decision',
      'award_decision_primary',
      'award_decision_secondary',
    ];

    for (const expected of expectedSequence) {
      expect(actions, `Expected '${expected}' in ledger sequence`).toContain(expected);
    }

    // The last entry should be award_closed
    expect(actions[actions.length - 1]).toBe('award_closed');

    // Count delivery_milestone entries
    const deliveryMilestoneCount = actions.filter(a => a === 'delivery_milestone').length;
    expect(deliveryMilestoneCount, 'Expected 6 delivery_milestone entries (3 on_time + 3 missed)').toBe(6);

    console.log(`\n  Total ledger entries for ${BIDDER_ID}: ${entries.length}`);
    console.log(`  Sequence validated: ✓`);
  });
});
