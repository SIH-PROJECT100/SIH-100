/**
 * GeM Compliance V2 — Official i18n Glossary (Feature 8)
 *
 * Mandatory microcopy strings and official domain vocabulary.
 * Cross-checked verbatim against ANTIGRAVITY_PROMPT_GEM_COMPLIANCE_V2.md Feature 8.
 */

export interface GlossaryEntry {
  en: string;
  hi: string;
}

/**
 * 14 Mandatory microcopy keys from Feature 8.
 * Must match ANTIGRAVITY_PROMPT_GEM_COMPLIANCE_V2.md lines 563-579 verbatim.
 */
export const MANDATORY_MICROCOPY = {
  'trust.disclaimer': {
    en: 'Trust score is historical evidence. It does not replace verification of this specific bid.',
    hi: 'विश्वास स्कोर एक ऐतिहासिक साक्ष्य है। यह इस विशेष बोली के सत्यापन का विकल्प नहीं है।',
  },
  'award.warning.appendedToLedger': {
    en: 'This appends a permanent entry to the Trust Ledger. It will be reviewed by the second officer and visible in the public transparency view.',
    hi: 'यह विश्वास बही में एक स्थायी प्रविष्टि जोड़ता है। इसकी समीक्षा द्वितीय अधिकारी द्वारा की जाएगी और यह सार्वजनिक पारदर्शिता दृश्य में दिखाई देगी।',
  },
  'errors.awardBlockedStaleVerification': {
    en: "Winner's verification is stale. Re-run verification before awarding this tender.",
    hi: 'विजेता का सत्यापन पुराना है। इस निविदा को प्रदान करने से पहले पुनः सत्यापन करें।',
  },
  'errors.sameOfficerCannotDoubleSign': {
    en: 'The same officer cannot approve both primary and secondary reviews. A second officer must sign off.',
    hi: 'एक ही अधिकारी प्राथमिक और द्वितीय दोनों समीक्षाओं को अनुमोदित नहीं कर सकता। द्वितीय अधिकारी द्वारा अनुमोदन आवश्यक है।',
  },
  'errors.reasonMandatory': {
    en: 'Reason is mandatory when disqualifying or requesting clarification.',
    hi: 'अपात्र घोषित करते समय या स्पष्टीकरण माँगते समय कारण देना अनिवार्य है।',
  },
  'errors.feeUnpaid': {
    en: 'Application fee is not paid yet. Verification cannot proceed.',
    hi: 'आवेदन शुल्क का भुगतान अभी तक नहीं किया गया है। सत्यापन आगे नहीं बढ़ सकता।',
  },
  'session.expired': {
    en: 'Session expired, please login again.',
    hi: 'सत्र समाप्त हो गया, कृपया पुनः प्रवेश करें।',
  },
  'access.denied.admin': {
    en: 'Access denied: Administrator privileges required.',
    hi: 'पहुँच अस्वीकृत: प्रशासक अधिकार आवश्यक हैं।',
  },
  'rateLimit.login': {
    en: 'Too many login attempts. Please wait a few minutes before trying again.',
    hi: 'बहुत अधिक प्रवेश प्रयास। कृपया कुछ मिनट प्रतीक्षा करके पुनः प्रयास करें।',
  },
  'secondary.awaitingPrimary': {
    en: 'Primary reviewer has completed review. Submit your independent decision to reveal it.',
    hi: 'प्राथमिक समीक्षक ने समीक्षा पूर्ण कर दी है। इसे देखने के लिए अपना स्वतंत्र निर्णय प्रस्तुत करें।',
  },
  'banner.staleVerification': {
    en: 'Verification is {days} days old — re-verify before proceeding.',
    hi: 'सत्यापन {days} दिन पुराना है — आगे बढ़ने से पहले पुनः सत्यापित करें।',
  },
  'cta.reverifyNow': {
    en: 'Re-Verify Now',
    hi: 'अभी पुनः सत्यापित करें',
  },
  'cta.inspectAndDecide': {
    en: 'Inspect & Decide',
    hi: 'जाँच करें और निर्णय लें',
  },
  'cta.openTriage': {
    en: 'Open Triage Workspace',
    hi: 'जाँच कार्यक्षेत्र खोलें',
  },
} as const;

