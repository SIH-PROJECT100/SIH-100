import { BidderContext } from './digilocker.js';

export interface SimulatedCheckResult {
  name: string;
  category: string;
  status: 'verified' | 'unverified' | 'flagged';
  trustSource: 'Simulated';
  trust_source: 'simulated';
  confidence: number;
  value?: string | null;
  detail: string;
  evidence: string;
  simulated: true;
  verifiedAt: string;
}

/**
 * Simulated Connector (Tier 3)
 * Handles long-tail compliance categories without public programmatic APIs.
 * CRITICAL RULE: EVERY check produced by this connector MUST have simulated: true.
 */
export async function verifyWithSimulated(
  bidder: BidderContext
): Promise<SimulatedCheckResult[]> {
  const verifiedAt = new Date().toISOString();
  const results: SimulatedCheckResult[] = [];

  // 1. Make in India (MII) check
  const hasMii = !bidder.companyName.toLowerCase().includes('foreign') && bidder.id !== 'bidder-003';
  results.push({
    name: 'make_in_india',
    category: 'Make In India',
    status: hasMii ? 'verified' : 'unverified',
    trustSource: 'Simulated',
    trust_source: 'simulated',
    confidence: 0.82,
    value: hasMii ? 'Class-I Local Supplier (MII declared)' : 'No MII self-declaration submitted',
    detail: hasMii
      ? 'Self-declaration affidavit submitted per Public Procurement (Preference to Make in India) Order 2017 (simulated)'
      : 'MII certificate not submitted with bid package (simulated)',
    evidence: hasMii
      ? 'Self-certification affidavit on non-judicial stamp paper verified against local supplier criteria (simulated)'
      : 'Bid submission package missing mandatory Form-MII local declaration (simulated)',
    simulated: true,
    verifiedAt,
  });

  // 2. Local Content Declaration check
  const localPercentage = bidder.id === 'bidder-003' ? 18 : 65;
  results.push({
    name: 'local_content',
    category: 'Local Content',
    status: localPercentage >= 50 ? 'verified' : 'unverified',
    trustSource: 'Simulated',
    trust_source: 'simulated',
    confidence: 0.85,
    value: `${localPercentage}%`,
    detail: `Local content declared: ${localPercentage}% (simulated)`,
    evidence: `Cost breakdown and indigenous material calculation submitted by statutory auditor (simulated)`,
    simulated: true,
    verifiedAt,
  });

  return results;
}
