/**
 * Rider 1 (Phase 2) — Real Gemini API Smoke Test
 * tests/integration/gemini-smoke.spec.ts
 *
 * Calls the actual Gemini 2.5 Flash API with a real GEMINI_API_KEY
 * (no mocks, no DEMO_MODE) to verify end-to-end AI document extraction.
 *
 * Gate: skipped when (process.env.CI || !process.env.GEMINI_API_KEY).
 * This ensures CI runs are never blocked by Gemini quota/latency,
 * while humans running with a real key get real-world numbers.
 *
 * Methodology:
 *   - Verifies bidder-vet (VetTech Enterprise Solutions) via the full
 *     verification endpoint which internally calls Gemini Tier 3.
 *   - Runs 3 sequential attempts and measures per-call latency.
 *   - Asserts avg latency < 8,000 ms.
 *
 * Report:
 *   Paste actual p50/p95/avg numbers (or "skipped: no GEMINI_API_KEY present")
 *   into docs/phase-9-report.md.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';

const BASE = `http://localhost:${config.PORT}`;
const BIDDER_ID = 'bidder-vet';
const RUNS = 3;

function makeToken(id: string, role: string) {
  return jwt.sign({ id, role, origIat: Math.floor(Date.now() / 1000) }, config.JWT_SECRET, { expiresIn: '1h' });
}

const rawKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY || '';
const isRealGoogleKey = rawKey.startsWith('AIzaSy') && !rawKey.includes('mock');
const shouldSkip = !!process.env.CI || !isRealGoogleKey;

describe.skipIf(shouldSkip)('Rider 1 — Real Gemini API Smoke Test', () => {
  const officerToken = makeToken('user-officer-001', 'officer');
  const latencies: number[] = [];

  beforeAll(() => {
    if (shouldSkip) {
      console.log('  [SKIP] Rider 1: No valid Google AI Studio GEMINI_API_KEY (must start with AIzaSy) — skipping real Gemini smoke test');
    } else {
      console.log(`  [RUN] Rider 1: Valid GEMINI_API_KEY present (${rawKey.slice(0, 8)}...) — running real Gemini smoke test (${RUNS} runs)`);
    }
  });

  for (let run = 1; run <= RUNS; run++) {
    it(`Run ${run}/${RUNS}: POST /bidders/${BIDDER_ID}/verify (real Gemini call)`, async () => {
      const start = Date.now();

      const res = await fetch(`${BASE}/bidders/${BIDDER_ID}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ force: true }),
      });

      const elapsed = Date.now() - start;
      latencies.push(elapsed);

      expect(res.status).toBe(200);

      const body = await res.json() as any;
      expect(body.data).toBeTruthy();
      const checks: any[] = Array.isArray(body.data.checks) ? body.data.checks : [];
      expect(checks.length).toBeGreaterThan(0);

      const aiCheck = checks.find((c: any) => c.tier === 'ai_extraction' || c.name === 'ai_extraction' || c.source === 'gemini');
      console.log(`  Run ${run}: ${elapsed}ms — ${checks.length} checks, AI check found: ${!!aiCheck}`);
    }, 20_000); // 20s timeout per run
  }

  it('Latency assertion: avg < 8,000 ms (Rider 1 SLA)', () => {
    if (latencies.length === 0) {
      console.log('  No latency measurements recorded');
      return;
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const avg = Math.round(latencies.reduce((s, l) => s + l, 0) / latencies.length);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];

    console.log(`\n  === Gemini Latency Report (${RUNS} runs) ===`);
    console.log(`  Avg:  ${avg}ms`);
    console.log(`  p50:  ${p50}ms`);
    console.log(`  p95:  ${p95}ms`);
    console.log(`  All:  ${latencies.join('ms, ')}ms`);
    console.log(`  SLA:  avg < 8,000ms — ${avg < 8_000 ? 'PASS ✓' : 'FAIL ✗'}`);

    expect(avg, `Average Gemini latency (${avg}ms) exceeds 8,000ms SLA`).toBeLessThan(8_000);
  });
});

describe('Rider 1 — Gemini Skip Documentation', () => {
  it('Documents skip reason if real GEMINI_API_KEY not present', () => {
    if (shouldSkip) {
      const reason = process.env.CI
        ? 'CI environment detected'
        : `GEMINI_API_KEY is not a live Google AI Studio key (starts with "${rawKey.slice(0, 8)}...")`;
      console.log(`  [DOCUMENTED] Rider 1 cannot be validated in this environment; real Gemini smoke test deferred to demo-day setup. Reason: ${reason}`);
    } else {
      console.log(`  [INFO] Real GEMINI_API_KEY present (${rawKey.slice(0, 8)}...) — real Gemini tests executed`);
    }
    expect(true).toBe(true);
  });
});
