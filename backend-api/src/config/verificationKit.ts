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
  docType: 'pan_card' | 'gst_certificate' | 'oem_authorization' | 'udyam_certificate' | 'itr_document' | string;
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
  'PAN_Card_IncomeTax_AAWBS9999P.pdf': {
    filename: 'PAN_Card_IncomeTax_AAWBS9999P.pdf',
    docType: 'pan_card',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'PAN_Card_IncomeTax_AAWBS9999P.pdf', fileSizeBytes: 4205 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'DS INCOME TAX DEPARTMENT OF INDIA - AO WARD 14(2) MUMBAI',
        trustedCA: 'e-Mudhra Sub-CA for CBDT Tax Portals -> CCA India Sovereign Root 2026',
        signatureHash: 'a3f8c2b190d47e11c6d32849e7b23c91e0fa5b8d2279184910248adcf7319e01',
        message: 'Digitally signed by CBDT AO Ward 14(2) Mumbai. Certificate chain valid via e-Mudhra Sub-CA.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { pan: 'AAWBS9999P', name: 'Ananya Enterprises Pvt Ltd', father_name: 'Rajesh Verma (Director)', dob: '1984-06-15' },
        confidence: 0.96, model: 'gemini-2.5-flash',
        summary: 'Income tax verification record parsed successfully with 100% field certainty.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'pan_format', result: 'valid', value: 'AAWBS9999P', note: 'PAN format valid (5 letters, 4 digits, 1 letter)' },
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd', note: 'Entity name consistent with bidder profile' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'CBDT Income Tax e-Filing (SIMULATED)', result: 'ACTIVE & ALLOTTED',
        jurisdiction: 'WARD 14(2)(1), MUMBAI RANGE 14', status: 'ACTIVE_VERIFIED',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'sample_pan_signed.pdf': {
    filename: 'sample_pan_signed.pdf',
    docType: 'pan_card',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_pan_signed.pdf', fileSizeBytes: 4205 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'DS INCOME TAX DEPARTMENT OF INDIA - AO WARD 14(2) MUMBAI',
        trustedCA: 'e-Mudhra Sub-CA for CBDT Tax Portals -> CCA India Sovereign Root 2026',
        signatureHash: 'a3f8c2b190d47e11c6d32849e7b23c91e0fa5b8d2279184910248adcf7319e01',
        message: 'Digitally signed by CBDT AO Ward 14(2) Mumbai. Certificate chain valid via e-Mudhra Sub-CA.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { pan: 'AAWBS9999P', name: 'Ananya Enterprises Pvt Ltd', father_name: 'Rajesh Verma (Director)', dob: '1984-06-15' },
        confidence: 0.96, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'pan_format', result: 'valid', value: 'AAWBS9999P', note: 'PAN format valid (5 letters, 4 digits, 1 letter)' },
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd', note: 'Entity name consistent with bidder profile' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'CBDT Income Tax e-Filing (SIMULATED)', result: 'ACTIVE & ALLOTTED',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'GST_Certificate_27AAWBS9999P1Z5.pdf': {
    filename: 'GST_Certificate_27AAWBS9999P1Z5.pdf',
    docType: 'gst_certificate',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'GST_Certificate_27AAWBS9999P1Z5.pdf', fileSizeBytes: 4104 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'DS GOODS AND SERVICES TAX NETWORK 01 - STATE TAX OFFICER',
        trustedCA: 'Sify Safescrypt CA (Class 3 Organizational) -> CCA India Root',
        signatureHash: 'b4a9d3e218c50f229871a2c3d4e5f6789102837465abcedf0129384756102938',
        message: 'Digitally signed via GSTN National Infrastructure. Certificate valid.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { gstin: '27AAWBS9999P1Z5', legal_name: 'Ananya Enterprises Pvt Ltd', trade_name: 'Ananya Tech Innovations', registration_date: '2021-08-20' },
        confidence: 0.95, model: 'gemini-2.5-flash',
        summary: 'GSTIN registration certificate Form GST REG-06 verified.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'gstin_pan_match', result: 'match', note: 'Embedded PAN AAWBS9999P matches Income Tax PAN record' },
          { field: 'entity_name_match', result: 'match', note: 'Legal name matches registered entity 100%' },
          { field: 'gstin_format', result: 'valid', value: '27AAWBS9999P1Z5' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'GST Common Portal (SIMULATED)', result: 'ACTIVE / VALID',
        filingTrack: '100% On-Time (Nil Defaults in last 24M)',
      }},
      { stage: 'expiry_check', status: 'passed', detail: { validUntil: 'PERPETUITY (ACTIVE)' } },
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'sample_gst_signed.pdf': {
    filename: 'sample_gst_signed.pdf',
    docType: 'gst_certificate',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_gst_signed.pdf', fileSizeBytes: 4104 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'DS GOODS AND SERVICES TAX NETWORK 01 - STATE TAX OFFICER',
        trustedCA: 'Sify Safescrypt CA (Class 3 Organizational) -> CCA India Root',
        signatureHash: 'b4a9d3e218c50f229871a2c3d4e5f6789102837465abcedf0129384756102938',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: { gstin: '27AAWBS9999P1Z5', legal_name: 'Ananya Enterprises Pvt Ltd', trade_name: 'Ananya Tech Innovations' },
        confidence: 0.95, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'gstin_pan_match', result: 'match', note: 'Embedded PAN AAWBS9999P matches Income Tax record' },
          { field: 'entity_name_match', result: 'match' },
          { field: 'gstin_format', result: 'valid', value: '27AAWBS9999P1Z5' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'GST Common Portal (SIMULATED)', result: 'ACTIVE / VALID',
      }},
      { stage: 'expiry_check', status: 'passed', detail: { validUntil: 'PERPETUITY (ACTIVE)' } },
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf': {
    filename: 'Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf',
    docType: 'udyam_certificate',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf', fileSizeBytes: 4103 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'DS MINISTRY OF MSME - DEPUTY DIRECTOR (UDYAM VERIFICATION CELL)',
        trustedCA: 'NIC Sub-CA for Government Ministries -> Controller of Certifying Authorities (CCA)',
        signatureHash: 'c7d8e9f012a34b568910fedcba98765432109876543210fedcba9876543210ab',
        message: 'Digitally verified via National Informatics Centre (NIC-CA / DigiLocker).',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          udyam_number: 'UDYAM-MH-01-00892',
          enterprise_name: 'Ananya Enterprises Pvt Ltd',
          enterprise_type: 'Micro',
          msme_category: 'Manufacturing & Tech System Assembly',
          turnover: 'INR 2,40,00,000',
        },
        confidence: 0.97, model: 'gemini-2.5-flash',
        summary: 'Udyam MSME certificate validated under MSMED Act 2006.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'udyam_format', result: 'valid', value: 'UDYAM-MH-01-00892', note: 'Udyam registration format valid' },
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd' },
          { field: 'msme_preference_eligibility', result: 'eligible', note: 'Micro Enterprise qualified for EMD exemption and PPP 2012 purchase preference' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Ministry of MSME Udyam Portal (SIMULATED)', result: 'VALIDATED',
        status: 'ACTIVE_VERIFIED',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'sample_udyam_signed_digilocker.xml': {
    filename: 'sample_udyam_signed_digilocker.xml',
    docType: 'udyam_certificate',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_udyam_signed_digilocker.xml', fileSizeBytes: 1131 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'National Informatics Centre (DigiLocker Authority)',
        trustedCA: 'NIC-CA Sovereign Root',
        message: 'XML Digital Signature (W3C xmldsig) verified against DigiLocker Authority Root.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          udyam_number: 'UDYAM-MH-01-00892',
          enterprise_name: 'Ananya Enterprises Pvt Ltd',
          enterprise_type: 'Micro',
        },
        confidence: 0.99, model: 'xml-schema-parser',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'udyam_format', result: 'valid', value: 'UDYAM-MH-01-00892' },
          { field: 'entity_name_match', result: 'match' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Ministry of MSME DigiLocker Pool', result: 'VALIDATED',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'ITR_V_Acknowledgement_AY2024-25.pdf': {
    filename: 'ITR_V_Acknowledgement_AY2024-25.pdf',
    docType: 'itr_document',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'ITR_V_Acknowledgement_AY2024-25.pdf', fileSizeBytes: 4091 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'E-VERIFICATION PORTAL - INCOME TAX DEPARTMENT GOI (EVC AADHAAR OTP)',
        trustedCA: 'National Informatics Centre e-Sign Gateway -> CCA Root India',
        signatureHash: 'e8d7c6b5a493827101fedcba9876543210abcedf1234567890fedcba09871234',
        message: 'E-verified via National E-Filing System. Direct taxes central system timestamp intact.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          pan: 'AAWBS9999P',
          name: 'Ananya Enterprises Pvt Ltd',
          ack_number: '981245012849102',
          assessment_year: '2024-25',
          gross_income: 24000000,
          tax_paid: 680000,
          form_type: 'ITR-6',
        },
        confidence: 0.96, model: 'gemini-2.5-flash',
        summary: 'Income Tax Return Form ITR-V parsed with zero financial discrepancy.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'pan_match', result: 'match', value: 'AAWBS9999P' },
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd' },
          { field: 'solvency_check', result: 'passed', note: 'Gross Turnover of INR 2.40 Cr meets financial criteria' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Income Tax Direct Taxes Central System (SIMULATED)', result: 'E-VERIFIED (TIMELY FILING)',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'sample_itr_unsigned.pdf': {
    filename: 'sample_itr_unsigned.pdf',
    docType: 'itr_document',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_itr_unsigned.pdf', fileSizeBytes: 4091 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: false, verified: true,
        signerName: 'Statutory Self-Declaration / Acknowledgement',
        message: 'Direct taxes e-filing acknowledgement verified via CPC acknowledgement barcode.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          pan: 'AAWBS9999P',
          name: 'Ananya Enterprises Pvt Ltd',
          ack_number: '981245012849102',
          assessment_year: '2024-25',
          gross_income: 24000000,
        },
        confidence: 0.95, model: 'gemini-2.5-flash',
        summary: 'ITR acknowledgement verification completed.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'pan_match', result: 'match', value: 'AAWBS9999P' },
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Income Tax Direct Taxes Central System (SIMULATED)', result: 'E-VERIFIED (TIMELY FILING)',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'Debarment_Non_Blacklisting_Declaration.pdf': {
    filename: 'Debarment_Non_Blacklisting_Declaration.pdf',
    docType: 'oem_authorization',
    bidderTag: 'A',
    overallStatus: 'verified',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'Debarment_Non_Blacklisting_Declaration.pdf', fileSizeBytes: 3684 } },
      { stage: 'signature_verification', status: 'passed', detail: {
        hasSignature: true, verified: true,
        signerName: 'RAJESH VERMA - MANAGING DIRECTOR (ANANYA ENTERPRISES PVT LTD)',
        trustedCA: 'e-Mudhra Class 3 Individual and Organization CA -> Controller of Certifying Authorities',
        signatureHash: 'f8e7d6c5b4a392817012abcdef0123456789abcdef0123456789abcdef01234567',
        message: 'Digitally executed via Class-3 DSC. Signer confirmed as Managing Director.',
      }},
      { stage: 'ai_extraction', status: 'passed', detail: {
        extractedFields: {
          companyName: 'Ananya Enterprises Pvt Ltd',
          signatory: 'Rajesh Verma (Director)',
          pan: 'AAWBS9999P',
          stamp_certificate: 'MH-STAMP-2026-99218',
          gfr_rule: 'Rule 151 of GFR 2017 & GeM GTC Clause 4',
        },
        confidence: 0.97, model: 'gemini-2.5-flash',
        summary: 'Non-debarment and statutory integrity undertaking verified under Rule 151 of GFR 2017.',
      }},
      { stage: 'cross_check', status: 'passed', detail: {
        checks: [
          { field: 'entity_name_match', result: 'match', value: 'Ananya Enterprises Pvt Ltd' },
          { field: 'debarment_status', result: 'clean', note: 'Deponent confirms zero debarment across Central/State Govt and PSUs' },
          { field: 'land_border_compliance', result: 'passed', note: 'Rule 144(xi) GFR 2017 domestic ownership confirmed' },
        ],
      }},
      { stage: 'portal_verification', status: 'passed', detail: {
        source: 'Central Debarment & Vigilance Registry (SIMULATED)', result: 'CLEAR - NO INCIDENTS',
      }},
      { stage: 'officer_review', status: 'not_applicable', detail: { required: false } },
    ],
  },
  'sample_tampered.pdf': {
    filename: 'sample_tampered.pdf',
    docType: 'pan_card',
    bidderTag: 'A',
    overallStatus: 'failed',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_tampered.pdf', fileSizeBytes: 2910 } },
      { stage: 'signature_verification', status: 'failed', detail: {
        hasSignature: true, verified: false, isTampered: true,
        reason: 'signature_invalid',
        message: 'SIGNATURE DIGEST MISMATCH -- TAMPERING DETECTED! Cryptographic hash d41d8cd98f00b204e9800998ecf8427e does not match signed certificate digest.',
        signatureHash: 'd41d8cd98f00b204e9800998ecf8427e',
      }},
      { stage: 'ai_extraction', status: 'warning', detail: {
        extractedFields: { pan: 'XX99999999', company: 'Shell Enterprise Fake Ltd' },
        confidence: 0.52, model: 'gemini-2.5-flash',
        summary: 'Simulated adversarial anomalies detected in document byte stream.',
      }},
      { stage: 'cross_check', status: 'failed', detail: {
        checks: [
          { field: 'signature_digest', result: 'tampered', note: 'Envelope signature broken. Byte manipulation detected.' },
          { field: 'pan_format', result: 'invalid', value: 'XX99999999', note: 'PAN altered to XX99999999, failing statutory CBDT MOD-11 checksum algorithm.' },
          { field: 'entity_name_match', result: 'variance', note: 'Injected shell company identity "Shell Enterprise Fake Ltd" does not match bidder "Ananya Enterprises".' },
        ],
        error: 'Cryptographic digest mismatch and invalid entity identity detected.',
        reason: 'cryptographic_tampering',
      }},
      { stage: 'portal_verification', status: 'failed', detail: {
        source: 'GeM Security & Trust Gate', result: 'REJECTED - SECURITY INCIDENT',
        reason: 'Cryptographic integrity failure. Tampered document detected.',
      }},
      { stage: 'officer_review', status: 'failed', detail: {
        required: true, decision: 'rejected',
        reason: 'IMMEDIATE RED FLAG: Cryptographic tampering detected. Bidder flagged for security audit and debarment review.',
      }},
    ],
  },
  'sample_tampered_document.pdf': {
    filename: 'sample_tampered_document.pdf',
    docType: 'pan_card',
    bidderTag: 'A',
    overallStatus: 'failed',
    stages: [
      { stage: 'uploaded', status: 'passed', detail: { filename: 'sample_tampered_document.pdf', fileSizeBytes: 2910 } },
      { stage: 'signature_verification', status: 'failed', detail: {
        hasSignature: true, verified: false, isTampered: true,
        reason: 'signature_invalid',
        message: 'SIGNATURE DIGEST MISMATCH -- TAMPERING DETECTED! Cryptographic hash does not match signed certificate digest.',
      }},
      { stage: 'ai_extraction', status: 'warning', detail: {
        extractedFields: { pan: 'XX99999999', company: 'Shell Enterprise Fake Ltd' },
        confidence: 0.52, model: 'gemini-2.5-flash',
      }},
      { stage: 'cross_check', status: 'failed', detail: {
        checks: [
          { field: 'signature_digest', result: 'tampered', note: 'Envelope signature broken.' },
          { field: 'pan_format', result: 'invalid', value: 'XX99999999' },
          { field: 'entity_name_match', result: 'variance' },
        ],
        error: 'Cryptographic digest mismatch.',
        reason: 'cryptographic_tampering',
      }},
      { stage: 'portal_verification', status: 'failed', detail: {
        source: 'GeM Security & Trust Gate', result: 'REJECTED - SECURITY INCIDENT',
      }},
      { stage: 'officer_review', status: 'failed', detail: {
        required: true, decision: 'rejected',
        reason: 'IMMEDIATE RED FLAG: Cryptographic tampering detected.',
      }},
    ],
  },
};

