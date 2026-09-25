/**
 * Phase 8: Live Rate Limiting Integration Tests (tests/security/rate-limit-live.spec.ts)
 *
 * Verifies real 429 status enforcement across all 4 critical endpoints:
 * 1. POST /auth/login — 20 req/15min (per IP) -> 21st call gets 429 (rateLimit.login)
 * 2. POST /bidders/:id/verify — 5 req/1min (per user) -> 6th call gets 429 (rateLimit.exceeded)
 * 3. POST /tenders/:id/detect-collusion — 3 req/1min (per user) -> 4th call gets 429 (rateLimit.exceeded)
 * 4. GET /bidder/me/vault/:tenderId/report — 10 req/1min (per user) -> 11th call gets 429 (rateLimit.exceeded)
 *
 * All tests assert:
 * - 429 response status
 * - Retry-After header with positive integer value
 * - Correct glossary error code in response envelope
 * - Next request succeeds after waiting Retry-After duration
 */

import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import { prisma } from '../../src/db/client.js';

const BASE_URL = `http://localhost:${config.PORT}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Phase 8: Rate-Limit Live Integration Tests', () => {
  let officerToken: string;
  let bidderToken: string;
  let testTenderId: string;
  let testBidderId: string;

  beforeAll(async () => {
    const officerId = `rate-officer-${Date.now()}`;
    const bidderId = `rate-bidder-${Date.now()}`;
    officerToken = jwt.sign({ id: officerId, role: 'officer' }, config.JWT_SECRET);
    bidderToken = jwt.sign({ id: bidderId, role: 'bidder' }, config.JWT_SECRET);

    const tender = await prisma.tender.create({
      data: {
        title: 'Rate Limit Test Tender',
        gemTenderId: `GEM-RATE-${Date.now()}`,
        status: 'open',
        applicationFee: 0,
      },
    });
    testTenderId = tender.id;

    const bidder = await prisma.bidder.create({
      data: {
        companyName: 'Rate Limit Test Corp',
        pan: `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`,
        overallRisk: 'low',
        approvalState: 'pending',
        tenderId: testTenderId,
      },
    });
    testBidderId = bidder.id;

    // Seed ledger entry for vault report association
    await prisma.ledgerEntry.create({
      data: {
        bidderId: testBidderId,
        actorType: 'bidder',
        actorId: bidderId,
        action: 'verification_run',
        detail: { note: 'Rate limit test fixture' },
      },
    });
  });

  // ─── 1. /auth/login (20 req limit) ─────────────────────────────────────────
  it('1. /auth/login triggers 429 on 21st request, provides Retry-After, recovers after wait', async () => {
    // Send 20 rapid requests to exhaust the limit
    for (let i = 0; i < 20; i++) {
      await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-enable-rate-limit': 'true',
        },
        body: JSON.stringify({ email: 'officer@gem.gov.in', password: 'bad-password' }),
      });
    }

    // 21st request MUST trigger 429
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
      body: JSON.stringify({ email: 'officer@gem.gov.in', password: 'bad-password' }),
    });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('rateLimit.login');

    // Wait for window to expire
    await sleep((retryAfter + 1) * 1000);

    // Next request must not be rate limited
    const recoveryRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
      body: JSON.stringify({ email: 'officer@gem.gov.in', password: 'bad-password' }),
    });
    expect(recoveryRes.status).not.toBe(429);
  }, 60000);

  // ─── 2. POST /bidders/:id/verify (5 req limit) ──────────────────────────────
  it('2. POST /bidders/:id/verify triggers 429 on 6th request, provides Retry-After, recovers after wait', async () => {
    // Send 5 rapid requests to exhaust the limit
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/bidders/${testBidderId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
          'x-enable-rate-limit': 'true',
        },
      });
    }

    // 6th request MUST trigger 429
    const res = await fetch(`${BASE_URL}/bidders/${testBidderId}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('rateLimit.exceeded');

    // Wait for window to expire
    await sleep((retryAfter + 1) * 1000);

    // Next request must not be rate limited
    const recoveryRes = await fetch(`${BASE_URL}/bidders/${testBidderId}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });
    expect(recoveryRes.status).not.toBe(429);
  }, 60000);

  // ─── 3. POST /tenders/:id/detect-collusion (3 req limit) ────────────────────
  it('3. POST /tenders/:id/detect-collusion triggers 429 on 4th request, provides Retry-After, recovers after wait', async () => {
    // Send 3 rapid requests to exhaust the limit
    for (let i = 0; i < 3; i++) {
      await fetch(`${BASE_URL}/tenders/${testTenderId}/detect-collusion`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${officerToken}`,
          'Content-Type': 'application/json',
          'x-enable-rate-limit': 'true',
        },
      });
    }

    // 4th request MUST trigger 429
    const res = await fetch(`${BASE_URL}/tenders/${testTenderId}/detect-collusion`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('rateLimit.exceeded');

    // Wait for window to expire
    await sleep((retryAfter + 1) * 1000);

    // Next request must not be rate limited
    const recoveryRes = await fetch(`${BASE_URL}/tenders/${testTenderId}/detect-collusion`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });
    expect(recoveryRes.status).not.toBe(429);
  }, 60000);

  // ─── 4. GET /bidder/me/vault/:tenderId/report (10 req limit) ────────────────
  it('4. GET /bidder/me/vault/:tenderId/report triggers 429 on 11th request, provides Retry-After, recovers after wait', async () => {
    // Send 10 rapid requests to exhaust the limit
    for (let i = 0; i < 10; i++) {
      await fetch(`${BASE_URL}/bidder/me/vault/${testTenderId}/report`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bidderToken}`,
          'x-enable-rate-limit': 'true',
        },
      });
    }

    // 11th request MUST trigger 429
    const res = await fetch(`${BASE_URL}/bidder/me/vault/${testTenderId}/report`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bidderToken}`,
        'x-enable-rate-limit': 'true',
      },
    });

    expect(res.status).toBe(429);
    const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
    expect(retryAfter).toBeGreaterThan(0);

    const body = (await res.json()) as any;
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('rateLimit.exceeded');

    // Wait for window to expire
    await sleep((retryAfter + 1) * 1000);

    // Next request must not be rate limited
    const recoveryRes = await fetch(`${BASE_URL}/bidder/me/vault/${testTenderId}/report`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bidderToken}`,
        'x-enable-rate-limit': 'true',
      },
    });
    expect(recoveryRes.status).not.toBe(429);
  }, 60000);
});
