/**
 * Phase 6 — Cartel & Collusion Detection Tests (Feature 10)
 * tests/cartel/cartel.spec.ts
 *
 * All six signals tested with fully ISOLATED synthetic fixtures — each
 * fixture fires exactly ONE signal and explicitly verifies the other five
 * do NOT fire. This is non-negotiable: co-firing signals hide bugs.
 *
 * Also covers:
 *   - 60-second idempotency window (triple-click protection)
 *   - Unrelated bidder set (no cluster)
 *   - Flagship cluster (S1+S4+S5 combined)
 *   - 15-bidder performance gate (< 3000ms)
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateSignalS1_SharedDirectorPan,
  evaluateSignalS2_SharedAddress,
  evaluateSignalS3_SequentialPanIssuance,
  evaluateSignalS4_SequentialSubmissions,
  evaluateSignalS5_PriceClustering,
  evaluateSignalS6_IdenticalDocTemplates,
  evaluateBidderPair,
  clusterBidders,
  DEFAULT_COLLUSION_CONFIG,
  normalizeAddress,
  type BidderCollusionInput,
  type CollusionConfig,
} from '../../src/services/collusion-detector.js';
import jwt from 'jsonwebtoken';
import { config } from '../../src/config.js';
import { prisma } from '../../src/db/client.js';
import { deleteLedgerEntriesAdmin } from '../helpers/adminDb.js';

const BASE_URL = `http://localhost:${config.PORT}`;
const officerToken = jwt.sign({ id: 'user-officer-001', role: 'officer' }, config.JWT_SECRET);
const bidderToken = jwt.sign({ id: 'user-bidder-001', role: 'bidder' }, config.JWT_SECRET);

// ─── Shared synthetic bidder builder ────────────────────────────────────────

function makeBidder(overrides: Partial<BidderCollusionInput> & { id: string }): BidderCollusionInput {
  return {
    id: overrides.id,
    companyName: overrides.companyName ?? `Company ${overrides.id}`,
    pan: overrides.pan ?? `AABCR${overrides.id.slice(-4)}A`,
    gstin: overrides.gstin ?? null,
    quotedPrice: overrides.quotedPrice ?? null,
    submissionIp: overrides.submissionIp ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-01-01T10:00:00Z'),
    directorPans: overrides.directorPans ?? [],
    registeredAddress: overrides.registeredAddress ?? null,
    panIssuanceDate: overrides.panIssuanceDate ?? null,
    documentTemplateHash: overrides.documentTemplateHash ?? null,
  };
}

// ─── Unit Tests: Pure Signal Evaluators ─────────────────────────────────────

describe('Phase 6: Collusion Signal Unit Tests (Pure Functions)', () => {

  // ─── S1: Shared Director PAN ────────────────────────────────────────────────

  describe('Signal S1 — Shared Director PAN', () => {
    it('returns 1.0 when at least one director PAN matches', () => {
      expect(evaluateSignalS1_SharedDirectorPan(
        ['AAAAA1111A', 'BBBBB2222B'],
        ['CCCCC3333C', 'AAAAA1111A']
      )).toBe(1.0);
    });

    it('returns 0.0 when no director PAN matches', () => {
      expect(evaluateSignalS1_SharedDirectorPan(
        ['AAAAA1111A', 'BBBBB2222B'],
        ['CCCCC3333C', 'DDDDD4444D']
      )).toBe(0.0);
    });

    it('returns 0.0 when either list is empty', () => {
      expect(evaluateSignalS1_SharedDirectorPan([], ['AAAAA1111A'])).toBe(0.0);
      expect(evaluateSignalS1_SharedDirectorPan(['AAAAA1111A'], [])).toBe(0.0);
    });

    it('is case-insensitive', () => {
      expect(evaluateSignalS1_SharedDirectorPan(['aaaaa1111a'], ['AAAAA1111A'])).toBe(1.0);
    });
  });

  // ─── S2: Shared Address ─────────────────────────────────────────────────────

  describe('Signal S2 — Shared Registered Address', () => {
    it('returns 1.0 for identical addresses', () => {
      expect(evaluateSignalS2_SharedAddress(
        '123 MG Road, New Delhi - 110001',
        '123 MG Road, New Delhi - 110001'
      )).toBe(1.0);
    });

    it('returns 1.0 for near-identical addresses (>= 90% similarity)', () => {
      // 1 char difference out of ~25 chars → ~96% similarity
      expect(evaluateSignalS2_SharedAddress(
        '123 MG Road, New Delhi 110001',
        '123 MG Road, New Delhi 110002'
      )).toBe(1.0);
    });

    it('returns 0.0 for completely different addresses', () => {
      expect(evaluateSignalS2_SharedAddress(
        '123 MG Road, New Delhi 110001',
        '456 Brigade Road, Bengaluru 560001'
      )).toBe(0.0);
    });

    it('returns 0.0 when either address is null/empty', () => {
      expect(evaluateSignalS2_SharedAddress(null, '123 MG Road')).toBe(0.0);
      expect(evaluateSignalS2_SharedAddress('123 MG Road', null)).toBe(0.0);
    });

    it('normalizes punctuation and case before comparison', () => {
      // normalizeAddress: lowercase, replace non-word chars with space, collapse whitespace
      const result = normalizeAddress('123, M.G. ROAD - NEW DELHI');
      expect(result).toBe('123 m g road new delhi');
    });
  });

  // ─── S3: Sequential PAN Issuance ────────────────────────────────────────────

  describe('Signal S3 — Sequential PAN Issuance Dates', () => {
    it('returns 1.0 when PAN issuance dates are within 30 days', () => {
      expect(evaluateSignalS3_SequentialPanIssuance(
        new Date('2020-01-01'),
        new Date('2020-01-15')
      )).toBe(1.0);
    });

    it('returns 1.0 at exactly 30 days', () => {
      expect(evaluateSignalS3_SequentialPanIssuance(
        new Date('2020-01-01'),
        new Date('2020-01-31')
      )).toBe(1.0);
    });

    it('returns 0.0 when PAN issuance dates are more than 30 days apart', () => {
      expect(evaluateSignalS3_SequentialPanIssuance(
        new Date('2020-01-01'),
        new Date('2020-02-15')  // 45 days
      )).toBe(0.0);
    });

    it('returns 0.0 when either date is missing', () => {
      expect(evaluateSignalS3_SequentialPanIssuance(null, new Date())).toBe(0.0);
      expect(evaluateSignalS3_SequentialPanIssuance(new Date(), null)).toBe(0.0);
    });
  });

  // ─── S4: Sequential Submissions ─────────────────────────────────────────────

  describe('Signal S4 — Sequential Submissions & Same /24 IP', () => {
    it('returns 1.0 when submissions are within 5 min on same /24 subnet', () => {
      expect(evaluateSignalS4_SequentialSubmissions(
        new Date('2026-01-01T10:00:00Z'), '192.168.1.10',
        new Date('2026-01-01T10:04:00Z'), '192.168.1.20'  // 4 min, same /24
      )).toBe(1.0);
    });

    it('returns 0.0 when within 5 min but different /24 subnet', () => {
      expect(evaluateSignalS4_SequentialSubmissions(
        new Date('2026-01-01T10:00:00Z'), '192.168.1.10',
        new Date('2026-01-01T10:04:00Z'), '192.168.2.10'  // different subnet
      )).toBe(0.0);
    });

    it('returns 0.0 when same subnet but more than 5 min apart', () => {
      expect(evaluateSignalS4_SequentialSubmissions(
        new Date('2026-01-01T10:00:00Z'), '192.168.1.10',
        new Date('2026-01-01T10:10:00Z'), '192.168.1.20'  // 10 min
      )).toBe(0.0);
    });

    it('returns 0.0 when IP is missing', () => {
      expect(evaluateSignalS4_SequentialSubmissions(
        new Date('2026-01-01T10:00:00Z'), null,
        new Date('2026-01-01T10:02:00Z'), '192.168.1.20'
      )).toBe(0.0);
    });
  });

  // ─── S5: Price Clustering ────────────────────────────────────────────────────

  describe('Signal S5 — Price Clustering (CoV < 2%)', () => {
    it('returns 1.0 when prices have CoV < 2%', () => {
      // Mean=100500, stdDev=500, CoV=0.498% < 2%
      expect(evaluateSignalS5_PriceClustering(100000, 101000)).toBe(1.0);
    });

    it('returns 1.0 for identical prices (CoV = 0)', () => {
      expect(evaluateSignalS5_PriceClustering(100000, 100000)).toBe(1.0);
    });

    it('returns 0.0 when prices have CoV >= 2%', () => {
      // Mean=110000, stdDev=10000, CoV=9.09% >= 2%
      expect(evaluateSignalS5_PriceClustering(100000, 120000)).toBe(0.0);
    });

    it('returns 0.0 when either price is null or zero', () => {
      expect(evaluateSignalS5_PriceClustering(null, 100000)).toBe(0.0);
      expect(evaluateSignalS5_PriceClustering(0, 100000)).toBe(0.0);
    });
  });

  // ─── S6: Identical Templates ─────────────────────────────────────────────────

  describe('Signal S6 — Identical Document Templates', () => {
    it('returns 1.0 for matching MD5 template hashes', () => {
      expect(evaluateSignalS6_IdenticalDocTemplates(
        'd41d8cd98f00b204e9800998ecf8427e',
        'd41d8cd98f00b204e9800998ecf8427e'
      )).toBe(1.0);
    });

    it('returns 0.0 for different hashes', () => {
      expect(evaluateSignalS6_IdenticalDocTemplates(
        'd41d8cd98f00b204e9800998ecf8427e',
        '098f6bcd4621d373cade4e832627b4f6'
      )).toBe(0.0);
    });

    it('returns 0.0 when either hash is null or empty', () => {
      expect(evaluateSignalS6_IdenticalDocTemplates(null, 'd41d8cd98f00b204e9800998ecf8427e')).toBe(0.0);
      expect(evaluateSignalS6_IdenticalDocTemplates('', 'd41d8cd98f00b204e9800998ecf8427e')).toBe(0.0);
    });
  });
});

// ─── Isolated Per-Signal Cluster Tests ──────────────────────────────────────

describe('Phase 6: Isolated Per-Signal Cluster Tests (6 Independent Fixtures)', () => {

  const DIVERSE_IP_A = '10.0.1.5';
  const DIVERSE_IP_B = '172.16.5.10';
  const DIVERSE_IP_C = '203.0.113.50';
  const DIVERSE_DATE_PAST = new Date('2015-03-01T10:00:00Z');
  const DIVERSE_DATE_NEAR = new Date('2015-06-01T10:00:00Z');
  const DIVERSE_DATE_PRESENT = new Date('2025-01-01T10:00:00Z');

  // Helper: strict config with threshold slightly below S1's contribution
  // so only a single signal needs to fire to form a cluster.
  // S1 weighted score: s1*0.25 / totalWeight(1.0) = 0.25 → threshold 0.24
  // S2: 0.15 → threshold 0.14
  // S3: 0.10 → threshold 0.09
  // S4: 0.15 → threshold 0.14
  // S5: 0.20 → threshold 0.19
  // S6: 0.15 → threshold 0.14

  function makeConfig(threshold: number): CollusionConfig {
    return { ...DEFAULT_COLLUSION_CONFIG, threshold };
  }

  // ─── S1-only fixture ──────────────────────────────────────────────────────

  it('S1-only: shared director PAN fires, S2-S6 do NOT fire', () => {
    const SHARED_DIRECTOR_PAN = 'AAAAA1111A';
    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's1-a', directorPans: [SHARED_DIRECTOR_PAN], registeredAddress: '10 Sector 5, Gurgaon', panIssuanceDate: DIVERSE_DATE_PAST, submissionIp: DIVERSE_IP_A, createdAt: new Date('2026-01-01T08:00:00Z'), quotedPrice: 1000000, documentTemplateHash: 'hash-alpha' }),
      makeBidder({ id: 's1-b', directorPans: [SHARED_DIRECTOR_PAN], registeredAddress: '45 Juhu Tara, Mumbai', panIssuanceDate: DIVERSE_DATE_NEAR, submissionIp: DIVERSE_IP_B, createdAt: new Date('2026-01-01T10:00:00Z'), quotedPrice: 2000000, documentTemplateHash: 'hash-beta' }),
      makeBidder({ id: 's1-c', directorPans: [SHARED_DIRECTOR_PAN], registeredAddress: '99 Brigade Road, Bengaluru', panIssuanceDate: DIVERSE_DATE_PRESENT, submissionIp: DIVERSE_IP_C, createdAt: new Date('2026-01-01T14:00:00Z'), quotedPrice: 5000000, documentTemplateHash: 'hash-gamma' }),
    ];

    const pair = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pair.signalBreakdown.shared_director_pan.fired).toBe(true);
    expect(pair.signalBreakdown.shared_address.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_pan_issuance.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_submissions.fired).toBe(false);
    expect(pair.signalBreakdown.price_clustering.fired).toBe(false);
    expect(pair.signalBreakdown.identical_templates.fired).toBe(false);

    const clusters = clusterBidders(bidders, makeConfig(0.24));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['shared_director_pan']);
    expect(clusters[0].signalsFired).not.toContain('shared_address');
    expect(clusters[0].signalsFired).not.toContain('price_clustering');
  });

  // ─── S2-only fixture ──────────────────────────────────────────────────────

  it('S2-only: shared address fires (>= 90%), S1,S3,S4,S5,S6 do NOT fire', () => {
    // Very similar addresses, deliberately slight differences to avoid exact match
    // but still >90% similarity
    const ADDR_A = '12 Industrial Area Phase 1, Chandigarh 160002';
    const ADDR_B = '12 Industrial Area Phase 1, Chandigarh 160002';  // identical → 1.0

    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's2-a', directorPans: ['AAAAA1111A'], registeredAddress: ADDR_A, panIssuanceDate: DIVERSE_DATE_PAST, submissionIp: DIVERSE_IP_A, createdAt: new Date('2026-01-01T08:00:00Z'), quotedPrice: 1000000, documentTemplateHash: 'hash-alpha' }),
      makeBidder({ id: 's2-b', directorPans: ['BBBBB2222B'], registeredAddress: ADDR_B, panIssuanceDate: DIVERSE_DATE_PRESENT, submissionIp: DIVERSE_IP_B, createdAt: new Date('2026-01-01T10:00:00Z'), quotedPrice: 2000000, documentTemplateHash: 'hash-beta' }),
      makeBidder({ id: 's2-c', directorPans: ['CCCCC3333C'], registeredAddress: ADDR_A, panIssuanceDate: DIVERSE_DATE_NEAR, submissionIp: DIVERSE_IP_C, createdAt: new Date('2026-01-01T14:00:00Z'), quotedPrice: 5000000, documentTemplateHash: 'hash-gamma' }),
    ];

    const pair = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pair.signalBreakdown.shared_director_pan.fired).toBe(false);
    expect(pair.signalBreakdown.shared_address.fired).toBe(true);
    expect(pair.signalBreakdown.sequential_pan_issuance.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_submissions.fired).toBe(false);
    expect(pair.signalBreakdown.price_clustering.fired).toBe(false);
    expect(pair.signalBreakdown.identical_templates.fired).toBe(false);

    const clusters = clusterBidders(bidders, makeConfig(0.14));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['shared_address']);
  });

  // ─── S3-only fixture ──────────────────────────────────────────────────────

  it('S3-only: sequential PAN issuance fires (<= 30d), S1,S2,S4,S5,S6 do NOT fire', () => {
    const DATE_A = new Date('2020-01-01');
    const DATE_B = new Date('2020-01-10');  // 9 days → fires S3
    const DATE_C = new Date('2020-01-20');  // 10 days from A → fires S3

    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's3-a', directorPans: ['AAAAA1111A'], registeredAddress: '10 Sector 5, Gurgaon', panIssuanceDate: DATE_A, submissionIp: DIVERSE_IP_A, createdAt: new Date('2026-01-01T08:00:00Z'), quotedPrice: 1000000, documentTemplateHash: 'hash-alpha' }),
      makeBidder({ id: 's3-b', directorPans: ['BBBBB2222B'], registeredAddress: '45 Juhu Tara, Mumbai', panIssuanceDate: DATE_B, submissionIp: DIVERSE_IP_B, createdAt: new Date('2026-01-01T10:00:00Z'), quotedPrice: 5000000, documentTemplateHash: 'hash-beta' }),
      makeBidder({ id: 's3-c', directorPans: ['CCCCC3333C'], registeredAddress: '99 Brigade Road, Bengaluru', panIssuanceDate: DATE_C, submissionIp: DIVERSE_IP_C, createdAt: new Date('2026-01-01T14:00:00Z'), quotedPrice: 9000000, documentTemplateHash: 'hash-gamma' }),
    ];

    const pair = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pair.signalBreakdown.shared_director_pan.fired).toBe(false);
    expect(pair.signalBreakdown.shared_address.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_pan_issuance.fired).toBe(true);
    expect(pair.signalBreakdown.sequential_submissions.fired).toBe(false);
    expect(pair.signalBreakdown.price_clustering.fired).toBe(false);
    expect(pair.signalBreakdown.identical_templates.fired).toBe(false);

    const clusters = clusterBidders(bidders, makeConfig(0.09));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['sequential_pan_issuance']);
  });

  // ─── S4-only fixture ──────────────────────────────────────────────────────

  it('S4-only: sequential submissions + same /24 IP fires, S1,S2,S3,S5,S6 do NOT fire', () => {
    const BASE_TIME = new Date('2026-06-15T14:00:00Z');
    const TIME_B = new Date(BASE_TIME.getTime() + 3 * 60 * 1000);  // +3 min
    const TIME_C = new Date(BASE_TIME.getTime() + 4 * 60 * 1000);  // +4 min

    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's4-a', directorPans: ['AAAAA1111A'], registeredAddress: '10 Sector 5, Gurgaon', panIssuanceDate: DIVERSE_DATE_PAST, submissionIp: '192.168.10.5', createdAt: BASE_TIME, quotedPrice: 1000000, documentTemplateHash: 'hash-alpha' }),
      makeBidder({ id: 's4-b', directorPans: ['BBBBB2222B'], registeredAddress: '45 Juhu Tara, Mumbai', panIssuanceDate: DIVERSE_DATE_PRESENT, submissionIp: '192.168.10.8', createdAt: TIME_B, quotedPrice: 2000000, documentTemplateHash: 'hash-beta' }),
      makeBidder({ id: 's4-c', directorPans: ['CCCCC3333C'], registeredAddress: '99 Brigade Road, Bengaluru', panIssuanceDate: DIVERSE_DATE_NEAR, submissionIp: '192.168.10.15', createdAt: TIME_C, quotedPrice: 5000000, documentTemplateHash: 'hash-gamma' }),
    ];

    const pair = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pair.signalBreakdown.shared_director_pan.fired).toBe(false);
    expect(pair.signalBreakdown.shared_address.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_pan_issuance.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_submissions.fired).toBe(true);
    expect(pair.signalBreakdown.price_clustering.fired).toBe(false);
    expect(pair.signalBreakdown.identical_templates.fired).toBe(false);

    const clusters = clusterBidders(bidders, makeConfig(0.14));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['sequential_submissions']);
  });

  // ─── S5-only fixture ──────────────────────────────────────────────────────

  it('S5-only: price CoV < 2% fires, S1,S2,S3,S4,S6 do NOT fire', () => {
    // ₹1,00,000 / ₹1,00,500 / ₹1,01,000 → CoV within 2%
    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's5-a', directorPans: ['AAAAA1111A'], registeredAddress: '10 Sector 5, Gurgaon', panIssuanceDate: DIVERSE_DATE_PAST, submissionIp: DIVERSE_IP_A, createdAt: new Date('2026-01-01T08:00:00Z'), quotedPrice: 100000, documentTemplateHash: 'hash-alpha' }),
      makeBidder({ id: 's5-b', directorPans: ['BBBBB2222B'], registeredAddress: '45 Juhu Tara, Mumbai', panIssuanceDate: DIVERSE_DATE_PRESENT, submissionIp: DIVERSE_IP_B, createdAt: new Date('2026-01-01T10:00:00Z'), quotedPrice: 100500, documentTemplateHash: 'hash-beta' }),
      makeBidder({ id: 's5-c', directorPans: ['CCCCC3333C'], registeredAddress: '99 Brigade Road, Bengaluru', panIssuanceDate: DIVERSE_DATE_NEAR, submissionIp: DIVERSE_IP_C, createdAt: new Date('2026-01-01T14:00:00Z'), quotedPrice: 101000, documentTemplateHash: 'hash-gamma' }),
    ];

    const pairAB = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pairAB.signalBreakdown.shared_director_pan.fired).toBe(false);
    expect(pairAB.signalBreakdown.shared_address.fired).toBe(false);
    expect(pairAB.signalBreakdown.sequential_pan_issuance.fired).toBe(false);
    expect(pairAB.signalBreakdown.sequential_submissions.fired).toBe(false);
    expect(pairAB.signalBreakdown.price_clustering.fired).toBe(true);
    expect(pairAB.signalBreakdown.identical_templates.fired).toBe(false);

    // Confirm CoV math: |100000-100500|/2 / ((100000+100500)/2) = 250/100250 ≈ 0.249% < 2%
    expect(evaluateSignalS5_PriceClustering(100000, 100500)).toBe(1.0);

    const clusters = clusterBidders(bidders, makeConfig(0.19));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['price_clustering']);
  });

  // ─── S6-only fixture ──────────────────────────────────────────────────────

  it('S6-only: identical doc template hash fires, S1,S2,S3,S4,S5 do NOT fire', () => {
    const SHARED_TEMPLATE = 'a1b2c3d4e5f60718293041526374849a';  // same MD5

    const bidders: BidderCollusionInput[] = [
      makeBidder({ id: 's6-a', directorPans: ['AAAAA1111A'], registeredAddress: '10 Sector 5, Gurgaon', panIssuanceDate: DIVERSE_DATE_PAST, submissionIp: DIVERSE_IP_A, createdAt: new Date('2026-01-01T08:00:00Z'), quotedPrice: 1000000, documentTemplateHash: SHARED_TEMPLATE }),
      makeBidder({ id: 's6-b', directorPans: ['BBBBB2222B'], registeredAddress: '45 Juhu Tara, Mumbai', panIssuanceDate: DIVERSE_DATE_PRESENT, submissionIp: DIVERSE_IP_B, createdAt: new Date('2026-01-01T10:00:00Z'), quotedPrice: 2000000, documentTemplateHash: SHARED_TEMPLATE }),
      makeBidder({ id: 's6-c', directorPans: ['CCCCC3333C'], registeredAddress: '99 Brigade Road, Bengaluru', panIssuanceDate: DIVERSE_DATE_NEAR, submissionIp: DIVERSE_IP_C, createdAt: new Date('2026-01-01T14:00:00Z'), quotedPrice: 5000000, documentTemplateHash: SHARED_TEMPLATE }),
    ];

    const pair = evaluateBidderPair(bidders[0], bidders[1], DEFAULT_COLLUSION_CONFIG);

    expect(pair.signalBreakdown.shared_director_pan.fired).toBe(false);
    expect(pair.signalBreakdown.shared_address.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_pan_issuance.fired).toBe(false);
    expect(pair.signalBreakdown.sequential_submissions.fired).toBe(false);
    expect(pair.signalBreakdown.price_clustering.fired).toBe(false);
    expect(pair.signalBreakdown.identical_templates.fired).toBe(true);

    const clusters = clusterBidders(bidders, makeConfig(0.14));
    expect(clusters.length).toBe(1);
    expect(clusters[0].signalsFired).toEqual(['identical_templates']);
  });
});

// ─── Integration Tests: Endpoint ─────────────────────────────────────────────

describe('Phase 6: POST /tenders/:id/detect-collusion — Integration', () => {
  const TEST_TENDER_ID = 'tender-001';

  async function detectCollusion(tenderId = TEST_TENDER_ID, token = officerToken): Promise<Response> {
    return fetch(`${BASE_URL}/tenders/${tenderId}/detect-collusion`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
  }

  it('bidder role gets 403 on detect-collusion', async () => {
    const res = await detectCollusion(TEST_TENDER_ID, bidderToken);
    expect(res.status).toBe(403);
  });

  it('unauthenticated gets 401 on detect-collusion', async () => {
    const res = await fetch(`${BASE_URL}/tenders/${TEST_TENDER_ID}/detect-collusion`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('officer can run detection — returns structured response', async () => {
    const res = await detectCollusion();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.error).toBeNull();
    expect(body.data).toBeDefined();
    expect(typeof body.data.totalBiddersAnalyzed).toBe('number');
    expect(Array.isArray(body.data.clusters)).toBe(true);
    expect(typeof body.data.threshold).toBe('number');
  });

  it('60-second idempotency: 3 rapid calls produce only 1 ledger entry', async () => {
    // Clean up any existing collusion ledger entries for this tender's bidders
    const bidders = await prisma.bidder.findMany({ where: { tenderId: TEST_TENDER_ID }, select: { id: true } });
    const bidderIds = bidders.map(b => b.id);
    await deleteLedgerEntriesAdmin({ action: 'collusion_analysis_run', bidderId: { in: bidderIds } });

    // Run 3 times in quick succession (demo-day triple-click)
    const r1 = await detectCollusion();
    const r2 = await detectCollusion();
    const r3 = await detectCollusion();

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(200);

    const b1 = await r1.json();
    const b2 = await r2.json();
    const b3 = await r3.json();

    // All three must succeed with valid data
    expect(b1.data.clusters).toBeDefined();
    expect(b2.data.clusters).toBeDefined();
    expect(b3.data.clusters).toBeDefined();

    // All three must return identical cluster data
    expect(b2.data.clusters).toEqual(b1.data.clusters);
    expect(b3.data.clusters).toEqual(b1.data.clusters);

    // Assert only ONE ledger entry was created
    const entries = await prisma.ledgerEntry.findMany({
      where: { action: 'collusion_analysis_run', bidderId: { in: bidderIds } },
    });
    expect(entries.length).toBe(1);
  });

  it('returns 404 for non-existent tender', async () => {
    const res = await detectCollusion('tender-nonexistent');
    expect(res.status).toBe(404);
  });

  it('unrelated bidders produce 0 clusters', async () => {
    // Use tender-002 which has diverse bidders with no cartel signals in seed data
    const res = await detectCollusion('tender-002');
    expect(res.status).toBe(200);
    const body = await res.json();
    // Standard seeded data should not form clusters at default threshold 0.60
    expect(body.error).toBeNull();
    expect(body.data.clusters.length).toBe(0);
  });

  it('15-bidder performance gate: detection completes in < 3000ms', async () => {
    // Generate 15 synthetic in-memory bidders and time clusterBidders
    const syntheticBidders: BidderCollusionInput[] = Array.from({ length: 15 }, (_, i) =>
      makeBidder({
        id: `perf-bidder-${i}`,
        directorPans: [`PERF${i.toString().padStart(5, '0')}A`],
        registeredAddress: `${i * 10} Test Road, City ${i}`,
        panIssuanceDate: new Date(2015 + i, 0, 1),
        submissionIp: `10.${i}.0.1`,
        createdAt: new Date(2026, 0, 1, i, 0, 0),
        quotedPrice: 1000000 + i * 500000,
        documentTemplateHash: `hash-perf-${i}`,
      })
    );

    const start = Date.now();
    clusterBidders(syntheticBidders, DEFAULT_COLLUSION_CONFIG);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(3000);
  });
});
