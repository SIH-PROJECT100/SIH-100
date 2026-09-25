/**
 * Phase 8: i18n Error Glossary Drift Prevention Tests
 * (tests/i18n-errors.spec.ts)
 *
 * Purpose: These tests act as a compile-time + runtime contract ensuring that
 * every machine-readable error code used anywhere in the codebase has a
 * corresponding entry in the official Feature 8 glossary (glossary.ts).
 *
 * Tests:
 *   1.  Every ErrorCode constant has an entry in GLOSSARY (EN + HI)
 *   2.  All 14 mandatory microcopy keys exist with exact verbatim EN strings
 *   3.  GET /i18n/strings?lang=en returns full glossary (data != null, error == null)
 *   4.  GET /i18n/strings?lang=hi returns full glossary with Hindi strings
 *   5.  GET /i18n/strings (no lang) defaults to English
 *   6.  English mandatory microcopy strings are verbatim (no drift)
 *   7.  Hindi mandatory microcopy strings are verbatim (no drift)
 *   8.  Non-error UI microcopy keys present: trust.disclaimer, award.warning.appendedToLedger,
 *       secondary.awaitingPrimary, banner.staleVerification, cta.reverifyNow,
 *       cta.inspectAndDecide, cta.openTriage
 *   9.  system.maxLifetimeExceeded key has both en + hi translations
 *  10.  resolveError() maps ERR_RATE_LIMITED code to glossary entry
 *  11.  resolveError() maps unknown message to fallback code 'errors.validation'
 *  12.  resolveError() with Accept-Language hi attaches messageHi
 *  13.  i18n middleware attaches messageHi on 401 when Accept-Language: hi
 *  14.  i18n middleware does NOT attach messageHi when Accept-Language: en
 */

import { describe, it, expect } from 'vitest';
import { GLOSSARY, MANDATORY_MICROCOPY, SYSTEM_ERROR_KEYS, resolveError } from '../src/i18n/glossary.js';
import { ErrorCode } from '../src/middleware/errorCodes.js';
import { config } from '../src/config.js';
import jwt from 'jsonwebtoken';

const BASE_URL = `http://localhost:${config.PORT}`;

// ─── Verbatim mandatory strings from ANTIGRAVITY_PROMPT_GEM_COMPLIANCE_V2.md Feature 8 ─────────

const EXPECTED_MANDATORY: Record<string, { en: string; hi: string }> = {
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
};

// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 8: i18n Glossary Drift Prevention', () => {
  // Test 1: Every ErrorCode constant is in the GLOSSARY
  it('1. Every ErrorCode constant has a GLOSSARY entry with en + hi', () => {
    for (const [name, code] of Object.entries(ErrorCode)) {
      const entry = GLOSSARY[code];
      expect(entry, `ErrorCode.${name} ("${code}") missing from GLOSSARY`).toBeDefined();
      expect(typeof entry.en, `ErrorCode.${name} missing 'en' string`).toBe('string');
      expect(entry.en.length, `ErrorCode.${name} 'en' is empty`).toBeGreaterThan(0);
      expect(typeof entry.hi, `ErrorCode.${name} missing 'hi' string`).toBe('string');
      expect(entry.hi.length, `ErrorCode.${name} 'hi' is empty`).toBeGreaterThan(0);
    }
  });

  // Test 2: All 14 mandatory microcopy keys exist in MANDATORY_MICROCOPY
  it('2. All 14 mandatory microcopy keys exist in MANDATORY_MICROCOPY', () => {
    const keys = Object.keys(EXPECTED_MANDATORY);
    // Spec mandates exactly 14
    expect(keys.length).toBe(14);
    for (const key of keys) {
      expect(MANDATORY_MICROCOPY, `Key "${key}" missing from MANDATORY_MICROCOPY`).toHaveProperty(key);
    }
  });

  // Test 3: GET /i18n/strings?lang=en returns full glossary
  it('3. GET /i18n/strings?lang=en → { data: {...}, error: null }', async () => {
    const res = await fetch(`${BASE_URL}/i18n/strings?lang=en`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.error).toBeNull();
    expect(body.data).toBeTruthy();
    // Should have at least as many keys as GLOSSARY
    const glossaryKeyCount = Object.keys(GLOSSARY).length;
    expect(Object.keys(body.data).length).toBeGreaterThanOrEqual(glossaryKeyCount);
  });

  // Test 4: GET /i18n/strings?lang=hi returns Hindi strings
  it('4. GET /i18n/strings?lang=hi → data values are Hindi strings', async () => {
    const res = await fetch(`${BASE_URL}/i18n/strings?lang=hi`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.error).toBeNull();
    // Sample check: trust.disclaimer should match verbatim Hindi
    expect(body.data['trust.disclaimer']).toBe(
      'विश्वास स्कोर एक ऐतिहासिक साक्ष्य है। यह इस विशेष बोली के सत्यापन का विकल्प नहीं है।'
    );
  });

  // Test 5: GET /i18n/strings (no lang param) defaults to English
  it('5. GET /i18n/strings (no lang) defaults to English', async () => {
    const res = await fetch(`${BASE_URL}/i18n/strings`);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data['trust.disclaimer']).toBe(
      'Trust score is historical evidence. It does not replace verification of this specific bid.'
    );
  });

  // Test 6: English mandatory strings are verbatim — no drift
  it('6. English mandatory microcopy strings are verbatim (no drift)', () => {
    for (const [key, expected] of Object.entries(EXPECTED_MANDATORY)) {
      const actual = (MANDATORY_MICROCOPY as any)[key];
      expect(actual, `Key "${key}" missing`).toBeDefined();
      expect(actual.en, `[DRIFT] "${key}" EN string has drifted`).toBe(expected.en);
    }
  });

  // Test 7: Hindi mandatory strings are verbatim — no drift
  it('7. Hindi mandatory microcopy strings are verbatim (no drift)', () => {
    for (const [key, expected] of Object.entries(EXPECTED_MANDATORY)) {
      const actual = (MANDATORY_MICROCOPY as any)[key];
      expect(actual, `Key "${key}" missing`).toBeDefined();
      expect(actual.hi, `[DRIFT] "${key}" HI string has drifted`).toBe(expected.hi);
    }
  });

  // Test 8: Non-error mandatory UI keys are present in GLOSSARY
  it('8. Non-error UI microcopy keys present in GLOSSARY', () => {
    const uiKeys = [
      'trust.disclaimer',
      'award.warning.appendedToLedger',
      'secondary.awaitingPrimary',
      'banner.staleVerification',
      'cta.reverifyNow',
      'cta.inspectAndDecide',
      'cta.openTriage',
    ];
    for (const key of uiKeys) {
      expect(GLOSSARY, `UI key "${key}" missing from GLOSSARY`).toHaveProperty(key);
    }
  });

  // Test 9: session.maxLifetimeExceeded has both translations
  it('9. session.maxLifetimeExceeded has en + hi translations in SYSTEM_ERROR_KEYS', () => {
    const entry = (SYSTEM_ERROR_KEYS as any)['session.maxLifetimeExceeded'];
    expect(entry).toBeDefined();
    expect(entry.en).toBe(
      'Session has exceeded maximum allowable lifetime. Please login again.'
    );
    expect(entry.hi.length).toBeGreaterThan(0);
  });

  // Test 10: resolveError maps ERR_RATE_LIMITED to glossary entry
  it('10. resolveError("ERR_RATE_LIMITED") returns code + en message', () => {
    const result = resolveError('ERR_RATE_LIMITED', 'en');
    expect(result.code).toBe('ERR_RATE_LIMITED');
    expect(result.message.length).toBeGreaterThan(0);
  });

  // Test 11: resolveError on unknown message falls back to errors.validation
  it('11. resolveError("totally unknown message") falls back to errors.validation', () => {
    const result = resolveError('totally unknown message', 'en');
    expect(result.code).toBe('errors.validation');
  });

  // Test 12: resolveError with hi attaches messageHi
  it('12. resolveError("ERR_RATE_LIMITED", "hi") attaches messageHi', () => {
    const result = resolveError('ERR_RATE_LIMITED', 'hi');
    expect(result.messageHi).toBeDefined();
    expect(typeof result.messageHi).toBe('string');
    expect((result.messageHi as string).length).toBeGreaterThan(0);
  });

  // Test 13: i18n middleware attaches messageHi on 401 when Accept-Language: hi
  it('13. i18n middleware: 401 with Accept-Language: hi → error.messageHi present', async () => {
    // Hit a protected route without auth
    const res = await fetch(`${BASE_URL}/tenders`, {
      headers: { 'Accept-Language': 'hi' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBeDefined();
    expect(body.error.messageHi).toBeDefined();
    expect(typeof body.error.messageHi).toBe('string');
    expect(body.error.messageHi.length).toBeGreaterThan(0);
  });

  // Test 14: i18n middleware does NOT attach messageHi for Accept-Language: en
  it('14. i18n middleware: 401 with Accept-Language: en → no error.messageHi', async () => {
    const res = await fetch(`${BASE_URL}/tenders`, {
      headers: { 'Accept-Language': 'en' },
    });
    expect(res.status).toBe(401);
    const body = await res.json() as any;
    expect(body.error.code).toBeDefined();
    expect(body.error.messageHi).toBeUndefined();
  });

  // Test 15: Drift-prevention coverage across all captured error codes
  it('15. Drift-prevention: all error codes returned in API responses exist in GLOSSARY', async () => {
    // 1. Assert all canonical ErrorCode enum constants exist in GLOSSARY
    for (const code of Object.values(ErrorCode)) {
      expect(GLOSSARY[code], `ErrorCode constant "${code}" missing from GLOSSARY`).toBeDefined();
    }

    // 2. Assert all captured error codes intercepted by live middleware exist in GLOSSARY
    const res = await fetch(`${BASE_URL}/i18n/captured-error-codes`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const captured: string[] = body.data || [];
    for (const code of captured) {
      expect(GLOSSARY[code], `Live captured error.code "${code}" is not in GLOSSARY`).toBeDefined();
    }
  });
});

