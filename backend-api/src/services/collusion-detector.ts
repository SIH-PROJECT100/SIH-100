/**
 * Cartel & Collusion Detection Service (src/services/collusion-detector.ts)
 * Flagship anti-trust detection engine for Indian public procurement (GeM PS 100).
 *
 * Implements 6 weighted signals:
 *   S1. Shared director PAN across bidders' MCA extracts (weight: 0.25)
 *   S2. Shared registered address via Levenshtein >= 90% (weight: 0.15)
 *   S3. Sequential PAN issuance dates <= 30 days (weight: 0.10)
 *   S4. Sequential submission timestamps <= 5 min from same /24 IP prefix (weight: 0.15)
 *   S5. Price clustering (quoted price CoV < 2%) (weight: 0.20)
 *   S6. Identical document templates via MD5 hash match (weight: 0.15)
 *
 * Provides:
 *   - Pure, deterministic signal evaluation functions
 *   - Dynamic connected-component graph clustering
 *   - 60-second idempotency window per tender to prevent duplicate audit entries
 *   - Atomic DB update adding `collusion_risk` checks and ledger record
 */

import crypto from 'crypto';
import { prisma } from '../db/client.js';
import { distance } from 'fastest-levenshtein';
import { appendToLedger } from './ledger.js';
import { getRulesConfig, computeOverallRisk } from './rulesEngine.js';
import { ActorType } from '@prisma/client';

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface BidderCollusionInput {
  id: string;
  companyName: string;
  pan?: string | null;
  gstin?: string | null;
  quotedPrice?: number | null;
  submissionIp?: string | null;
  createdAt?: Date | string | null;
  directorPans?: string[];
  registeredAddress?: string | null;
  panIssuanceDate?: Date | string | null;
  documentTemplateHash?: string | null;
  checks?: any[];
  overallRisk?: string;
  riskScore?: number;
}

export interface CollusionSignalWeights {
  sharedDirectorPan: number;
  sharedAddress: number;
  sequentialPanIssuance: number;
  sequentialSubmissions: number;
  priceClustering: number;
  identicalTemplates: number;
}

export interface CollusionConfig {
  weights: CollusionSignalWeights;
  threshold: number;
  priceCovThreshold: number;
  addressSimilarityThreshold: number;
  panIssuanceDaysThreshold: number;
  submissionMinutesThreshold: number;
}

export interface PairwiseSignalResult {
  bidderAId: string;
  bidderBId: string;
  score: number;
  signalsFired: string[];
  signalBreakdown: Record<string, { fired: boolean; value: number; weight: number }>;
}

export interface CollusionCluster {
  clusterId?: string;
  bidderIds: string[];
  signalsFired: string[];
  aggregateScore: number;
  pairs: Array<{
    bidderAId: string;
    bidderBId: string;
    score: number;
    signalsFired: string[];
  }>;
}

export interface CollusionDetectionResult {
  tenderId: string;
  totalBiddersAnalyzed: number;
  clusters: CollusionCluster[];
  threshold: number;
  cached?: boolean;
}

// ─── Default Configuration ──────────────────────────────────────────────────

export const DEFAULT_COLLUSION_CONFIG: CollusionConfig = {
  weights: {
    sharedDirectorPan: 0.25,
    sharedAddress: 0.15,
    sequentialPanIssuance: 0.10,
    sequentialSubmissions: 0.15,
    priceClustering: 0.20,
    identicalTemplates: 0.15,
  },
  threshold: 0.60,
  priceCovThreshold: 0.02, // 2% CoV
  addressSimilarityThreshold: 0.90, // 90% Levenshtein similarity
  panIssuanceDaysThreshold: 30, // 30 days
  submissionMinutesThreshold: 5, // 5 minutes
};

// ─── Pure Signal Evaluators ─────────────────────────────────────────────────

/**
 * Normalizes company address string for fuzzy comparison.
 */
