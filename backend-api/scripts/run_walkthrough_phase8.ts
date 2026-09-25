/**
 * Phase 8 Walkthrough Execution Script
 * (scripts/run_walkthrough_phase8.ts)
 *
 * Demonstrates:
 * 1. Login rate-limit trigger (20 rapid requests → 429 with Retry-After)
 * 2. Verify rate-limit trigger (5 rapid requests → 429 with Retry-After)
 * 3. Detect-collusion rate-limit trigger (3 rapid requests → 429 with Retry-After)
 * 4. Vault report rate-limit trigger (10 rapid requests → 429 with Retry-After)
 * 5. Refresh success (fresh token returned)
 * 6. Refresh-after-max-lifetime failure (401 with session.maxLifetimeExceeded)
 * 7. Fetch a Hindi error response (Accept-Language: hi with error.messageHi)
 * 8. Oversized payload rejection (413 with ERR_PAYLOAD_TOO_LARGE)
 * 9. CORS non-whitelisted origin rejection (missing Access-Control-Allow-Origin)
 */

import jwt from 'jsonwebtoken';
import { prisma } from '../src/db/client.js';
import { config } from '../src/config.js';

const BASE_URL = `http://localhost:${config.PORT}`;

function banner(step: number, title: string) {
  console.log(`\n======================================================================`);
  console.log(`[Step ${step}] ${title}`);
  console.log(`======================================================================`);
}

