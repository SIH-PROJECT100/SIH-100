export interface VerificationMode {
  stages: string[];
  portalTier: string;
  digilockerCapable?: boolean;
  expectedFields: string[];
  validityDays: number;
}

export const VERIFICATION_MODES: Record<string, VerificationMode> = {
  pan_card: {
    stages: ['uploaded', 'ai_extraction', 'cross_check', 'portal_verification', 'officer_review'],
    portalTier: 'simulated',
    expectedFields: ['pan', 'name', 'father_name', 'dob'],
    validityDays: 3650,
  },
  gst_certificate: {
    stages: ['uploaded', 'ai_extraction', 'cross_check', 'portal_verification', 'expiry_check', 'officer_review'],
    portalTier: 'simulated',
    expectedFields: ['gstin', 'legal_name', 'trade_name', 'registration_date'],
    validityDays: 365,
  },
  udyam_certificate: {
    stages: ['uploaded', 'signature_verification', 'ai_extraction', 'cross_check', 'portal_verification', 'officer_review'],
    portalTier: 'simulated',
    digilockerCapable: true,
    expectedFields: ['udyam_number', 'enterprise_name', 'enterprise_type', 'msme_category'],
    validityDays: 1825,
  },
  itr_document: {
    stages: ['uploaded', 'ai_extraction', 'cross_check', 'officer_review'],
    portalTier: 'none',
    expectedFields: ['pan', 'assessment_year', 'gross_income', 'tax_paid', 'form_type'],
    validityDays: 365,
  },
};