export function normalizeAddress(addr?: string | null): string {
  if (!addr) return '';
  return addr
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Signal S1: Shared Director PAN
 * Returns 1.0 if bidders share at least one director PAN, else 0.0.
 */
export function evaluateSignalS1_SharedDirectorPan(
  directorsA: string[] = [],
  directorsB: string[] = []
): number {
  if (!directorsA.length || !directorsB.length) return 0.0;
  const setB = new Set(directorsB.map((p) => p.toUpperCase().trim()));
  const shares = directorsA.some((p) => setB.has(p.toUpperCase().trim()));
  return shares ? 1.0 : 0.0;
}

/**
 * Signal S2: Shared Registered Address
 * Uses fastest-levenshtein. Returns 1.0 if similarity >= threshold (default 0.90), else 0.0.
 */
export function evaluateSignalS2_SharedAddress(
  addressA?: string | null,
  addressB?: string | null,
  similarityThreshold = DEFAULT_COLLUSION_CONFIG.addressSimilarityThreshold
): number {
  const normA = normalizeAddress(addressA);
  const normB = normalizeAddress(addressB);
  if (!normA || !normB) return 0.0;
  if (normA === normB) return 1.0;

  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 0.0;

  const dist = distance(normA, normB);
  const similarity = 1.0 - dist / maxLen;
  return similarity >= similarityThreshold ? 1.0 : 0.0;
}

/**
 * Signal S3: Sequential PAN Issuance Dates
 * Returns 1.0 if issuance dates are within threshold days (default 30 days), else 0.0.
 */
export function evaluateSignalS3_SequentialPanIssuance(
  dateA?: Date | string | null,
  dateB?: Date | string | null,
  daysThreshold = DEFAULT_COLLUSION_CONFIG.panIssuanceDaysThreshold
): number {
  if (!dateA || !dateB) return 0.0;
  const dA = new Date(dateA).getTime();
  const dB = new Date(dateB).getTime();
  if (isNaN(dA) || isNaN(dB)) return 0.0;

  const diffDays = Math.abs(dA - dB) / (1000 * 60 * 60 * 24);
  return diffDays <= daysThreshold ? 1.0 : 0.0;
}

/**
 * Signal S4: Sequential Submission Timestamps & Same /24 IP Prefix
 * Returns 1.0 if submission times are within threshold minutes (default 5 min)
 * AND both IPs share the same /24 IPv4 prefix.
 */
export function evaluateSignalS4_SequentialSubmissions(
  timeA?: Date | string | null,
  ipA?: string | null,
  timeB?: Date | string | null,
  ipB?: string | null,
  minutesThreshold = DEFAULT_COLLUSION_CONFIG.submissionMinutesThreshold
): number {
  if (!timeA || !timeB || !ipA || !ipB) return 0.0;
  const tA = new Date(timeA).getTime();
  const tB = new Date(timeB).getTime();
  if (isNaN(tA) || isNaN(tB)) return 0.0;

  const diffMinutes = Math.abs(tA - tB) / (1000 * 60);
  if (diffMinutes > minutesThreshold) return 0.0;

  // Compare IPv4 /24 subnet (e.g. 192.168.1.xxx)
  const partsA = ipA.trim().split('.');
  const partsB = ipB.trim().split('.');
  if (partsA.length >= 3 && partsB.length >= 3) {
    const subnetA = partsA.slice(0, 3).join('.');
    const subnetB = partsB.slice(0, 3).join('.');
    return subnetA === subnetB ? 1.0 : 0.0;
  }

  return 0.0;
}

/**
 * Signal S5: Price Clustering (Coefficient of Variation)
 * CoV = stdDev / mean.
 * For two prices, CoV = |priceA - priceB| / (priceA + priceB).
 * Returns 1.0 if CoV < threshold (default 0.02, or 2%), else 0.0.
 */
export function evaluateSignalS5_PriceClustering(
  priceA?: number | null,
  priceB?: number | null,
  covThreshold = DEFAULT_COLLUSION_CONFIG.priceCovThreshold
): number {
  if (priceA == null || priceB == null || isNaN(priceA) || isNaN(priceB)) return 0.0;
  if (priceA <= 0 || priceB <= 0) return 0.0;

  const mean = (priceA + priceB) / 2.0;
  const stdDev = Math.abs(priceA - priceB) / 2.0;
  const cov = stdDev / mean;

  return cov < covThreshold ? 1.0 : 0.0;
}

/**
 * Signal S6: Identical Document Templates (MD5 hash of document structure)
 * Returns 1.0 if template MD5 hashes are identical and non-empty, else 0.0.
 */
export function evaluateSignalS6_IdenticalDocTemplates(
  templateHashA?: string | null,
  templateHashB?: string | null
): number {
  if (!templateHashA || !templateHashB) return 0.0;
  const hA = templateHashA.trim().toLowerCase();
  const hB = templateHashB.trim().toLowerCase();
  return hA.length > 0 && hA === hB ? 1.0 : 0.0;
}

// ─── Pairwise & Clustering Engine ───────────────────────────────────────────

/**
 * Evaluates all 6 signals between a pair of bidders and computes the weighted score.
 */
export function evaluateBidderPair(
  a: BidderCollusionInput,
  b: BidderCollusionInput,
  config: CollusionConfig = DEFAULT_COLLUSION_CONFIG
): PairwiseSignalResult {
  const w = config.weights;
  const totalWeight =
    w.sharedDirectorPan +
    w.sharedAddress +
    w.sequentialPanIssuance +
    w.sequentialSubmissions +
    w.priceClustering +
    w.identicalTemplates;

  const s1 = evaluateSignalS1_SharedDirectorPan(a.directorPans, b.directorPans);
  const s2 = evaluateSignalS2_SharedAddress(a.registeredAddress, b.registeredAddress, config.addressSimilarityThreshold);
  const s3 = evaluateSignalS3_SequentialPanIssuance(a.panIssuanceDate, b.panIssuanceDate, config.panIssuanceDaysThreshold);
  const s4 = evaluateSignalS4_SequentialSubmissions(a.createdAt, a.submissionIp, b.createdAt, b.submissionIp, config.submissionMinutesThreshold);
  const s5 = evaluateSignalS5_PriceClustering(a.quotedPrice, b.quotedPrice, config.priceCovThreshold);
  const s6 = evaluateSignalS6_IdenticalDocTemplates(a.documentTemplateHash, b.documentTemplateHash);

  const weightedSum =
    s1 * w.sharedDirectorPan +
    s2 * w.sharedAddress +
    s3 * w.sequentialPanIssuance +
    s4 * w.sequentialSubmissions +
    s5 * w.priceClustering +
    s6 * w.identicalTemplates;

  const score = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(4)) : 0.0;

  const signalsFired: string[] = [];
  if (s1 === 1.0) signalsFired.push('shared_director_pan');
  if (s2 === 1.0) signalsFired.push('shared_address');
  if (s3 === 1.0) signalsFired.push('sequential_pan_issuance');
  if (s4 === 1.0) signalsFired.push('sequential_submissions');
  if (s5 === 1.0) signalsFired.push('price_clustering');
  if (s6 === 1.0) signalsFired.push('identical_templates');

  return {
    bidderAId: a.id,
    bidderBId: b.id,
    score,
    signalsFired,
    signalBreakdown: {
      shared_director_pan: { fired: s1 === 1.0, value: s1, weight: w.sharedDirectorPan },
      shared_address: { fired: s2 === 1.0, value: s2, weight: w.sharedAddress },
      sequential_pan_issuance: { fired: s3 === 1.0, value: s3, weight: w.sequentialPanIssuance },
      sequential_submissions: { fired: s4 === 1.0, value: s4, weight: w.sequentialSubmissions },
      price_clustering: { fired: s5 === 1.0, value: s5, weight: w.priceClustering },
      identical_templates: { fired: s6 === 1.0, value: s6, weight: w.identicalTemplates },
    },
  };
}