/**
 * Standard System Errors & Hardening Keys
 */
export const SYSTEM_ERROR_KEYS = {
  'rateLimit.exceeded': {
    en: 'Too many requests, please try again later.',
    hi: 'अत्यधिक अनुरोध, कृपया बाद में पुनः प्रयास करें।',
  },
  'session.maxLifetimeExceeded': {
    en: 'Session has exceeded maximum allowable lifetime. Please login again.',
    hi: 'सत्र अधिकतम अनुमेय जीवनकाल से अधिक हो गया है। कृपया पुनः प्रवेश करें।',
  },
  'errors.payloadTooLarge': {
    en: 'Request body exceeds the 2 MB limit',
    hi: 'अनुरोध मुख्य भाग 2 MB की सीमा से अधिक है',
  },
  'errors.validation': {
    en: 'Invalid request data',
    hi: 'अमान्य अनुरोध डेटा',
  },
  'errors.unauthenticated': {
    en: 'Missing or invalid Authorization header',
    hi: 'अनुपलब्ध या अमान्य प्राधिकरण हेडर',
  },
  'errors.invalidToken': {
    en: 'Invalid or expired token',
    hi: 'अमान्य या समाप्त टोकन',
  },
  'errors.credentials': {
    en: 'Invalid email or password',
    hi: 'अमान्य ईमेल या पासवर्ड',
  },
  'errors.forbidden': {
    en: 'Insufficient permissions',
    hi: 'अपर्याप्त अनुमतियाँ',
  },
  'errors.notFound': {
    en: 'Resource not found',
    hi: 'संसाधन नहीं मिला',
  },
  'errors.conflict': {
    en: 'Conflict with existing state',
    hi: 'मौजूदा स्थिति के साथ विरोधाभास',
  },
  'errors.unqualifiedWinner': {
    en: 'Selected winner is not qualified',
    hi: 'चयनित विजेता योग्य नहीं है',
  },
  'errors.internal': {
    en: 'Internal server error',
    hi: 'आंतरिक सर्वर त्रुटि',
  },
  'errors.database': {
    en: 'Database request error',
    hi: 'डेटाबेस अनुरोध त्रुटि',
  },
  // Legacy aliases
  'INVALID_AWARD_PAYLOAD': {
    en: 'Invalid award payload',
    hi: 'अमान्य अधिनिर्णय डेटा',
  },
  'UNQUALIFIED_WINNER': {
    en: 'Winning bidder must be qualified before awarding',
    hi: 'निविदा प्रदान करने से पहले विजेता बोलीदाता का पात्र होना अनिवार्य है',
  },
  'FEE_UNPAID': {
    en: 'Application fee is not paid yet. Verification cannot proceed.',
    hi: 'आवेदन शुल्क का भुगतान अभी तक नहीं किया गया है। सत्यापन आगे नहीं बढ़ सकता।',
  },
  'PAYMENT_REQUIRED': {
    en: 'Application fee payment required before verification',
    hi: 'सत्यापन से पहले आवेदन शुल्क भुगतान आवश्यक है',
  },
  'ERR_VALIDATION': {
    en: 'Invalid request data',
    hi: 'अमान्य अनुरोध डेटा',
  },
  'ERR_UNAUTHENTICATED': {
    en: 'Authentication required',
    hi: 'प्रमाणीकरण आवश्यक है',
  },
  'ERR_INVALID_TOKEN': {
    en: 'Invalid or expired token',
    hi: 'अमान्य या समाप्त टोकन',
  },
  'ERR_CREDENTIALS': {
    en: 'Invalid email or password',
    hi: 'अमान्य ईमेल या पासवर्ड',
  },
  'ERR_FORBIDDEN': {
    en: 'Insufficient permissions',
    hi: 'अपर्याप्त अनुमतियाँ',
  },
  'ERR_NOT_FOUND': {
    en: 'Resource not found',
    hi: 'संसाधन नहीं मिला',
  },
  'ERR_CONFLICT': {
    en: 'Conflict with existing record',
    hi: 'मौजूदा रिकॉर्ड के साथ विरोधाभास',
  },
  'ERR_DB_CONSTRAINT': {
    en: 'Database constraint violation',
    hi: 'डेटाबेस बाधा उल्लंघन',
  },
  'ERR_DB_RECORD_NOT_FOUND': {
    en: 'Database record not found',
    hi: 'डेटाबेस रिकॉर्ड नहीं मिला',
  },
  'ERR_DB_VALIDATION': {
    en: 'Database validation error',
    hi: 'डेटाबेस सत्यापन त्रुटि',
  },
  'ERR_RATE_LIMITED': {
    en: 'Rate limit exceeded',
    hi: 'दर सीमा पार हो गई',
  },
  'ERR_PAYLOAD_TOO_LARGE': {
    en: 'Request body exceeds the 2 MB limit',
    hi: 'अनुरोध मुख्य भाग 2 MB की सीमा से अधिक है',
  },
  'ERR_INTERNAL': {
    en: 'Internal server error',
    hi: 'आंतरिक सर्वर त्रुटि',
  },
} as const;