export function getDemoOutcomeForFile(filename: string): DemoPdfOutcome | null {
  if (!filename) return null;
  // 1. Direct match
  if (DEMO_PDF_OUTCOMES[filename]) return DEMO_PDF_OUTCOMES[filename];

  // 2. Basename match
  const baseName = filename.split(/[/\\]/).pop() || filename;
  if (DEMO_PDF_OUTCOMES[baseName]) return DEMO_PDF_OUTCOMES[baseName];

  // 3. Case-insensitive match
  const lower = baseName.toLowerCase();
  for (const [key, outcome] of Object.entries(DEMO_PDF_OUTCOMES)) {
    if (key.toLowerCase() === lower) return outcome;
  }

  // 4. Exact / Fuzzy / Prefix match for all official demo documents
  if (lower.includes('tamper')) {
    return DEMO_PDF_OUTCOMES['sample_tampered.pdf'];
  }
  if (lower.includes('pan')) {
    return DEMO_PDF_OUTCOMES['PAN_Card_IncomeTax_AAWBS9999P.pdf'];
  }
  if (lower.includes('gst')) {
    return DEMO_PDF_OUTCOMES['GST_Certificate_27AAWBS9999P1Z5.pdf'];
  }
  if (lower.includes('udyam') || lower.includes('msme')) {
    return DEMO_PDF_OUTCOMES['Udyam_Registration_Certificate_UDYAM-MH-01-00892.pdf'];
  }
  if (lower.includes('itr') || lower.includes('tax_filing') || lower.includes('ay2024') || lower.includes('acknowledgement')) {
    return DEMO_PDF_OUTCOMES['ITR_V_Acknowledgement_AY2024-25.pdf'];
  }
  if (lower.includes('debarment') || lower.includes('blacklisting') || lower.includes('oem') || lower.includes('declaration') || lower.includes('affidavit')) {
    return DEMO_PDF_OUTCOMES['Debarment_Non_Blacklisting_Declaration.pdf'];
  }

  return null;
}
