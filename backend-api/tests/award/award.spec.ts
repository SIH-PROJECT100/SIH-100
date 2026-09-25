import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { prisma } from "../../src/db/client.js";
import { adminPrisma, deleteLedgerEntriesAdmin } from "../helpers/adminDb.js";
import { config } from "../../src/config.js";

const BASE_URL = `http://localhost:${config.PORT}`;
const DAY_MS = 24 * 60 * 60 * 1000;

describe("Phase 4: Award Justification & Three-Fold Gates (Feature 1)", () => {
  const officer1Token = jwt.sign({ id: "officer-award-1", role: "officer" }, config.JWT_SECRET);
  const officer2Token = jwt.sign({ id: "officer-award-2", role: "officer" }, config.JWT_SECRET);

  let tenderId: string;
  let qualifiedBidderId: string;  // qualified + fresh + paid
  let unqualifiedBidderId: string; // not qualified
  let staleBidderId: string;       // qualified but stale verification
  let unpaidBidderId: string;      // qualified + fresh but fee unpaid

  const GOOD_JUSTIFICATION = "A".repeat(80); // exactly 80 chars
  const SHORT_JUSTIFICATION = "Short."; // < 80 chars
  const GOOD_FACTORS = [{ factor: "Cost efficiency", note: "Lowest bid by 12%" }];

  function freshChecks() {
    return [
      {
        category: "gst",
        status: "verified",
        verifiedAt: new Date().toISOString(),
        verificationExpiresAt: new Date(Date.now() + 300 * DAY_MS).toISOString(),
      },
    ];
  }

  function staleChecks() {
    return [
      {
        category: "blacklist",
        status: "verified",
        verifiedAt: new Date(Date.now() - 100 * DAY_MS).toISOString(),
        verificationExpiresAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
      },
    ];
  }

  beforeAll(async () => {
    // Tender with applicationFee to test Gate 3
    const tender = await prisma.tender.create({
      data: {
        title: "Award Gate Test Tender",
        gemTenderId: `GEM-AWARD-TEST-${Date.now()}`,
        status: "evaluation",
        applicationFee: 250,
      },
    });
    tenderId = tender.id;

    // 1. qualified + fresh + paid (happy-path winner)
    const b1 = await prisma.bidder.create({
      data: {
        companyName: "Happy Path Corp",
        overallRisk: "low",
        riskScore: 0.1,
        tenderId,
        checks: freshChecks() as any,
        officerDecision: { status: "qualified", reason: "All docs verified" } as any,
        approvalState: "approved",
      },
    });
    qualifiedBidderId = b1.id;
    // Pay fee
    await prisma.applicationFeePayment.create({
      data: {
        tenderId,
        bidderId: qualifiedBidderId,
        amount: 250,
        status: "paid",
        paidAt: new Date(),
        gatewayRef: `MOCK-PAY-PAID-1`,
      },
    });

    // 2. unqualified (no officerDecision)
    const b2 = await prisma.bidder.create({
      data: {
        companyName: "Unqualified Bidder",
        overallRisk: "high",
        riskScore: 0.8,
        tenderId,
        checks: freshChecks() as any,
      },
    });
    unqualifiedBidderId = b2.id;

    // 3. qualified + stale checks
    const b3 = await prisma.bidder.create({
      data: {
        companyName: "Stale Verification Corp",
        overallRisk: "medium",
        riskScore: 0.4,
        tenderId,
        checks: staleChecks() as any,
        officerDecision: { status: "qualified", reason: "Old docs" } as any,
      },
    });
    staleBidderId = b3.id;

    // 4. qualified + fresh + fee unpaid
    const b4 = await prisma.bidder.create({
      data: {
        companyName: "Unpaid Fee Corp",
        overallRisk: "low",
        riskScore: 0.2,
        tenderId,
        checks: freshChecks() as any,
        officerDecision: { status: "qualified", reason: "All good except fee" } as any,
      },
    });
    unpaidBidderId = b4.id;
    // Create fee record in pending state (not paid)
    await prisma.applicationFeePayment.create({
      data: {
        tenderId,
        bidderId: unpaidBidderId,
        amount: 250,
        status: "pending",
        gatewayRef: `MOCK-PAY-PENDING-4`,
      },
    });
  });

  afterAll(async () => {
    await prisma.awardDecision.deleteMany({ where: { tenderId } });
    await prisma.applicationFeePayment.deleteMany({ where: { tenderId } });
    await deleteLedgerEntriesAdmin({
      bidderId: { in: [qualifiedBidderId, unqualifiedBidderId, staleBidderId, unpaidBidderId] },
    });
    await prisma.bidder.deleteMany({ where: { tenderId } });
    await prisma.tender.delete({ where: { id: tenderId } });
  });


  // ── Zod validation gates ────────────────────────────────────────────────────

  it("returns 400 when justification < 80 characters", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: qualifiedBidderId,
        justification: SHORT_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_AWARD_PAYLOAD");
    expect(body.error.message).toMatch(/80/);
  });

  it("returns 400 when standoutFactors is empty", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: qualifiedBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: [],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_AWARD_PAYLOAD");
    expect(body.error.message).toMatch(/standoutFactors/i);
  });


  // ── Gate 1: Qualified winner ────────────────────────────────────────────────

  it("returns 409 UNQUALIFIED_WINNER when bidder has no officerDecision", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: unqualifiedBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("UNQUALIFIED_WINNER");
  });

  // ── Gate 2: Fresh verification ──────────────────────────────────────────────

  it("returns 409 STALE_VERIFICATION when bidder has stale checks", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: staleBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("errors.awardBlockedStaleVerification");
  });


  // ── Gate 3: Fee paid ────────────────────────────────────────────────────────

  it("returns 409 FEE_UNPAID when winner fee payment is pending", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: unpaidBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("FEE_UNPAID");
  });

  // ── Happy path: primary award ───────────────────────────────────────────────

  it("POST /tenders/:id/award succeeds for qualified + fresh + paid winner", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: qualifiedBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.award.winningBidderId).toBe(qualifiedBidderId);
    expect(body.data.stage).toBe("primary_award");
    expect(body.data.ledgerId).toBeDefined();

    // Tender status updated
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    expect(tender!.status).toBe("evaluation_awarded_pending_2nd");
  });

  // ── Dual-officer: same officer cannot second-approve ───────────────────────

  it("POST /tenders/:id/award/second-approval returns 403 for same officer", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award/second-approval`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
    });
    expect(res.status).toBe(403);
  });

  // ── Happy path: secondary approval ─────────────────────────────────────────

  it("POST /tenders/:id/award/second-approval finalizes award with different officer", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award/second-approval`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer2Token}`, "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.stage).toBe("secondary_award_finalized");
    expect(body.data.award.finalizedAt).toBeDefined();

    // Tender status updated to awarded
    const tender = await prisma.tender.findUnique({ where: { id: tenderId } });
    expect(tender!.status).toBe("awarded");

    // Ledger entry written
    const ledger = await prisma.ledgerEntry.findFirst({
      where: { bidderId: qualifiedBidderId, action: "award_decision_secondary" },
    });
    expect(ledger).not.toBeNull();
  });

  // ── Idempotency: cannot re-award finalized tender ──────────────────────────

  it("returns 409 when trying to primary-award an already-finalized tender", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${tenderId}/award`, {
      method: "POST",
      headers: { Authorization: `Bearer ${officer1Token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        winningBidderId: qualifiedBidderId,
        justification: GOOD_JUSTIFICATION,
        standoutFactors: GOOD_FACTORS,
      }),
    });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.message).toMatch(/finalized/i);
  });
});