/**
 * Feature 8 Domain Vocabulary (Actions, States, Badges, Delivery, Cartel)
 */
export const DOMAIN_VOCABULARY = {
  // Risk Tiers
  'risk.risk': { en: 'Risk', hi: 'जोखिम' },
  'risk.critical': { en: 'Critical Risk', hi: 'गंभीर जोखिम' },
  'risk.high': { en: 'High Risk', hi: 'उच्च जोखिम' },
  'risk.medium': { en: 'Medium Risk', hi: 'मध्यम जोखिम' },
  'risk.low': { en: 'Low Risk', hi: 'निम्न जोखिम' },

  // Decision actions
  'action.qualify': { en: 'Qualify', hi: 'पात्र घोषित करें' },
  'action.disqualify': { en: 'Disqualify', hi: 'अपात्र घोषित करें' },
  'action.requestClarification': { en: 'Request Clarification', hi: 'स्पष्टीकरण माँगें' },
  'action.approve': { en: 'Approve', hi: 'अनुमोदित करें' },
  'action.reject': { en: 'Reject', hi: 'अस्वीकार करें' },
  'action.reason': { en: 'Reason', hi: 'कारण' },
  'action.justification': { en: 'Justification', hi: 'औचित्य' },
  'action.standoutFactors': { en: 'Standout Factors', hi: 'विशिष्ट कारक' },
  'action.remark': { en: 'Remark', hi: 'टिप्पणी' },
  'action.submitDecision': { en: 'Submit Decision', hi: 'निर्णय प्रस्तुत करें' },
  'action.awardTender': { en: 'Award Tender', hi: 'निविदा प्रदान करें' },

  // Approval states
  'approval.pending': { en: 'Pending', hi: 'लंबित' },
  'approval.primaryApproved': { en: 'Primary Approved', hi: 'प्राथमिक स्तर पर अनुमोदित' },
  'approval.fullyApproved': { en: 'Fully Approved', hi: 'पूर्ण रूप से अनुमोदित' },
  'approval.awaitingSecondary': { en: 'Awaiting Secondary Review', hi: 'द्वितीय समीक्षा प्रतीक्षारत' },
  'approval.rejected': { en: 'Rejected', hi: 'अस्वीकृत' },
  'approval.concurrence': { en: 'Concurrence: Yes / No', hi: 'सहमति: हाँ / नहीं' },

  // Verification freshness
  'freshness.fresh': { en: 'Fresh', hi: 'नवीन / मान्य' },
  'freshness.stale': { en: 'Stale', hi: 'पुराना (n दिन पुराना)' },
  'freshness.expired': { en: 'Expired', hi: 'अवधि समाप्त' },
  'freshness.reverifyNow': { en: 'Re-Verify Now', hi: 'अभी पुनः सत्यापित करें' },
  'freshness.validity': { en: 'Verification Validity', hi: 'सत्यापन वैधता अवधि' },

  // Fees & payments
  'fees.fee': { en: 'Fee', hi: 'शुल्क' },
  'fees.payment': { en: 'Payment', hi: 'भुगतान' },
  'fees.paid': { en: 'Paid', hi: 'भुगतान किया गया' },
  'fees.refunded': { en: 'Refunded', hi: 'वापस किया गया' },
  'fees.forfeited': { en: 'Forfeited', hi: 'ज़ब्त' },
  'fees.payApplicationFee': { en: 'Pay Application Fee', hi: 'आवेदन शुल्क भुगतान करें' },
  'fees.refundPolicy': { en: 'Refund Policy', hi: 'धन वापसी नीति' },

  // Delivery tracker
  'delivery.poIssued': { en: 'PO Issued', hi: 'क्रय आदेश जारी' },
  'delivery.shipped': { en: 'Shipped', hi: 'प्रेषित' },
  'delivery.received': { en: 'Received', hi: 'प्राप्त' },
  'delivery.inspected': { en: 'Inspected', hi: 'निरीक्षण पूर्ण' },
  'delivery.accepted': { en: 'Accepted', hi: 'स्वीकृत' },
  'delivery.paymentReleased': { en: 'Payment Released', hi: 'भुगतान जारी' },
  'delivery.onTime': { en: 'On Time', hi: 'समय पर' },
  'delivery.late': { en: 'Late', hi: 'विलंब से' },
  'delivery.missed': { en: 'Missed', hi: 'पूर्ण नहीं / छूटा हुआ' },
  'delivery.dueDate': { en: 'Due Date', hi: 'नियत तिथि' },
  'delivery.markComplete': { en: 'Mark Complete', hi: 'पूर्ण चिह्नित करें' },

  // Cartel detection
  'cartel.cartel': { en: 'Cartel', hi: 'गुट / कार्टेल' },
  'cartel.collusion': { en: 'Collusion', hi: 'मिलीभगत' },
  'cartel.collusionRisk': { en: 'Collusion Risk', hi: 'मिलीभगत जोखिम' },
  'cartel.detectCollusion': { en: 'Detect Collusion', hi: 'मिलीभगत का पता लगाएँ' },
  'cartel.cluster': { en: 'Cluster', hi: 'समूह' },
  'cartel.signal': { en: 'Signal', hi: 'संकेत' },

  // Common UI actions
  'ui.login': { en: 'Login', hi: 'प्रवेश' },
  'ui.logout': { en: 'Logout', hi: 'बाहर निकलें' },
  'ui.submit': { en: 'Submit', hi: 'प्रस्तुत करें' },
  'ui.cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'ui.confirm': { en: 'Confirm', hi: 'पुष्टि करें' },
  'ui.save': { en: 'Save', hi: 'सहेजें' },
  'ui.saveChanges': { en: 'Save Changes', hi: 'परिवर्तन सहेजें' },
  'ui.search': { en: 'Search', hi: 'खोजें' },
  'ui.filter': { en: 'Filter', hi: 'छाँटें' },
  'ui.sort': { en: 'Sort', hi: 'क्रमबद्ध करें' },
  'ui.download': { en: 'Download', hi: 'डाउनलोड करें' },
  'ui.export': { en: 'Export', hi: 'निर्यात करें' },
  'ui.language': { en: 'Language', hi: 'भाषा' },
  'ui.history': { en: 'History', hi: 'इतिहास' },
  'ui.profile': { en: 'Profile', hi: 'प्रोफ़ाइल' },
  'ui.settings': { en: 'Settings', hi: 'सेटिंग्स' },
  'ui.back': { en: 'Back', hi: 'वापस' },
  'ui.next': { en: 'Next', hi: 'आगे' },
  'ui.close': { en: 'Close', hi: 'बंद करें' },
  'ui.reveal': { en: 'Reveal', hi: 'प्रकट करें' },
  'ui.revealFullPii': { en: 'Reveal Full PII', hi: 'पूर्ण PII प्रकट करें' },
  'ui.auditTrailEntryLogged': { en: 'Audit Trail Entry Logged', hi: 'अंकेक्षण प्रविष्टि दर्ज की गई' },

  // Profile & Badges
  'profile.trustProfile': { en: 'Trust Profile', hi: 'विश्वास प्रोफ़ाइल' },
  'profile.totalBidsSubmitted': { en: 'Total Bids Submitted', hi: 'कुल प्रस्तुत बोलियाँ' },
  'profile.bidsWon': { en: 'Bids Won', hi: 'विजयी बोलियाँ' },
  'profile.bidsLost': { en: 'Bids Lost', hi: 'असफल बोलियाँ' },
  'profile.onTimeDeliveries': { en: 'On-Time Deliveries', hi: 'समय पर वितरण' },
  'profile.lateDeliveries': { en: 'Late Deliveries', hi: 'विलंब से वितरण' },
  'profile.failedDeliveries': { en: 'Failed Deliveries', hi: 'असफल वितरण' },
  'profile.disqualifications': { en: 'Disqualifications', hi: 'अपात्रता' },
  'profile.badgesEarned': { en: 'Badges Earned', hi: 'अर्जित बैज' },
  'badges.firstBid': { en: 'First Bid', hi: 'पहली बोली' },
  'badges.verifiedVeteran': { en: 'Verified Veteran', hi: 'सत्यापित अनुभवी' },
  'badges.cleanSlate': { en: 'Clean Slate', hi: 'निष्कलंक' },
} as const;

