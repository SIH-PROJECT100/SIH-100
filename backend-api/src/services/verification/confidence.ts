/**
 * Confidence Scoring Pure Function
 * Formula per V2 Backend Execution Plan (T2.4.e):
 * - Base: 0.7
 * - lowConfidenceFields count: -0.15 per field
 * - OCR page-level confidence (optional, 0.0-1.0): linear map contribution (ocrConfidence - 0.7) * 0.1
 * - Deterministic validator pass/fail: +0.3 if pass, 0.0 if fail
 * - Cross-doc consistency: +0.2 if consistent, 0.0 if inconsistent/not checked
 * - Clamp strictly to [0.0, 1.0]
 */

export interface ConfidenceInput {
  base?: number;
  lowConfidenceCount?: number;
  ocrConfidence?: number;
  validatorPassed?: boolean;
  crossDocConsistent?: boolean;
}

export function computeCheckConfidence(input: ConfidenceInput): number {
  const base = input.base ?? 0.7;
  const lowConfPenalty = (input.lowConfidenceCount ?? 0) * -0.15;
  const validatorBonus = input.validatorPassed === true ? 0.3 : 0.0;
  const crossDocBonus = input.crossDocConsistent === true ? 0.2 : 0.0;

  let ocrAdjustment = 0;
  if (typeof input.ocrConfidence === 'number') {
    // Linear map: if OCR is 1.0, adds ~0.03, if 0.5, subtracts ~0.02
    ocrAdjustment = (input.ocrConfidence - 0.7) * 0.1;
  }

  const rawScore = base + lowConfPenalty + validatorBonus + crossDocBonus + ocrAdjustment;
  const clamped = Math.max(0.0, Math.min(1.0, rawScore));
  return Math.round(clamped * 100) / 100;
}