/**
 * Disjoint Set Union (DSU) for connected-component graph clustering.
 */
class DisjointSet {
  parent: Map<string, string> = new Map();

  constructor(elements: string[]) {
    for (const el of elements) {
      this.parent.set(el, el);
    }
  }

  find(i: string): string {
    const p = this.parent.get(i) ?? i;
    if (p === i) return i;
    const root = this.find(p);
    this.parent.set(i, root);
    return root;
  }

  union(i: string, j: string) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent.set(rootI, rootJ);
    }
  }
}

/**
 * Cluster bidders by evaluating all pairs against the threshold.
 */
export function clusterBidders(
  bidders: BidderCollusionInput[],
  config: CollusionConfig = DEFAULT_COLLUSION_CONFIG
): CollusionCluster[] {
  if (bidders.length < 2) return [];

  const bidderIds = bidders.map((b) => b.id);
  const dsu = new DisjointSet(bidderIds);
  const connectingPairs: PairwiseSignalResult[] = [];

  for (let i = 0; i < bidders.length; i++) {
    for (let j = i + 1; j < bidders.length; j++) {
      const pairResult = evaluateBidderPair(bidders[i], bidders[j], config);
      if (pairResult.score >= config.threshold) {
        dsu.union(bidders[i].id, bidders[j].id);
        connectingPairs.push(pairResult);
      }
    }
  }

  if (connectingPairs.length === 0) return [];

  // Group into connected components
  const components = new Map<string, string[]>();
  for (const id of bidderIds) {
    const root = dsu.find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root)!.push(id);
  }

  const clusters: CollusionCluster[] = [];

  for (const [, memberIds] of components) {
    if (memberIds.length < 2) continue;

    const clusterPairs = connectingPairs.filter(
      (p) => memberIds.includes(p.bidderAId) && memberIds.includes(p.bidderBId)
    );

    if (clusterPairs.length === 0) continue;

    const signalsFiredSet = new Set<string>();
    let maxScore = 0;

    for (const p of clusterPairs) {
      p.signalsFired.forEach((s) => signalsFiredSet.add(s));
      if (p.score > maxScore) maxScore = p.score;
    }

    const clusterId = crypto.randomUUID();
    clusters.push({
      clusterId,
      bidderIds: memberIds,
      signalsFired: Array.from(signalsFiredSet).sort(),
      aggregateScore: maxScore,
      pairs: clusterPairs.map((p) => ({
        bidderAId: p.bidderAId,
        bidderBId: p.bidderBId,
        score: p.score,
        signalsFired: p.signalsFired,
      })),
    });
  }

  return clusters;
}