/** Complete master glossary */
export const GLOSSARY: Record<string, GlossaryEntry> = {
  ...MANDATORY_MICROCOPY,
  ...SYSTEM_ERROR_KEYS,
  ...DOMAIN_VOCABULARY,
};

/**
 * Returns the dictionary keyed by string ID for the given language ('en' | 'hi').
 */
export function getGlossaryStrings(lang: 'en' | 'hi' = 'en'): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    result[key] = lang === 'hi' ? entry.hi : entry.en;
  }
  return result;
}

/**
 * Resolves a key or message to a code and its localized representation.
 */
export function resolveError(codeOrMessage: string, lang: 'en' | 'hi' = 'en'): { code: string; message: string; messageHi?: string } {
  // 1. Direct key lookup in GLOSSARY
  if (GLOSSARY[codeOrMessage]) {
    const entry = GLOSSARY[codeOrMessage];
    return {
      code: codeOrMessage,
      message: entry.en,
      ...(lang === 'hi' ? { messageHi: entry.hi } : {}),
    };
  }

  // 2. Lookup by English message match
  for (const [key, entry] of Object.entries(GLOSSARY)) {
    if (entry.en.toLowerCase() === codeOrMessage.toLowerCase()) {
      return {
        code: key,
        message: entry.en,
        ...(lang === 'hi' ? { messageHi: entry.hi } : {}),
      };
    }
  }

  // 2b. Semantic match for dual-officer error messages
  if (codeOrMessage.toLowerCase().includes('same officer cannot')) {
    const entry = GLOSSARY['errors.sameOfficerCannotDoubleSign'];
    return {
      code: 'errors.sameOfficerCannotDoubleSign',
      message: entry ? entry.en : codeOrMessage,
      ...(lang === 'hi' && entry ? { messageHi: entry.hi } : {}),
    };
  }

  // 3. Fallback: preserve original message, assign general code if not coded
  const isKey = !codeOrMessage.includes(' ') && (codeOrMessage.includes('.') || codeOrMessage.startsWith('ERR_'));
  const resolvedCode = isKey ? codeOrMessage : 'errors.validation';
  return {
    code: resolvedCode,
    message: codeOrMessage,
    ...(lang === 'hi' ? { messageHi: GLOSSARY[resolvedCode]?.hi || codeOrMessage } : {}),
  };
}
