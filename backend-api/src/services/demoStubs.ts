/**
 * DEMO_MODE Stub Service — src/services/demoStubs.ts
 *
 * When DEMO_MODE=true is set:
 *   - Gemini API calls are replaced with deterministic fixture responses
 *   - DigiLocker API calls use local mock fixture data
 *   - Portal API calls use local mock responses
 *   - Rate limits remain ACTIVE (we want to demo them working)
 *   - All ledger writes remain REAL (audit trail preserved)
 *
 * Design:
 *   - This file exports a isDemoMode() check and fixture generators
 *   - Each verification tier checks isDemoMode() before calling the real API
 *   - The full-flow integration test runs with DEMO_MODE=true to validate
 *     the "wifi dies live" insurance scenario
 *
 * Used by:
 *   - src/services/verification/tiers/ai.ts
 *   - src/services/verification/tiers/digilocker.ts
 *   - src/services/verification/tiers/portal.ts
 */

import { config } from '../config.js';

// ─── Mode flag ────────────────────────────────────────────────────────────────

export function isDemoMode(): boolean {
  return config.DEMO_MODE === true;
}

// ─── Gemini Fixture Response ──────────────────────────────────────────────────

/**
 * Returns a deterministic fixture response that mimics what Gemini 2.5 Flash
 * would return for a standard GST/PAN document extraction.
 *
 * All fields are structurally valid so downstream validators pass.
 */
export function getGeminiFixtureResponse(bidderId?: string, pan?: string | null): object {
  const companyPan = pan || 'AAFCS1234H';
  return {
    documentType: 'gst_cert',
    companyName: bidderId ? `Demo Company ${bidderId}` : 'Demo Company Pvt Ltd',
    pan: companyPan,
    gstin: `07${companyPan}1ZS`,
    udyamNumber: 'UDYAM-DL-01-0000001',
    registrationDate: '2020-04-01',
    issuingAuthority: 'GSTN',
    extractedFields: {
      legalName: bidderId ? `Demo Company ${bidderId}` : 'Demo Company Pvt Ltd',
      tradeName: 'Demo Co',
      registrationDate: '2020-04-01',
      stateCode: '07',
      taxpayerType: 'Regular',
    },
    lowConfidenceFields: [],
  };
}

/**
 * Returns a deterministic AI verification result fixture.
 * Confidence is set at 0.90 (above auto-flag threshold) to ensure
 * the demo doesn't generate false positives.
 */
export function getAiVerificationFixture(params: {
  bidderId: string;
  pan?: string | null;
  gstin?: string | null;
  companyName?: string;
}): object {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  return {
    name: 'ai_extraction',
    category: 'document_verification',
    status: 'verified',
    trustSource: 'Gemini 2.5 Flash [DEMO_MODE fixture]',
    trust_source: 'ai_extracted',
    confidence: 0.92,
    value: params.pan || 'AAFCS1234H',
    detail: `[DEMO_MODE] AI extraction fixture — no real Gemini call made. All fields structurally valid.`,
    evidence: `[DEMO_MODE] Document verified via fixture. PAN=${params.pan || 'AAFCS1234H'}, GSTIN=${params.gstin || '07AAFCS1234H1ZS'}.`,
    simulated: false,
    demoMode: true,
    verifiedAt: now.toISOString(),
    verificationExpiresAt: expiresAt.toISOString(),
    extractedData: getGeminiFixtureResponse(params.bidderId, params.pan),
    validationSummary: {
      panValid: true,
      gstinValid: true,
      udyamValid: false,
      crossDocConsistent: true,
    },
    promptVersion: 'DEMO_MODE_FIXTURE_V1',
  };
}

// ─── DigiLocker Fixture Response ──────────────────────────────────────────────

/**
 * Returns a deterministic DigiLocker verification fixture.
 * Mimics a successfully validated XMLDSig response.
 */
export function getDigiLockerFixture(params: {
  bidderId: string;
  companyName?: string;
  pan?: string | null;
}): object {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  return {
    name: 'digilocker',
    category: 'identity_verification',
    status: 'passed',
    trustSource: 'DigiLocker [DEMO_MODE fixture]',
    confidence: 0.95,
    value: params.companyName || `Demo Company ${params.bidderId}`,
    detail: '[DEMO_MODE] DigiLocker XMLDSig fixture — mock certificate chain validated.',
    evidence: `[DEMO_MODE] Aadhaar/PAN verification via DigiLocker fixture for ${params.companyName || params.bidderId}.`,
    simulated: false,
    demoMode: true,
    verifiedAt: now.toISOString(),
    verificationExpiresAt: expiresAt.toISOString(),
    signatureValid: true,
    certificateChain: ['mock-root-ca', 'mock-issuer-ca', 'mock-entity-cert'],
  };
}

// ─── Portal Fixture Response ───────────────────────────────────────────────────

/**
 * Returns a deterministic portal verification fixture.
 * Mimics GST portal + MSME portal QR verification results.
 */
export function getPortalFixture(params: {
  bidderId: string;
  pan?: string | null;
  gstin?: string | null;
  udyamNumber?: string | null;
}): object {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  return {
    name: 'portal',
    category: 'portal_verification',
    status: 'passed',
    trustSource: 'GST Portal + MSME Portal [DEMO_MODE fixture]',
    confidence: 0.88,
    value: params.gstin || '07AAFCS1234H1ZS',
    detail: '[DEMO_MODE] Portal QR scan fixture — local mock responses used.',
    evidence: `[DEMO_MODE] GSTIN ${params.gstin || '07AAFCS1234H1ZS'} verified via portal fixture. MSME registration confirmed.`,
    simulated: false,
    demoMode: true,
    verifiedAt: now.toISOString(),
    verificationExpiresAt: expiresAt.toISOString(),
    gstActive: true,
    msmeRegistered: true,
    returnsFiled: true,
    portalChecks: ['gst_active', 'msme_registered', 'itr_filed'],
  };
}
