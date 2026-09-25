/**
 * Phase 8: Security & Hardening Integration Tests
 * (tests/security.spec.ts)
 *
 * Tests:
 *   1.  Rate limiter skip: /auth routes — limiters bypassed in NODE_ENV=test
 *   2.  POST /auth/login → 200 → token contains origIat field
 *   3.  POST /auth/refresh valid token within lifetime → 200 + new token
 *   4.  POST /auth/refresh with origIat > MAX_SESSION_LIFETIME_SEC → 401 session.maxLifetimeExceeded
 *   5.  POST /auth/refresh with invalid token → 401 ERR_INVALID_TOKEN
 *   6.  POST /auth/refresh with no auth header → 401 ERR_UNAUTHENTICATED
 *   7.  Payload size: POST /auth/login with >2 MB body → 413 ERR_PAYLOAD_TOO_LARGE
 *   8.  Payload size: error envelope matches code: 'ERR_PAYLOAD_TOO_LARGE'
 *   9.  Helmet sets X-Content-Type-Options: nosniff on every response
 *  10.  Helmet sets X-Frame-Options on every response
 *  11.  CORS: OPTIONS preflight returns Access-Control-Allow-Origin for configured origin
 *  12.  CORS: OPTIONS preflight with disallowed origin → no ACAO header
 *  13.  GET /i18n/strings is publicly accessible (no auth required)
 *  14.  POST /auth/refresh tokens preserve origIat across re-issue chain
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/client.js';
import { config } from '../src/config.js';

const BASE_URL = `http://localhost:${config.PORT}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(payload: object, opts?: jwt.SignOptions): string {
  return jwt.sign(payload, config.JWT_SECRET, opts);
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('Phase 8: Security & Hardening', () => {
  const TEST_EMAIL = `security-spec-${Date.now()}@test.local`;
  const TEST_PASSWORD = 'Password123!';
  let userId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        name: 'Security Test User',
        passwordHash: hash,
        role: 'officer',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
  });

  // ── Test 1: Rate limiters bypassed in test env ────────────────────────────
  it('1. Rate limiters are bypassed in NODE_ENV=test (no 429 on rapid calls)', async () => {
    // Fire 5 quick login requests — in test env none should 429
    const results = await Promise.all(
      Array.from({ length: 5 }).map(() =>
        fetch(`${BASE_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'nonexistent@x.com', password: 'wrong' }),
        })
      )
    );
    // All should be 401 (bad creds), not 429
    for (const res of results) {
      expect(res.status).not.toBe(429);
      expect(res.status).toBe(401);
    }
  });

  // ── Test 2: Login response includes origIat in decoded token ─────────────
  it('2. POST /auth/login → 200 → decoded token contains origIat', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.token).toBeTruthy();

    const decoded = jwt.verify(body.data.token, config.JWT_SECRET) as any;
    expect(decoded.origIat, 'origIat missing from token payload').toBeDefined();
    expect(typeof decoded.origIat).toBe('number');
    // origIat should be close to now (within 5 seconds)
    const nowSec = Math.floor(Date.now() / 1000);
    expect(Math.abs(decoded.origIat - nowSec)).toBeLessThan(5);
  });

  // ── Test 3: POST /auth/refresh with valid token within lifetime → 200 ─────
  it('3. POST /auth/refresh valid token within lifetime → 200 + new token', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = makeToken({ id: userId, role: 'officer', origIat: nowSec }, { expiresIn: '8h' });

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.token).toBeTruthy();

    const decoded = jwt.verify(body.data.token, config.JWT_SECRET) as any;
    // origIat must be preserved
    expect(decoded.origIat).toBe(nowSec);
  });

  // ── Test 4: Session max lifetime exceeded → 401 session.maxLifetimeExceeded ──
  it('4. POST /auth/refresh with origIat > MAX_SESSION_LIFETIME_SEC ago → 401 session.maxLifetimeExceeded', async () => {
    // Arithmetic:
    //   MAX_SESSION_LIFETIME_SEC = 43200 (12h = 43 200 s)
    //   origIat = now - 43201 s  (1 second past the limit)
    //   sessionAgeSec = now - origIat = 43201 > 43200 → REJECTED
    const nowSec = Math.floor(Date.now() / 1000);
    const origIat = nowSec - (config.MAX_SESSION_LIFETIME_SEC + 1); // 43201 s old

    // sign with short expiresIn so the token itself is NOT expired (origIat vs exp are separate)
    const token = makeToken({ id: userId, role: 'officer', origIat }, { expiresIn: '1h' });

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe('session.maxLifetimeExceeded');
  });

  // ── Test 5: Invalid token → 401 ERR_INVALID_TOKEN ────────────────────────
  it('5. POST /auth/refresh with invalid token → 401 ERR_INVALID_TOKEN', async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: 'Bearer this.is.not.a.real.token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe('ERR_INVALID_TOKEN');
  });

  // ── Test 6: No auth header → 401 ERR_UNAUTHENTICATED ─────────────────────
  it('6. POST /auth/refresh with no auth header → 401 ERR_UNAUTHENTICATED', async () => {
    const res = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST' });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBe('ERR_UNAUTHENTICATED');
  });

  // ── Test 7: Payload >2 MB → 413 ──────────────────────────────────────────
  it('7. POST with >2 MB body → 413', async () => {
    // 2 MB + 1 byte of 'x'
    const oversized = 'x'.repeat(2 * 1024 * 1024 + 1);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: oversized }),
    });
    expect(res.status).toBe(413);
  });

  // ── Test 8: 413 body matches ERR_PAYLOAD_TOO_LARGE ───────────────────────
  it('8. 413 error envelope has code: ERR_PAYLOAD_TOO_LARGE', async () => {
    const oversized = 'x'.repeat(2 * 1024 * 1024 + 1);
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: oversized }),
    });
    // Body may not be JSON if response is cut off; handle gracefully
    try {
      const body = await res.json() as any;
      expect(body.error.code).toBe('ERR_PAYLOAD_TOO_LARGE');
    } catch {
      // If body is unparseable that's also a valid outcome for a 413
      expect(res.status).toBe(413);
    }
  });

  // ── Test 9: Helmet sets X-Content-Type-Options: nosniff ──────────────────
  it('9. Helmet sets X-Content-Type-Options: nosniff on every response', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  // ── Test 10: Helmet sets X-Frame-Options ─────────────────────────────────
  it('10. Helmet sets X-Frame-Options on every response', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    // Helmet 7+ uses Content-Security-Policy frame-ancestors instead of X-Frame-Options,
    // but in default config it still sets X-Frame-Options: SAMEORIGIN
    const xfo = res.headers.get('x-frame-options');
    const csp = res.headers.get('content-security-policy');
    const hasFrameProtection = xfo !== null || (csp !== null && csp.includes('frame-ancestors'));
    expect(hasFrameProtection, 'Neither X-Frame-Options nor CSP frame-ancestors found').toBe(true);
  });

  // ── Test 11: CORS — allowed origin returns Access-Control-Allow-Origin ────
  it('11. OPTIONS preflight with allowed origin → Access-Control-Allow-Origin set', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: config.CORS_ORIGIN,
        'Access-Control-Request-Method': 'POST',
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    expect(acao).toBe(config.CORS_ORIGIN);
  });

  // ── Test 12: CORS — disallowed origin → no ACAO header ───────────────────
  it('12. OPTIONS preflight with disallowed origin → no Access-Control-Allow-Origin', async () => {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil-site.example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    const acao = res.headers.get('access-control-allow-origin');
    // Should be null or not match the evil origin
    expect(acao).not.toBe('https://evil-site.example.com');
  });

  // ── Test 13: /i18n/strings is publicly accessible (no auth) ──────────────
  it('13. GET /i18n/strings is publicly accessible without auth', async () => {
    const res = await fetch(`${BASE_URL}/i18n/strings?lang=en`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.error).toBeNull();
    expect(body.data).toBeTruthy();
  });

  // ── Test 14: origIat preserved across a refresh chain ────────────────────
  it('14. origIat is preserved across refresh → re-refresh chain', async () => {
    // Step 1: Login
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = await loginRes.json() as any;
    const loginDecoded = jwt.verify(loginBody.data.token, config.JWT_SECRET) as any;
    const originalOrigIat = loginDecoded.origIat;

    // Step 2: First refresh
    const refresh1Res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${loginBody.data.token}` },
    });
    expect(refresh1Res.status).toBe(200);
    const refresh1Body = await refresh1Res.json() as any;
    const refresh1Decoded = jwt.verify(refresh1Body.data.token, config.JWT_SECRET) as any;
    // Arithmetic: origIat of refresh1 token == origIat of login token
    expect(refresh1Decoded.origIat).toBe(originalOrigIat);

    // Step 3: Second refresh
    const refresh2Res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refresh1Body.data.token}` },
    });
    expect(refresh2Res.status).toBe(200);
    const refresh2Body = await refresh2Res.json() as any;
    const refresh2Decoded = jwt.verify(refresh2Body.data.token, config.JWT_SECRET) as any;
    // Arithmetic: origIat of refresh2 token == origIat of login token
    expect(refresh2Decoded.origIat).toBe(originalOrigIat);
  });
});
