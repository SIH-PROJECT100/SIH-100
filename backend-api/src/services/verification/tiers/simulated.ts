/**
 * Tier 4: Simulated Verification Tier
 * Explicitly labelled mock data for GSTN, MCA21, EPFO, Blacklist portals.
 * Flags simulated: true and trust_source: 'simulated'.
 */

export interface SimulatedBidderContext {
  id: string;
  companyName: string;
  pan?: string | null;
  gstin?: string | null;
  overallRisk?: string;
  isBlacklisted?: boolean;
}

export interface SimulatedCheckResult {
  name: string;
  category: string;
  status: 'verified' | 'flagged' | 'pending';
  trustSource: string;
  trust_source: 'simulated';
  confidence: number;
  value: string | null;
  detail: string;
  evidence: string;
  simulated: true;
  verifiedAt: string;
  verificationExpiresAt: string;
}

export function generateSimulatedChecks(
  bidder: SimulatedBidderContext
): SimulatedCheckResult[] {
  const verifiedAt = new Date();
  const verifiedAtIso = verifiedAt.toISOString();

  const expiry365 = new Date(verifiedAt.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const expiry90 = new Date(verifiedAt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();

  // Known high risk bidders in demo data
  const isHighRisk =
    bidder.overallRisk === 'high' ||
    bidder.companyName.toLowerCase().includes('falcon') ||
    bidder.companyName.toLowerCase().includes('apex');

  const checks: SimulatedCheckResult[] = [
    // 1. GSTN Tax Filing status
    {
      name: 'gst',
      category: 'GST',
      status: isHighRisk ? 'flagged' : 'verified',
      trustSource: 'Simulated',
      trust_source: 'simulated',
      confidence: 0.9,
      value: bidder.gstin || '06AAACS1234H1Z8',
      detail: isHighRisk
        ? 'GSTIN registration active but GSTR-3B filings delayed by >90 days'
        : 'Active taxpayer; GSTR-3B filed up to previous month',
      evidence: isHighRisk
        ? 'GSTN simulated verification: GSTR-3B return default flagged for Q2/Q3'
        : 'GSTN simulated portal returns active status with zero tax defaults',
      simulated: true,
      verifiedAt: verifiedAtIso,
      verificationExpiresAt: expiry365,
    },

    // 2. MCA21 Company Master Data
    {
      name: 'mca21',
      category: 'MCA',
      status: 'verified',
      trustSource: 'Simulated',
      trust_source: 'simulated',
      confidence: 0.92,
      value: 'U72900DL2018PTC123456',
      detail: `Company active and in good standing with Registrar of Companies`,
      evidence: 'MCA21 simulated lookup: Annual return & financial balance sheet filed on schedule',
      simulated: true,
      verifiedAt: verifiedAtIso,
      verificationExpiresAt: expiry365,
    },

    // 3. Central Debarment / Blacklist DB
    {
      name: 'blacklist',
      category: 'Blacklist',
      status: bidder.isBlacklisted ? 'flagged' : 'verified',
      trustSource: 'Simulated',
      trust_source: 'simulated',
      confidence: 0.98,
      value: bidder.isBlacklisted ? 'DEBARRED' : 'CLEAN',
      detail: bidder.isBlacklisted
        ? 'Entity debarred under GFR 151 across Indian Central Ministries'
        : 'No debarment or vigilance proceedings recorded in Central GeM Registry',
      evidence: bidder.isBlacklisted
        ? 'Blacklist registry match: Vendor debarred from public procurement under Rule 151'
        : 'Government procurement debarment registry check clear',
      simulated: true,
      verifiedAt: verifiedAtIso,
      verificationExpiresAt: expiry90, // Fast-changing validity: 90 days
    },

    // 4. EPFO Compliance
    {
      name: 'epfo',
      category: 'EPFO',
      status: 'verified',
      trustSource: 'Simulated',
      trust_source: 'simulated',
      confidence: 0.88,
      value: 'DLCPM0012345000',
      detail: 'EPF Electronic Challan Return (ECR) regular with active contribution',
      evidence: 'EPFO simulated portal: Monthly ECR filed for covered workforce',
      simulated: true,
      verifiedAt: verifiedAtIso,
      verificationExpiresAt: expiry365,
    },
  ];

  return checks;
}
