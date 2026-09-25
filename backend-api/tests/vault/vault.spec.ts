/**
 * Vault spec — tests:
 * 1. GET /bidder/me/profile — 404 for officer (no bidder profile)
 * 2. GET /bidder/me/vault — 403 for officer (role guard)
 * 3. GET /bidder/me/vault — 200 empty for bidder with no ledger entries
 * 4. GET /bidder/me/vault/:tenderId/report — 403 cross-bidder access blocked
 * 5. GET /bidder/me/vault/:tenderId/report — 200 PDF for own tender, correct headers
 * 6. Chain hash in X-Ledger-Chain-Hash is deterministic and non-trivial
 * 7. GET /bidders/profile/:companyHash — 401 without auth
 * 8. GET /bidders/profile/:companyHash — officer gets profile after recompute
 *
 * Note: vault self-service requires bidder actorType in ledger.
 * In tests we seed ledger entries directly with actorId = userId.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../../src/db/client.js';
import { deleteLedgerEntriesAdmin, adminPrisma } from '../helpers/adminDb.js';
import { config } from '../../src/config.js';
import { recomputeBidderProfile, computeCompanyHash } from '../../src/services/profile/profile.js';

const BASE_URL = `http://localhost:${config.PORT}`;

// User IDs (JWT subjects)
const BIDDER_USER_ID = `vault-bidder-user-${Date.now()}`;
const OTHER_BIDDER_USER_ID = `vault-other-bidder-${Date.now()}`;
const OFFICER_USER_ID = `vault-officer-${Date.now()}`;

const bidderToken = jwt.sign({ id: BIDDER_USER_ID, role: 'bidder' }, config.JWT_SECRET);
const otherBidderToken = jwt.sign({ id: OTHER_BIDDER_USER_ID, role: 'bidder' }, config.JWT_SECRET);
const officerToken = jwt.sign({ id: OFFICER_USER_ID, role: 'officer' }, config.JWT_SECRET);

const TEST_PAN = `ABCDE${Math.floor(1000 + Math.random() * 9000)}F`;
const COMPANY_HASH = computeCompanyHash(TEST_PAN);

let vaultTenderId: string;
let vaultBidderId: string;
let otherTenderId: string;
let otherBidderId: string;

describe('Phase 5: Vault + Trust Profile', () => {
  beforeAll(async () => {
    // Create main test tender and bidder
    const tender = await prisma.tender.create({
      data: {
        title: 'Vault Test Tender',
        gemTenderId: `GEM-VAULT-${Date.now()}`,
        status: 'open',
        applicationFee: 0,
      },
    });
    vaultTenderId = tender.id;

    const bidder = await prisma.bidder.create({
      data: {
        companyName: 'Vault Test Corp',
        pan: TEST_PAN,
        overallRisk: 'low',
        riskScore: 0.1,
        tenderId: vaultTenderId,
        checks: [],
      },
    });
    vaultBidderId = bidder.id;

    // Seed a ledger entry with actorType=bidder, actorId=BIDDER_USER_ID
    // This establishes the bidder <-> user identity link
    await prisma.ledgerEntry.create({
      data: {
        bidderId: vaultBidderId,
        actorType: 'bidder',
        actorId: BIDDER_USER_ID,
        action: 'verification_run',
        detail: { seeded: true, note: 'vault test seed' },
      },
    });

    // Create a second tender + bidder for cross-access test
    const otherTender = await prisma.tender.create({
      data: {
        title: 'Other Vault Tender',
        gemTenderId: `GEM-VAULT-OTHER-${Date.now()}`,
        status: 'open',
        applicationFee: 0,
      },
    });
    otherTenderId = otherTender.id;

    const otherBidder = await prisma.bidder.create({
      data: {
        companyName: 'Other Vault Corp',
        pan: `XYZPQ${Math.floor(1000 + Math.random() * 9000)}Z`,
        overallRisk: 'low',
        riskScore: 0.1,
        tenderId: otherTenderId,
        checks: [],
      },
    });
    otherBidderId = otherBidder.id;

    // Seed ledger entry for other bidder (different user)
    await prisma.ledgerEntry.create({
      data: {
        bidderId: otherBidderId,
        actorType: 'bidder',
        actorId: OTHER_BIDDER_USER_ID,
        action: 'verification_run',
        detail: { seeded: true, note: 'other vault test seed' },
      },
    });

    // Recompute profile for main bidder so GET /bidders/profile/:companyHash works
    await recomputeBidderProfile(TEST_PAN, 'Vault Test Corp', vaultBidderId);
  });

  afterAll(async () => {
    // Clean up bidder profiles
    await adminPrisma.$executeRawUnsafe(
      `DELETE FROM bidder_profiles WHERE bidder_company_id = '${COMPANY_HASH}'`
    );
    await deleteLedgerEntriesAdmin({ bidderId: vaultBidderId });
    await deleteLedgerEntriesAdmin({ bidderId: otherBidderId });
    await prisma.bidder.delete({ where: { id: vaultBidderId } });
    await prisma.bidder.delete({ where: { id: otherBidderId } });
    await prisma.tender.delete({ where: { id: vaultTenderId } });
    await prisma.tender.delete({ where: { id: otherTenderId } });
  });

  // ── 1. Role guard — officer cannot access /bidder/me/vault ───────────────────

  it('GET /bidder/me/vault — officer gets 403 (role guard)', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/vault`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(403);
  });

  // ── 2. GET /bidder/me/vault — empty list ─────────────────────────────────────

  it('GET /bidder/me/vault — bidder sees their own vault (may be empty or has entry)', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/vault`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(Array.isArray(body.data)).toBe(true);
    // Main bidder has one ledger entry → should appear
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    const entry = body.data[0];
    expect(entry.bidderId).toBe(vaultBidderId);
  });

  // ── 3. Cross-bidder access blocked ───────────────────────────────────────────

  it('GET /bidder/me/vault/:tenderId/report — 403 for a tender not owned by this bidder', async () => {
    // OTHER bidder tries to access MAIN bidder's tender report
    const res = await fetch(`${BASE_URL}/bidder/me/vault/${vaultTenderId}/report`, {
      headers: { Authorization: `Bearer ${otherBidderToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toMatch(/access denied/i);
  });

  // ── 4. Own PDF report ─────────────────────────────────────────────────────────

  it('GET /bidder/me/vault/:tenderId/report — 200 PDF with correct headers', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/vault/${vaultTenderId}/report`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    const chainHash = res.headers.get('x-ledger-chain-hash');
    expect(chainHash).toBeTruthy();
    expect(chainHash).toHaveLength(64); // sha256 hex
    expect(chainHash).toMatch(/^[0-9a-f]{64}$/);
  });

  // ── 5. Chain hash is deterministic ───────────────────────────────────────────

  it('X-Ledger-Chain-Hash is deterministic across two requests', async () => {
    const fetch1 = await fetch(`${BASE_URL}/bidder/me/vault/${vaultTenderId}/report`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    const hash1 = fetch1.headers.get('x-ledger-chain-hash');

    const fetch2 = await fetch(`${BASE_URL}/bidder/me/vault/${vaultTenderId}/report`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    const hash2 = fetch2.headers.get('x-ledger-chain-hash');

    expect(hash1).toBe(hash2);
    // And it's non-trivial (not all zeros)
    expect(hash1).not.toBe('0'.repeat(64));
  });

  // ── 6. GET /bidders/profile/:companyHash — officer/admin ─────────────────────

  it('GET /bidders/profile/:companyHash — 401 without auth', async () => {
    const res = await fetch(`${BASE_URL}/bidders/profile/${COMPANY_HASH}`);
    expect(res.status).toBe(401);
  });

  it('GET /bidders/profile/:companyHash — officer gets profile', async () => {
    const res = await fetch(`${BASE_URL}/bidders/profile/${COMPANY_HASH}`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    const profile = body.data;
    expect(profile.companyHash).toBe(COMPANY_HASH);
    expect(profile.displayName).toBe('Vault Test Corp');
    expect(typeof profile.trustScore).toBe('number');
    expect(profile.trustScore).toBeGreaterThanOrEqual(0);
    expect(profile.trustScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(profile.badges)).toBe(true);
    expect(Array.isArray(profile.nextGoals)).toBe(true);
  });

  it('GET /bidders/profile/:companyHash — 400 for invalid hash format', async () => {
    const res = await fetch(`${BASE_URL}/bidders/profile/not-a-valid-hash`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(400);
  });

  it('GET /bidders/profile/:companyHash — 404 for unknown hash', async () => {
    const unknown = 'a'.repeat(64);
    const res = await fetch(`${BASE_URL}/bidders/profile/${unknown}`, {
      headers: { Authorization: `Bearer ${officerToken}` },
    });
    expect(res.status).toBe(404);
  });

  // ── 7. Vault filter — ?status= ───────────────────────────────────────────────

  it('GET /bidder/me/vault?status=open — filters by tender status', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/vault?status=open`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    for (const item of body.data) {
      expect(item.tender.status).toBe('open');
    }
  });

  it('GET /bidder/me/vault?status=awarded — returns empty for fresh bidder', async () => {
    const res = await fetch(`${BASE_URL}/bidder/me/vault?status=awarded`, {
      headers: { Authorization: `Bearer ${bidderToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(0);
  });
});
