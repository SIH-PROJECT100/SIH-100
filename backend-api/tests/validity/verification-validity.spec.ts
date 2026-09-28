import { describe, it, expect, beforeAll, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import { prisma } from "../../src/db/client.js";
import { adminPrisma, deleteLedgerEntriesAdmin } from "../helpers/adminDb.js";
import { config } from "../../src/config.js";
import {
  computeVerificationStatus,
  getCategoryValidityDays,
  computeExpiresAt,
} from "../../src/services/validity/validity.js";
import { runVerificationExpiryNoticeScan } from "../../src/services/validity/cron.js";

const BASE_URL = `http://localhost:${config.PORT}`;
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Unit: pure functions ─────────────────────────────────────────────────────

describe("Phase 4: Validity — getCategoryValidityDays", () => {
  it("msme = 1825 days", () => expect(getCategoryValidityDays("msme")).toBe(1825));
  it("gst = 365 days", () => expect(getCategoryValidityDays("gst")).toBe(365));
  it("pan_itr = 365 days", () => expect(getCategoryValidityDays("pan_itr")).toBe(365));
  it("blacklist = 90 days", () => expect(getCategoryValidityDays("blacklist")).toBe(90));
  it("make_in_india = 365 days", () => expect(getCategoryValidityDays("make_in_india")).toBe(365));
  it("unknown defaults to 365 days", () => expect(getCategoryValidityDays("unknown_xyz")).toBe(365));
  it("null/undefined defaults to 365 days", () => {
    expect(getCategoryValidityDays(null)).toBe(365);
    expect(getCategoryValidityDays(undefined)).toBe(365);
  });
  it("custom rule overrides default", () => expect(getCategoryValidityDays("gst", { gst: 180 })).toBe(180));
  it("lookup is case-insensitive", () => {
    expect(getCategoryValidityDays("MSME")).toBe(1825);
    expect(getCategoryValidityDays("Blacklist")).toBe(90);
  });
});

describe("Phase 4: Validity — computeExpiresAt", () => {
  it("computes gst expiry as exactly 365 days later", () => {
    const verifiedAt = new Date("2024-01-01T00:00:00.000Z");
    const result = computeExpiresAt("gst", verifiedAt);
    expect(new Date(result).getTime()).toBe(verifiedAt.getTime() + 365 * DAY_MS);
  });
  it("computes msme expiry as exactly 1825 days later", () => {
    const verifiedAt = new Date("2024-01-01T00:00:00.000Z");
    const result = computeExpiresAt("msme", verifiedAt);
    expect(new Date(result).getTime()).toBe(verifiedAt.getTime() + 1825 * DAY_MS);
  });
});

describe("Phase 4: Validity — computeVerificationStatus", () => {
  const now = new Date();

  it("returns 'expired' for empty checks", () => {
    expect(computeVerificationStatus([])).toBe("expired");
  });
  it("returns 'expired' for null/undefined", () => {
    expect(computeVerificationStatus(null)).toBe("expired");
    expect(computeVerificationStatus(undefined)).toBe("expired");
  });
  it("returns 'fresh' when all checks expire in the future", () => {
    const checks = [
      { verificationExpiresAt: new Date(now.getTime() + 100 * DAY_MS).toISOString() },
      { verificationExpiresAt: new Date(now.getTime() + 200 * DAY_MS).toISOString() },
    ];
    expect(computeVerificationStatus(checks)).toBe("fresh");
  });
  it("returns 'stale' when one check is within the 30-day grace window", () => {
    const checks = [
      { verificationExpiresAt: new Date(now.getTime() - 15 * DAY_MS).toISOString() },
      { verificationExpiresAt: new Date(now.getTime() + 100 * DAY_MS).toISOString() },
    ];
    expect(computeVerificationStatus(checks)).toBe("stale");
  });
  it("returns 'expired' when one check is > 30 days past expiresAt", () => {
    const checks = [
      { verificationExpiresAt: new Date(now.getTime() - 45 * DAY_MS).toISOString() },
      { verificationExpiresAt: new Date(now.getTime() + 100 * DAY_MS).toISOString() },
    ];
    expect(computeVerificationStatus(checks)).toBe("expired");
  });
  it("returns 'expired' when a check has missing expiresAt", () => {
    const checks = [
      { verificationExpiresAt: null },
      { verificationExpiresAt: new Date(now.getTime() + 100 * DAY_MS).toISOString() },
    ];
    expect(computeVerificationStatus(checks)).toBe("expired");
  });
  it("'expired' takes precedence over 'stale'", () => {
    const checks = [
      { verificationExpiresAt: new Date(now.getTime() - 15 * DAY_MS).toISOString() },
      { verificationExpiresAt: new Date(now.getTime() - 45 * DAY_MS).toISOString() },
    ];
    expect(computeVerificationStatus(checks)).toBe("expired");
  });
  it("accepts a custom reference date", () => {
    const referenceDate = new Date("2025-01-01T00:00:00.000Z");
    const checks = [{ verificationExpiresAt: "2024-12-01T00:00:00.000Z" }];
    // 31 days before reference → past 30-day grace → expired
    expect(computeVerificationStatus(checks, referenceDate)).toBe("expired");
  });
});

// ─── Integration: reverify + cron ────────────────────────────────────────────

describe("Phase 4: Validity — Integration", () => {
  const officerToken = jwt.sign({ id: "user-officer-001", role: "officer" }, config.JWT_SECRET);
  const testBidderId = "bidder-001";
  // Anchor used to filter ledger entries created during THIS test run
  let testStartTime: Date;

  beforeAll(async () => {
    testStartTime = new Date();
    try {
      await deleteLedgerEntriesAdmin({ bidderId: testBidderId, action: "verification_expiry_notice" });
    } catch {}

    // Ensure bidder exists
    let bidder = await prisma.bidder.findUnique({ where: { id: testBidderId } });
    if (!bidder) {
      // Ensure tender exists first
      const t = await prisma.tender.findFirst();
      const tid = t?.id || 'tender-001';
      bidder = await prisma.bidder.create({
        data: {
          id: testBidderId,
          tenderId: tid,
          companyName: 'Test Bidder for Phase 4',
          pan: 'AAATT0001B',
          gstin: '18AATCS0001B1Z5',
          overallRisk: 'low',
          riskScore: 0.1,
          quotedPrice: 100000,
          submissionIp: '127.0.0.1',
          approvalState: 'pending',
          checks: [],
        },
      });
    }

    await prisma.bidder.update({
      where: { id: testBidderId },
      data: {
        checks: [
          {
            category: "gst",
            status: "verified",
            verifiedAt: new Date().toISOString(),
            verificationExpiresAt: new Date(Date.now() + 300 * DAY_MS).toISOString(),
          },
        ],
      },
    });
  });

  afterAll(async () => {
    await deleteLedgerEntriesAdmin({ bidderId: testBidderId, action: "verification_expiry_notice" });
  });

  it("POST /bidders/:id/reverify returns 200 with verificationStatus for officer", async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/reverify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${officerToken}`,
        "Content-Type": "application/json",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(["fresh", "stale", "expired"]).toContain(body.data.verificationStatus);
  });

  it("POST /bidders/:id/reverify returns 401 for unauthenticated caller", async () => {
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/reverify`, {
      method: "POST",
    });
    expect(res.status).toBe(401);
  });

  it("POST /bidders/:id/reverify returns 403 for non-officer caller", async () => {
    const bidderToken = jwt.sign({ id: "some-bidder-user", role: "bidder" }, config.JWT_SECRET);
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/reverify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    expect(res.status).toBe(403);
  });

  it("cron emits verification_expiry_notice for stale bidder", async () => {
    // Force bidder into stale window: expired 10 days ago (within 30-day grace)
    await prisma.bidder.update({
      where: { id: testBidderId },
      data: {
        checks: [
          {
            category: "blacklist",
            status: "verified",
            verifiedAt: new Date(Date.now() - 100 * DAY_MS).toISOString(),
            verificationExpiresAt: new Date(Date.now() - 10 * DAY_MS).toISOString(),
          },
        ],
      },
    });

    const count = await runVerificationExpiryNoticeScan();
    expect(count).toBeGreaterThanOrEqual(1);

    const notice = await prisma.ledgerEntry.findFirst({
      where: {
        bidderId: testBidderId,
        action: "verification_expiry_notice",
        createdAt: { gte: testStartTime },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(notice).not.toBeNull();
    expect((notice!.detail as any).status).toBe("stale");
  });

  it("cron does not emit duplicate notice for same bidder on same day", async () => {
    const count = await runVerificationExpiryNoticeScan();
    // This bidder already has a notice for today — count must be 0
    expect(count).toBe(0);
  });
});