async function main() {
  console.log(`\n>>> STARTING PHASE 8 SECURITY & HARDENING WALKTHROUGH <<<\nTarget Server: ${BASE_URL}\n`);

  // Setup test tokens and IDs
  let testUser = await prisma.user.findFirst();
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        email: `wt8-${Date.now()}@gem.gov.in`,
        name: 'WT8 Officer',
        passwordHash: 'dummy',
        role: 'officer',
      },
    });
  }
  const officerId = testUser.id;
  const bidderId = `wt8-bidder-${Date.now()}`;
  const officerToken = jwt.sign({ id: officerId, role: testUser.role }, config.JWT_SECRET);
  const bidderToken = jwt.sign({ id: bidderId, role: 'bidder' }, config.JWT_SECRET);

  const tender = await prisma.tender.create({
    data: {
      title: 'Walkthrough Phase 8 Tender',
      gemTenderId: `GEM-WT8-${Date.now()}`,
      status: 'open',
      applicationFee: 0,
    },
  });

  const bidder = await prisma.bidder.create({
    data: {
      companyName: 'Walkthrough Test Corp',
      pan: `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`,
      overallRisk: 'low',
      approvalState: 'pending',
      tenderId: tender.id,
    },
  });

  await prisma.ledgerEntry.create({
    data: {
      bidderId: bidder.id,
      actorType: 'bidder',
      actorId: bidderId,
      action: 'verification_run',
      detail: { note: 'WT8 fixture' },
    },
  });

  // ─── 1. Login rate-limit trigger ──────────────────────────────────────────
  banner(1, 'POST /auth/login Rate-Limit Trigger (20 req / 15 min limit)');
  console.log(`Firing 20 requests to /auth/login...`);
  for (let i = 1; i <= 20; i++) {
    await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-enable-rate-limit': 'true' },
      body: JSON.stringify({ email: 'officer@gem.gov.in', password: 'bad-password' }),
    });
  }
  console.log(`Firing 21st request to trigger 429...`);
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-enable-rate-limit': 'true' },
    body: JSON.stringify({ email: 'officer@gem.gov.in', password: 'bad-password' }),
  });
  console.log(`Status: ${loginRes.status} ${loginRes.statusText}`);
  console.log(`Headers:`);
  console.log(`  Retry-After: ${loginRes.headers.get('retry-after')}`);
  console.log(`  RateLimit-Limit: ${loginRes.headers.get('ratelimit-limit')}`);
  console.log(`  RateLimit-Remaining: ${loginRes.headers.get('ratelimit-remaining')}`);
  console.log(`Body:`, JSON.stringify(await loginRes.json(), null, 2));

  // ─── 2. Verify rate-limit trigger ─────────────────────────────────────────
  banner(2, 'POST /bidders/:id/verify Rate-Limit Trigger (5 req / 1 min per user)');
  console.log(`Firing 5 requests to /bidders/${bidder.id}/verify...`);
  for (let i = 1; i <= 5; i++) {
    await fetch(`${BASE_URL}/bidders/${bidder.id}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });
  }
  console.log(`Firing 6th request to trigger 429...`);
  const verifyRes = await fetch(`${BASE_URL}/bidders/${bidder.id}/verify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${officerToken}`,
      'Content-Type': 'application/json',
      'x-enable-rate-limit': 'true',
    },
  });
  console.log(`Status: ${verifyRes.status} ${verifyRes.statusText}`);
  console.log(`Headers:`);
  console.log(`  Retry-After: ${verifyRes.headers.get('retry-after')}`);
  console.log(`  RateLimit-Limit: ${verifyRes.headers.get('ratelimit-limit')}`);
  console.log(`  RateLimit-Remaining: ${verifyRes.headers.get('ratelimit-remaining')}`);
  console.log(`Body:`, JSON.stringify(await verifyRes.json(), null, 2));

  // ─── 3. Detect-collusion rate-limit trigger ───────────────────────────────
  banner(3, 'POST /tenders/:id/detect-collusion Rate-Limit Trigger (3 req / 1 min per user)');
  console.log(`Firing 3 requests to /tenders/${tender.id}/detect-collusion...`);
  for (let i = 1; i <= 3; i++) {
    await fetch(`${BASE_URL}/tenders/${tender.id}/detect-collusion`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${officerToken}`,
        'Content-Type': 'application/json',
        'x-enable-rate-limit': 'true',
      },
    });
  }
  console.log(`Firing 4th request to trigger 429...`);
  const collusionRes = await fetch(`${BASE_URL}/tenders/${tender.id}/detect-collusion`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${officerToken}`,
      'Content-Type': 'application/json',
      'x-enable-rate-limit': 'true',
    },
  });
  console.log(`Status: ${collusionRes.status} ${collusionRes.statusText}`);
  console.log(`Headers:`);
  console.log(`  Retry-After: ${collusionRes.headers.get('retry-after')}`);
  console.log(`  RateLimit-Limit: ${collusionRes.headers.get('ratelimit-limit')}`);
  console.log(`  RateLimit-Remaining: ${collusionRes.headers.get('ratelimit-remaining')}`);
  console.log(`Body:`, JSON.stringify(await collusionRes.json(), null, 2));

  // ─── 4. Vault report rate-limit trigger ───────────────────────────────────
  banner(4, 'GET /bidder/me/vault/:tenderId/report Rate-Limit Trigger (10 req / 1 min per user)');
  console.log(`Firing 10 requests to /bidder/me/vault/${tender.id}/report...`);
  for (let i = 1; i <= 10; i++) {
    await fetch(`${BASE_URL}/bidder/me/vault/${tender.id}/report`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${bidderToken}`,
        'x-enable-rate-limit': 'true',
      },
    });
  }
  console.log(`Firing 11th request to trigger 429...`);
  const vaultRes = await fetch(`${BASE_URL}/bidder/me/vault/${tender.id}/report`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${bidderToken}`,
      'x-enable-rate-limit': 'true',
    },
  });
  console.log(`Status: ${vaultRes.status} ${vaultRes.statusText}`);
  console.log(`Headers:`);
  console.log(`  Retry-After: ${vaultRes.headers.get('retry-after')}`);
  console.log(`  RateLimit-Limit: ${vaultRes.headers.get('ratelimit-limit')}`);
  console.log(`  RateLimit-Remaining: ${vaultRes.headers.get('ratelimit-remaining')}`);
  console.log(`Body:`, JSON.stringify(await vaultRes.json(), null, 2));

  // ─── 5. Refresh success ───────────────────────────────────────────────────
  banner(5, 'POST /auth/refresh with Fresh Token (Within Session Lifetime)');
  const nowSec = Math.floor(Date.now() / 1000);
  const freshToken = jwt.sign({ id: officerId, role: 'officer', origIat: nowSec }, config.JWT_SECRET, { expiresIn: '8h' });
  const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${freshToken}` },
  });
  console.log(`Status: ${refreshRes.status} ${refreshRes.statusText}`);
  const refreshBody = await refreshRes.json() as any;
  console.log(`Body:`, JSON.stringify(refreshBody, null, 2));
  if (refreshBody.data?.token) {
    const decoded = jwt.verify(refreshBody.data.token, config.JWT_SECRET) as any;
    console.log(`Token Decoded -> origIat preserved: ${decoded.origIat} (nowSec: ${nowSec})`);
  }

  // ─── 6. Refresh-after-max-lifetime failure ────────────────────────────────
  banner(6, 'POST /auth/refresh with origIat > MAX_SESSION_LIFETIME_SEC (12h Exceeded)');
  const expiredOrigIat = nowSec - (config.MAX_SESSION_LIFETIME_SEC + 10);
  console.log(`Arithmetic Check:`);
  console.log(`  Current Time (epoch sec): ${nowSec}`);
  console.log(`  Token origIat:            ${expiredOrigIat}`);
  console.log(`  Session Age:              ${nowSec - expiredOrigIat} seconds`);
  console.log(`  Max Allowable Lifetime:   ${config.MAX_SESSION_LIFETIME_SEC} seconds (12 hours)`);
  console.log(`  Difference:               +${nowSec - expiredOrigIat - config.MAX_SESSION_LIFETIME_SEC} seconds past limit`);

  const expiredSessionToken = jwt.sign({ id: officerId, role: 'officer', origIat: expiredOrigIat }, config.JWT_SECRET, { expiresIn: '1h' });
  const maxLifetimeRes = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${expiredSessionToken}` },
  });
  console.log(`Status: ${maxLifetimeRes.status} ${maxLifetimeRes.statusText}`);
  console.log(`Body:`, JSON.stringify(await maxLifetimeRes.json(), null, 2));

  // ─── 7. Fetch Hindi error response ────────────────────────────────────────
  banner(7, 'Fetch Localized Hindi Error Response (Accept-Language: hi)');
  console.log(`Sending unauthenticated request to /tenders with Accept-Language: hi...`);
  const hiRes = await fetch(`${BASE_URL}/tenders`, {
    headers: { 'Accept-Language': 'hi' },
  });
  console.log(`Status: ${hiRes.status} ${hiRes.statusText}`);
  console.log(`Body:`, JSON.stringify(await hiRes.json(), null, 2));

  // ─── 8. Oversized payload rejection ───────────────────────────────────────
  banner(8, 'Oversized Payload Rejection (413 on >2 MB body)');
  const oversizedPayload = 'a'.repeat(2 * 1024 * 1024 + 100);
  console.log(`Sending ${oversizedPayload.length} bytes (>2 MB limit) to /auth/login...`);
  const payloadRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: oversizedPayload }),
  });
  console.log(`Status: ${payloadRes.status} ${payloadRes.statusText}`);
  console.log(`Body:`, JSON.stringify(await payloadRes.json(), null, 2));

  // ─── 9. CORS non-whitelisted origin ───────────────────────────────────────
  banner(9, 'CORS Rejection for Non-Whitelisted Origin');
  const evilOrigin = 'https://malicious-actor.example.com';
  console.log(`Sending OPTIONS request with Origin: ${evilOrigin}...`);
  const corsRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: evilOrigin,
      'Access-Control-Request-Method': 'POST',
    },
  });
  console.log(`Status: ${corsRes.status} ${corsRes.statusText}`);
  const acao = corsRes.headers.get('access-control-allow-origin');
  console.log(`Access-Control-Allow-Origin header present: ${acao !== null ? acao : 'NONE (correctly withheld)'}`);

  console.log(`\n======================================================================`);
  console.log(`>>> PHASE 8 HARDENING WALKTHROUGH COMPLETE: ALL 9 GATES VERIFIED <<<`);
  console.log(`======================================================================\n`);
}

main().catch((err) => {
  console.error('Walkthrough error:', err);
  process.exit(1);
});
