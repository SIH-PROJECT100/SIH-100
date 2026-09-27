// Hard-coded expected outcomes for the 6 demo test PDFs.
// These are matched by filename during DEMO_MODE processing.
// This is the single source of truth for what each demo PDF must produce.

export interface StageResult {
  stage: string;
  status: 'passed' | 'failed' | 'warning' | 'not_applicable';
  detail: Record<string, unknown>;
}

export interface DemoPdfOutcome {
  filename: string;
  docType: 'pan_card' | 'gst_certificate' | 'oem_authorization';
  bidderTag: 'A' | 'B' | 'C';
  stages: StageResult[];
  overallStatus: 'verified' | 'warning' | 'failed' | 'human_review';
}

export const DEMO_PDF_OUTCOMES: Record<string, DemoPdfOutcome> = {
  'bidder_A_pan_card.pdf': {
    filename: 'bidder_A_pan_card.pdf',
    docType: 'pan_card',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { pan: 'AABCB1234K', name: 'Bharat Industrial Systems Pvt Ltd' },
        confidence: 0.93, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [{ field: 'pan_format', result: 'valid' }],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Income Tax Dept (SIMULATED)', result: 'ACTIVE',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: {} },
    ],
  },
  'bidder_A_gst_certificate.pdf': {
    filename: 'bidder_A_gst_certificate.pdf',
    docType: 'gst_certificate',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { gstin: '08AABCB1234K1Z7', legal_name: 'Bharat Industrial Systems Pvt Ltd' },
        confidence: 0.90, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'gstin_pan_match', result: 'match', note: 'PAN AABCB1234K matches bidder_A_pan_card.pdf' },
          { field: 'entity_name_match', result: 'match' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'GST Portal (SIMULATED)', result: 'ACTIVE', filingStatus: 'Regular',
      }},
      { stage: 'expiry_check', status: 'passed', detail: { validUntil: 'PERMANENT' } },
      { stage: 'officer_review', status: 'not_applicable', detail: {} },
    ],
  },
  'bidder_B_pan_card.pdf': {
    filename: 'bidder_B_pan_card.pdf',
    docType: 'pan_card',
    bidderTag: 'B',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { pan: 'AADCC5678M', name: 'ABC Industries Pvt Ltd' },
        confidence: 0.91, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [{ field: 'pan_format', result: 'valid' }],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Income Tax Dept (SIMULATED)', result: 'ACTIVE',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: {} },
    ],
  },
  'bidder_B_gst_certificate.pdf': {
    filename: 'bidder_B_gst_certificate.pdf',
    docType: 'gst_certificate',
    bidderTag: 'B',
    overallStatus: 'warning',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { gstin: '08AADCC5678M1Z9', legal_name: 'ABC Industries Private Limited' },
        confidence: 0.87, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'warning', detail: {
        checks: [
          { field: 'gstin_pan_match', result: 'match', note: 'PAN AADCC5678M matches bidder_B_pan_card.pdf' },
          { field: 'entity_name_match', result: 'variance',
            note: 'PAN document reads "ABC Industries Pvt Ltd". GST document reads "ABC Industries Private Limited". Name variance detected — requires officer review.' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'GST Portal (SIMULATED)', result: 'ACTIVE',
      }},
      { stage: 'expiry_check', status: 'passed', detail: { validUntil: 'PERMANENT' } },
      { stage: 'officer_review', status: 'warning', detail: {
        reason: 'Entity name variance requires manual confirmation',
      }},
    ],
  },
  'bidder_B_oem_authorization.pdf': {
    filename: 'bidder_B_oem_authorization.pdf',
    docType: 'oem_authorization',
    bidderTag: 'B',
    overallStatus: 'failed',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          manufacturer: 'SafetyFirst Industries Ltd',
          authorizedDealer: 'ABC Industries Pvt Ltd',
          validUntil: '2025-03-31',
        },
        confidence: 0.94, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [{ field: 'dealer_name_match', result: 'match' }],
      }},
      { stage: 'expiry_check', status: 'failed', detail: {
        bidDate: '2026-09-26', validUntil: '2025-03-31',
        daysExpired: 544,
        note: 'OEM authorization expired 544 days before bid submission date.',
      }},
      { stage: 'officer_review', status: 'failed', detail: {
        reason: 'Expired OEM authorization — bidder ineligible unless renewed',
      }},
    ],
  },
  'bidder_C_oem_authorization.pdf': {
    filename: 'bidder_C_oem_authorization.pdf',
    docType: 'oem_authorization',
    bidderTag: 'C',
    overallStatus: 'human_review',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: {} },
      { stage: 'ai_extraction', status: 'warning', detail: {
        extractedFields: {
          manufacturer: 'SafetyFirst Ind******* (partial)',
          validUntil: '31/0?/2026 (low confidence)',
        },
        confidence: 0.58, model: 'gemini-2.5-flash',
        note: 'Document scan quality is poor. Expiry date has one unreadable character.',
      }},
      { stage: 'confidence_gate', status: 'warning', detail: {
        extractionConfidence: 0.58,
        humanReviewThreshold: 0.60,
        autoApproveThreshold: 0.90,
        note: 'Confidence 0.58 is below the 0.60 human review threshold. AI will not guess the expiry date.',
      }},
      { stage: 'officer_review', status: 'warning', detail: {
        reason: 'Low-confidence extraction requires manual document review',
      }},
    ],
  },
};

export function getDemoOutcomeForFile(filename: string): DemoPdfOutcome | null {
  return DEMO_PDF_OUTCOMES[filename] ?? null;
}