// ─── Attribute Extraction Helpers ───────────────────────────────────────────

/**
 * Extracts normalized collusion attributes from Bidder database record.
 */
export function extractBidderCollusionAttributes(bidder: any): BidderCollusionInput {
  const checks: any[] = Array.isArray(bidder.checks) ? bidder.checks : [];

  // 1. Quoted Price
  let quotedPrice: number | null = null;
  if (bidder.quotedPrice != null) {
    quotedPrice = Number(bidder.quotedPrice);
  } else {
    const pricingCheck = checks.find((c) => c.name === 'pricing' || c.name === 'bid_price');
    if (pricingCheck?.detail && typeof pricingCheck.detail === 'object') {
      quotedPrice = Number(pricingCheck.detail.quotedPrice || pricingCheck.detail.price || 0) || null;
    }
  }

  // 2. Submission IP
  let submissionIp = bidder.submissionIp || null;
  if (!submissionIp) {
    const subCheck = checks.find((c) => c.name === 'submission' || c.name === 'meta');
    if (subCheck?.detail?.ip) submissionIp = String(subCheck.detail.ip);
  }

  // 3. Director PANs
  const directorPans: string[] = [];
  const mcaCheck = checks.find((c) => c.name === 'mca' || c.name === 'mca21' || c.name === 'directors');
  if (mcaCheck?.detail) {
    if (Array.isArray(mcaCheck.detail.directorPans)) {
      directorPans.push(...mcaCheck.detail.directorPans);
    } else if (typeof mcaCheck.detail.directorPan === 'string') {
      directorPans.push(mcaCheck.detail.directorPan);
    }
  }

  // 4. Registered Address
  let registeredAddress = bidder.companyAddress || null;
  if (!registeredAddress) {
    const addrCheck = checks.find(
      (c) => (c.name === 'gst' || c.name === 'udyam' || c.name === 'mca') && c.detail?.registeredAddress
    );
    if (addrCheck) registeredAddress = String(addrCheck.detail.registeredAddress);
  }

  // 5. PAN Issuance Date
  let panIssuanceDate: Date | string | null = null;
  const panCheck = checks.find((c) => c.name === 'pan_itr' || c.name === 'pan');
  if (panCheck?.detail?.panIssuanceDate) {
    panIssuanceDate = panCheck.detail.panIssuanceDate;
  }

  // 6. Document Template MD5 Hash
  let documentTemplateHash: string | null = null;
  const docCheck = checks.find(
    (c) => c.name === 'doc_template' || c.name === 'document_template' || c.detail?.templateHash
  );
  if (docCheck) {
    documentTemplateHash = docCheck.detail?.templateHash || docCheck.detail?.templateMd5 || null;
  }

  return {
    id: bidder.id,
    companyName: bidder.companyName,
    pan: bidder.pan,
    gstin: bidder.gstin,
    quotedPrice,
    submissionIp,
    createdAt: bidder.createdAt,
    directorPans,
    registeredAddress,
    panIssuanceDate,
    documentTemplateHash,
    checks,
    overallRisk: bidder.overallRisk,
    riskScore: bidder.riskScore,
  };
}

