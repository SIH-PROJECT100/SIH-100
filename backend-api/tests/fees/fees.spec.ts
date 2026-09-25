import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { prisma } from "../../src/db/client.js";
import { deleteLedgerEntriesAdmin } from "../helpers/adminDb.js";
import { config } from "../../src/config.js";

const BASE_URL = `http://localhost:${config.PORT}`;

describe("Phase 4: Application Fees (Feature 3)", () => {
  const officerToken = jwt.sign({ id: "user-officer-001", role: "officer" }, config.JWT_SECRET);
  const adminToken   = jwt.sign({ id: "user-admin-001",   role: "admin"   }, config.JWT_SECRET);

  // We create a fee-bearing tender + bidder for the test
  let feeTenderId: string;
  let feeBidderId: string;
  let paymentId: string;

  beforeAll(async () => {
    // Create a tender with a non-zero application fee
    const tender = await prisma.tender.create({
      data: {
        title: "Fee-Bearing Test Tender",
        gemTenderId: `GEM-FEE-TEST-${Date.now()}`,
        status: "open",
        applicationFee: 500,
      },
    });
    feeTenderId = tender.id;

    // Create a bidder for that tender
    const bidder = await prisma.bidder.create({
      data: {
        companyName: "FeeTest Corp",
        overallRisk: "low",
        riskScore: 0.1,
        tenderId: feeTenderId,
        checks: [],
      },
    });
    feeBidderId = bidder.id;
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    await prisma.applicationFeePayment.deleteMany({ where: { tenderId: feeTenderId } });
    await deleteLedgerEntriesAdmin({ bidderId: feeBidderId });
    await prisma.bidder.delete({ where: { id: feeBidderId } });
    await prisma.tender.delete({ where: { id: feeTenderId } });
  });


  // ── Apply / Payment Creation ────────────────────────────────────────────────

  it("POST /tenders/:id/apply creates a pending payment record", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${feeTenderId}/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bidderId: feeBidderId }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data.status).toBe("pending");
    expect(body.data.amount).toBe(500);
    expect(body.data.paymentId).toBeDefined();
    expect(body.data.mockGatewayUrl).toBeDefined();
    paymentId = body.data.paymentId;
  });

  it("POST /tenders/:id/apply is idempotent — returns existing payment on second call", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${feeTenderId}/apply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bidderId: feeBidderId }),
    });
    expect(res.status).toBe(200); // returns existing, not new
    const body = await res.json();
    expect(body.data.paymentId).toBe(paymentId);
  });

  // ── Fee Gate: bidder visibility ─────────────────────────────────────────────

  it("GET /tenders/:id/bidders hides unpaid bidder when applicationFee > 0", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${feeTenderId}/bidders`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.data.map((b: any) => b.id);
    expect(ids).not.toContain(feeBidderId);
  });

  // ── Fee Gate: verify gate (402) ─────────────────────────────────────────────

  it("POST /bidders/:id/verify returns 402 when fee is unpaid", async () => {
    const res = await fetch(`${BASE_URL}/bidders/${feeBidderId}/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error.code).toBe("PAYMENT_REQUIRED");
  });

  // ── Mock-Confirm payment ────────────────────────────────────────────────────

  it("POST /payments/mock-confirm transitions payment to paid and writes two ledger entries", async () => {
    const res = await fetch(`${BASE_URL}/payments/mock-confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.payment.status).toBe("paid");

    // Verify two ledger entries: fee_paid + fee_transition
    const entries = await prisma.ledgerEntry.findMany({
      where: { bidderId: feeBidderId },
      orderBy: { createdAt: "asc" },
    });
    const actions = entries.map((e) => e.action);
    expect(actions).toContain("fee_paid");
    expect(actions).toContain("fee_transition");

    const transition = entries.find((e) => e.action === "fee_transition");
    expect((transition!.detail as any).from).toBe("pending");
    expect((transition!.detail as any).to).toBe("paid");
  });

  // ── Paid bidder becomes visible ─────────────────────────────────────────────

  it("GET /tenders/:id/bidders shows paid bidder after fee confirmation", async () => {
    const res = await fetch(`${BASE_URL}/tenders/${feeTenderId}/bidders`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const ids: string[] = body.data.map((b: any) => b.id);
    expect(ids).toContain(feeBidderId);
  });

  // ── Refund (admin) ──────────────────────────────────────────────────────────

  it("POST /admin/payments/:id/refund (action=refund) transitions to refunded", async () => {
    const res = await fetch(`${BASE_URL}/admin/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "refund", reason: "Test refund" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.payment.status).toBe("refunded");

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { bidderId: feeBidderId, action: "fee_transition" },
      orderBy: { createdAt: "desc" },
    });
    expect((ledger!.detail as any).to).toBe("refunded");
    expect((ledger!.detail as any).from).toBe("paid");
    expect((ledger!.detail as any).reason).toBe("Test refund");
  });

  it("POST /admin/payments/:id/refund returns 403 for non-admin", async () => {
    const res = await fetch(`${BASE_URL}/admin/payments/${paymentId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "refund" }),
    });
    expect(res.status).toBe(403);
  });
});
