import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/db/client.js';
import { verifyBidder } from '../../src/services/verification/orchestrator.js';

describe('Tier 1-4: Orchestrator End-to-End & Performance Gate (T2.5)', () => {
  let seededBidder: any;

  beforeAll(async () => {
    // Find an existing seeded bidder
    seededBidder = await prisma.bidder.findFirst({
      include: { tender: true },
    });

    if (!seededBidder) {
      throw new Error('No seeded bidder found in database. Run db:seed before running E2E tests.');
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('runs full verification on a seeded bidder exercising all 4 tiers and appends verification_run ledger entry', async () => {
    const preCount = await prisma.ledgerEntry.count({
      where: {
        bidderId: seededBidder.id,
        action: 'verification_run',
      },
    });

    const result = await verifyBidder(seededBidder.id, { force: true });

    expect(result).toBeDefined();
    expect(result.id).toBe(seededBidder.id);
    expect(result.verifiedAt).toBeDefined();
    expect(Array.isArray(result.checks)).toBe(true);
    expect((result.checks as any[]).length).toBeGreaterThan(0);

    // Verify ledger entry appended
    const postCount = await prisma.ledgerEntry.count({
      where: {
        bidderId: seededBidder.id,
        action: 'verification_run',
      },
    });
    expect(postCount).toBe(preCount + 1);

    // Fetch the newly appended verification_run ledger entry
    const ledgerEntry = await prisma.ledgerEntry.findFirst({
      where: {
        bidderId: seededBidder.id,
        action: 'verification_run',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    expect(ledgerEntry).toBeDefined();
    const detail = ledgerEntry!.detail as Record<string, any>;
    expect(detail).toBeDefined();

    // Assert detail contains all required fields from gate criteria
    expect(detail.promptVersions).toBeDefined();
    expect(detail.promptVersions.extract).toBeDefined();
    expect(detail.promptVersions.evidence).toBeDefined();

    expect(detail.tiersRun).toBeDefined();
    expect(Array.isArray(detail.tiersRun)).toBe(true);
    expect(detail.tiersRun).toContain('digilocker');
    expect(detail.tiersRun).toContain('portal');
    expect(detail.tiersRun).toContain('ai_extraction');
    expect(detail.tiersRun).toContain('simulated');

    expect(detail.tiersSucceeded).toBeDefined();
    expect(Array.isArray(detail.tiersSucceeded)).toBe(true);

    expect(detail.tiersFailed).toBeDefined();
    expect(Array.isArray(detail.tiersFailed)).toBe(true);

    expect(typeof detail.totalDurationMs).toBe('number');
    expect(typeof detail.checksProduced).toBe('number');
    expect(detail.checksProduced).toBeGreaterThan(0);

    expect(detail.previousChecks).toBeDefined();
    expect(Array.isArray(detail.previousChecks)).toBe(true);
  });

  it('runs timing gate across 10 verification runs (avg < 8000ms, p95 < 8000ms)', async () => {
    const RUN_COUNT = 10;
    const latencies: number[] = [];

    for (let i = 0; i < RUN_COUNT; i++) {
      const start = performance.now();
      await verifyBidder(seededBidder.id, { force: true });
      const duration = performance.now() - start;
      latencies.push(duration);
    }

    const sum = latencies.reduce((acc, val) => acc + val, 0);
    const avgLatency = Math.round((sum / RUN_COUNT) * 100) / 100;

    // Calculate p95
    const sorted = [...latencies].sort((a, b) => a - b);
    const p95Index = Math.min(Math.ceil(0.95 * RUN_COUNT) - 1, RUN_COUNT - 1);
    const p95Latency = Math.round(sorted[p95Index] * 100) / 100;

    console.log(`[Timing Gate] 10 verification runs completed:`);
    console.log(`  Latencies: ${latencies.map((l) => `${Math.round(l)}ms`).join(', ')}`);
    console.log(`  Average Latency: ${avgLatency}ms`);
    console.log(`  P95 Latency: ${p95Latency}ms`);

    expect(avgLatency).toBeLessThan(8000);
    expect(p95Latency).toBeLessThan(8000);
  }, 120000); // 120s timeout for 10 runs
});