// ─── Active RulesConfig Integration ─────────────────────────────────────────

export async function resolveCollusionConfig(): Promise<CollusionConfig> {
  try {
    const activeRules = await getRulesConfig();
    const collusionRule = activeRules.collusion as any;

    if (!collusionRule) return DEFAULT_COLLUSION_CONFIG;

    return {
      weights: {
        sharedDirectorPan: collusionRule.weights?.sharedDirectorPan ?? DEFAULT_COLLUSION_CONFIG.weights.sharedDirectorPan,
        sharedAddress: collusionRule.weights?.sharedAddress ?? DEFAULT_COLLUSION_CONFIG.weights.sharedAddress,
        sequentialPanIssuance: collusionRule.weights?.sequentialPanIssuance ?? DEFAULT_COLLUSION_CONFIG.weights.sequentialPanIssuance,
        sequentialSubmissions: collusionRule.weights?.sequentialSubmissions ?? DEFAULT_COLLUSION_CONFIG.weights.sequentialSubmissions,
        priceClustering: collusionRule.weights?.priceClustering ?? DEFAULT_COLLUSION_CONFIG.weights.priceClustering,
        identicalTemplates: collusionRule.weights?.identicalTemplates ?? DEFAULT_COLLUSION_CONFIG.weights.identicalTemplates,
      },
      threshold: collusionRule.threshold ?? DEFAULT_COLLUSION_CONFIG.threshold,
      priceCovThreshold: collusionRule.priceCovThreshold ?? DEFAULT_COLLUSION_CONFIG.priceCovThreshold,
      addressSimilarityThreshold: collusionRule.addressSimilarityThreshold ?? DEFAULT_COLLUSION_CONFIG.addressSimilarityThreshold,
      panIssuanceDaysThreshold: collusionRule.panIssuanceDaysThreshold ?? DEFAULT_COLLUSION_CONFIG.panIssuanceDaysThreshold,
      submissionMinutesThreshold: collusionRule.submissionMinutesThreshold ?? DEFAULT_COLLUSION_CONFIG.submissionMinutesThreshold,
    };
  } catch {
    return DEFAULT_COLLUSION_CONFIG;
  }
}

// ─── Main Orchestrator with 60-Second Idempotency Window ────────────────────

export interface DetectCollusionOptions {
  actorType?: ActorType;
  actorId?: string | null;
  forceFresh?: boolean;
}

