import { prisma } from '../db/client.js';

export interface RulesConfigData {
  msme?: { weight?: number; requiredForTender?: boolean };
  gst?: { weight?: number; flaggedPenalty?: number };
  pan_itr?: { weight?: number; mismatchPenalty?: number };
  pan_mismatch?: { weight?: number } | number;
  blacklist?: { weight?: number; flaggedPenalty?: number };
  make_in_india?: { weight?: number; requiredForTender?: boolean };
  local_content?: { minPercentage?: number; weight?: number };
  riskThresholds?: { low: number; medium: number; high: number };
  delivery?: { graceDays?: number };
  [key: string]: any;
}

export interface ComplianceCheckInput {
  name?: string;
  category?: string;
  status?: string;
  trustSource?: string;
  detail?: string;
  simulated?: boolean;
  [key: string]: any;
}

export interface RiskComputationResult {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  flags: string[];
}

/**
 * Reads the active RulesConfig directly from the database row.
 * Never hardcodes weights or thresholds.
 */
export async function getRulesConfig(): Promise<RulesConfigData> {
  const row = await prisma.rulesConfig.findFirst({
    orderBy: { updatedAt: 'desc' },
  });

  if (!row || !row.config) {
    throw new Error('RulesConfig row not found in database');
  }

  return row.config as unknown as RulesConfigData;
}

/**
 * Evaluates MSME compliance based on Udyam registration / check status.
 */
export function classifyMsme(
  checkOrUdyam: any,
  config?: RulesConfigData
): { isMsme: boolean; status: string; detail: string } {
  if (!checkOrUdyam) {
    return { isMsme: false, status: 'missing', detail: 'No Udyam registration found' };
  }

  if (typeof checkOrUdyam === 'string') {
    const isValidUdyam = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(checkOrUdyam.trim());
    return {
      isMsme: isValidUdyam,
      status: isValidUdyam ? 'verified' : 'invalid',
      detail: isValidUdyam ? `Valid Udyam registration: ${checkOrUdyam}` : 'Invalid Udyam format',
    };
  }

  const status = checkOrUdyam.status || 'unknown';
  const isMsme = status === 'verified';
  return {
    isMsme,
    status,
    detail: checkOrUdyam.detail || (isMsme ? 'MSME registered and verified' : 'MSME not verified'),
  };
}

/**
 * Classifies local content compliance based on declared percentage and config threshold.
 */
export function classifyLocalContent(
  declaredPercentage: number,
  config?: RulesConfigData
): { compliant: boolean; percentage: number; minRequired: number; tier: string } {
  const minRequired = config?.local_content?.minPercentage ?? 50;
  const compliant = declaredPercentage >= minRequired;
  let tier = 'Non-Local Supplier';
  if (declaredPercentage >= 50) {
    tier = 'Class-I Local Supplier';
  } else if (declaredPercentage >= 20) {
    tier = 'Class-II Local Supplier';
  }

  return {
    compliant,
    percentage: declaredPercentage,
    minRequired,
    tier,
  };
}

/**
 * Computes overall risk and score from compliance checks using weights and thresholds
 * read dynamically from the database config row.
 */
export async function computeOverallRisk(
  checks: ComplianceCheckInput[],
  providedConfig?: RulesConfigData
): Promise<RiskComputationResult> {
  const config = providedConfig ?? (await getRulesConfig());
  let score = 0;
  const flags: string[] = [];

  for (const check of checks) {
    const key = (check.name || check.category || '').toLowerCase();
    const status = (check.status || '').toLowerCase();

    if (status === 'flagged' || status === 'mismatch' || status === 'failed') {
      flags.push(`${key}: ${check.detail || 'Flagged check'}`);

      if (key.includes('pan')) {
        // Read pan weight/penalty from DB config dynamically
        const panWeight =
          (config as any)?.pan_mismatch?.weight ??
          (typeof (config as any)?.pan_mismatch === 'number' ? (config as any).pan_mismatch : undefined) ??
          config.pan_itr?.weight ??
          config.pan_itr?.mismatchPenalty ??
          15;
        score += panWeight;
      } else if (key.includes('gst')) {
        const gstWeight = config.gst?.flaggedPenalty ?? config.gst?.weight ?? 15;
        score += gstWeight;
      } else if (key.includes('blacklist')) {
        const blacklistWeight = config.blacklist?.flaggedPenalty ?? config.blacklist?.weight ?? 50;
        score += blacklistWeight;
      } else if (key.includes('udyam') || key.includes('msme')) {
        const msmeWeight = config.msme?.weight ?? 20;
        score += msmeWeight;
      } else if (key.includes('local')) {
        const localWeight = config.local_content?.weight ?? 5;
        score += localWeight;
      } else if (key.includes('india') || key.includes('mii')) {
        const miiWeight = config.make_in_india?.weight ?? 10;
        score += miiWeight;
      } else {
        score += 10;
      }
    } else if (status === 'missing' || status === 'unverified') {
      if (key.includes('udyam') && config.msme?.requiredForTender) {
        score += config.msme?.weight ?? 20;
        flags.push('msme: Missing required Udyam registration');
      } else if (key.includes('local') || key.includes('india')) {
        score += 5;
      }
    }
  }

  // Determine risk level based on thresholds configured in DB
  const thresholds = config.riskThresholds || { low: 25, medium: 50, high: 75 };
  let overallRisk: 'low' | 'medium' | 'high' | 'critical' = 'low';

  if (score > thresholds.high) {
    overallRisk = 'critical';
  } else if (score > thresholds.medium) {
    overallRisk = 'high';
  } else if (score > thresholds.low) {
    overallRisk = 'medium';
  } else {
    overallRisk = 'low';
  }

  return {
    overallRisk,
    riskScore: score,
    flags,
  };
}