export async function detectCollusionForTender(
  tenderId: string,
  options: DetectCollusionOptions = {}
): Promise<CollusionDetectionResult> {
  const { actorType = 'officer', actorId = null, forceFresh = false } = options;

  // 1. 60-Second Idempotency Window:
  // Check if a collusion_analysis_run entry for this tenderId exists within the last 60 seconds
  if (!forceFresh) {
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const recentEntries = await prisma.ledgerEntry.findMany({
      where: {
        action: 'collusion_analysis_run',
        createdAt: { gte: sixtySecondsAgo },
      },
      orderBy: { createdAt: 'desc' },
    });

    const recentEntry = recentEntries.find(
      (e) => (e.detail as any)?.tenderId === tenderId
    );

    if (recentEntry) {
      const detail = recentEntry.detail as any;
      return {
        tenderId,
        totalBiddersAnalyzed: detail.totalBiddersAnalyzed ?? 0,
        clusters: detail.clusters ?? [],
        threshold: detail.threshold ?? DEFAULT_COLLUSION_CONFIG.threshold,
        cached: true,
      };
    }
  }

  // 2. Fetch all bidders for this tender
  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      bidders: true,
    },
  });

  if (!tender) {
    const err = new Error('Tender not found');
    (err as any).statusCode = 404;
    throw err;
  }

  const biddersData = tender.bidders.map(extractBidderCollusionAttributes);
  const config = await resolveCollusionConfig();

  // 3. Run clustering algorithm
  const clusters = clusterBidders(biddersData, config);

  // 4. Atomically persist collusion checks & append ledger entry inside prisma.$transaction
  await prisma.$transaction(async (tx) => {
    // For any bidder in a detected cluster, add/replace collusion_risk check
    for (const cluster of clusters) {
      for (const bidderId of cluster.bidderIds) {
        const bidderRecord = tender.bidders.find((b) => b.id === bidderId);
        if (!bidderRecord) continue;

        const currentChecks: any[] = Array.isArray(bidderRecord.checks) ? [...bidderRecord.checks] : [];
        const clusterId = cluster.clusterId ?? crypto.randomUUID();
        const peerBidders = cluster.bidderIds.filter((id) => id !== bidderId);
        const evidence = `High collusion risk detected among ${cluster.bidderIds.length} bidders (score: ${cluster.aggregateScore.toFixed(2)}). Fired signals: ${cluster.signalsFired.join(', ')}. Clustered with: ${peerBidders.join(', ')}`;

        const newCheck = {
          name: 'collusion_risk',
          category: 'collusion',
          clusterId,
          status: 'flagged',
          evidence,
          trustSource: 'AI Extracted',
          detail: evidence,
          simulated: false,
          clusterScore: cluster.aggregateScore,
          signals: cluster.signalsFired,
          peerBidderIds: peerBidders,
          detectedAt: new Date().toISOString(),
        };

        // Replace existing collusion_risk check or append new
        const existingIdx = currentChecks.findIndex((c) => c.name === 'collusion_risk');
        if (existingIdx >= 0) {
          currentChecks[existingIdx] = newCheck;
        } else {
          currentChecks.push(newCheck);
        }

        // Recompute risk (computeOverallRisk is async, uses DB config)
        const riskResult = await computeOverallRisk(currentChecks);

        await tx.bidder.update({
          where: { id: bidderId },
          data: {
            checks: currentChecks,
            overallRisk: riskResult.overallRisk,
            riskScore: riskResult.riskScore,
          },
        });
      }
    }

    // Appending ONE ledger entry for the analysis run
    const primaryBidderId =
      clusters.length > 0 && clusters[0].bidderIds.length > 0
        ? clusters[0].bidderIds[0]
        : tender.bidders.length > 0
        ? tender.bidders[0].id
        : 'unknown-bidder';

    await appendToLedger(
      {
        bidderId: primaryBidderId,
        actorType,
        actorId,
        action: 'collusion_analysis_run',
        detail: {
          tenderId,
          totalBiddersAnalyzed: biddersData.length,
          clusters,
          signalWeightsUsed: config.weights,
          threshold: config.threshold,
          timestamp: new Date().toISOString(),
        } as any,
      },
      tx
    );
  });

  return {
    tenderId,
    totalBiddersAnalyzed: biddersData.length,
    clusters,
    threshold: config.threshold,
    cached: false,
  };
}
