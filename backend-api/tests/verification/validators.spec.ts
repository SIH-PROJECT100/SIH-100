import { describe, it, expect } from 'vitest';
import { validatePan } from '../../src/services/verification/validators/pan.js';
import { validateGstin } from '../../src/services/verification/validators/gstin.js';
import { validateUdyam } from '../../src/services/verification/validators/udyam.js';
import {
  normaliseCompanyName,
  fuzzyMatchCompany,
} from '../../src/services/verification/validators/name.js';

describe('Deterministic Validators (PAN, GSTIN, Udyam, Name)', () => {
  // ─── 20 Test Vectors for PAN & GSTIN ────────────────────────────────────────

  describe('PAN Validation (10 test vectors)', () => {
    const validPans = [
      'AAACS1234H', // Company
      'AABCP7890F', // Firm
      'BNZPK5432M', // Individual
      'ABCDE1234F', // Firm
      'XYZPA9876Q', // Individual
    ];

    const invalidPans = [
      'AAAC1234H', // 9 chars (short)
      'AAACS12345H', // 11 chars (long)
      '12345ABCDE', // inverted format
      'AAACS12345', // ending in digit
      'aaacs1234h', // handled by uppercase normalisation, but non-string or invalid regex test:
      'AAAC$1234H', // special character
    ];

    validPans.forEach((pan) => {
      it(`accepts valid PAN: ${pan}`, () => {
        const res = validatePan(pan);
        expect(res.valid).toBe(true);
        expect(res.pan).toBe(pan);
      });
    });

    invalidPans.forEach((pan) => {
      it(`rejects invalid PAN: ${pan}`, () => {
        const res = validatePan(pan);
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
      });
    });
  });

  describe('GSTIN Validation (10 test vectors with Mod-36 checksum)', () => {
    const validGstins = [
      '27AAPFU0939F1ZV',
      '29AABCU9603R1ZJ',
      '07AAAAA0000A1Z4',
      '06AAACF5678K1ZA',
      '33AABCP7890F1ZB',
    ];

    const invalidGstins = [
      '27AAPFU0939F1Z0', // Checksum mismatch (expected V, got 0)
      '29AABCU9603R1Z9', // Checksum mismatch (expected J, got 9)
      '999AAPFU0939F1Z', // Wrong length (15 required)
      '99AAPFU0939F1ZV', // Invalid state code 99 (valid is 01-38, 97)
      '06AAACF5678K1ZA8', // Too long (16 chars)
    ];

    validGstins.forEach((gstin) => {
      it(`accepts valid GSTIN and verifies checksum: ${gstin}`, () => {
        const res = validateGstin(gstin);
        expect(res.valid).toBe(true);
        expect(res.gstin).toBe(gstin);
      });
    });

    invalidGstins.forEach((gstin) => {
      it(`rejects invalid GSTIN / checksum: ${gstin}`, () => {
        const res = validateGstin(gstin);
        expect(res.valid).toBe(false);
        expect(res.error).toBeDefined();
      });
    });
  });

  // ─── Udyam Validation ────────────────────────────────────────────────────────

  describe('Udyam Registration Validation', () => {
    it('accepts standard Udyam number format', () => {
      const res = validateUdyam('UDYAM-HR-09-0156789');
      expect(res.valid).toBe(true);
      expect(res.stateCode).toBe('HR');
      expect(res.districtCode).toBe('09');
      expect(res.serialNumber).toBe('0156789');
    });

    it('rejects malformed Udyam formats', () => {
      expect(validateUdyam('UDYAM-H-09-0156789').valid).toBe(false);
      expect(validateUdyam('MSME-HR-09-0156789').valid).toBe(false);
      expect(validateUdyam('UDYAM-HR-09-0156').valid).toBe(false);
    });
  });

  // ─── Name Normalisation & Fuzzy Matching ─────────────────────────────────────

  describe('Company Name Normalisation & Fuzzy Matcher', () => {
    it('strips legal suffixes (Pvt Ltd, Ltd, M/s, LLP)', () => {
      expect(normaliseCompanyName('M/s Acme Enterprises Pvt. Ltd.')).toBe('ACME');
      expect(normaliseCompanyName('Sterling Goods Enterprises Limited')).toBe('STERLING GOODS');
      expect(normaliseCompanyName('Apex Technologies LLP')).toBe('APEX TECHNOLOGIES');
    });

    it('fuzzy matches equivalent company names >= 0.90 similarity', () => {
      const match1 = fuzzyMatchCompany(
        'Sterling Goods Enterprises Private Limited',
        'Sterling Goods Enterprises Pvt Ltd'
      );
      expect(match1.match).toBe(true);
      expect(match1.similarity).toBeGreaterThanOrEqual(0.9);
    });

    it('rejects clearly distinct companies', () => {
      const match2 = fuzzyMatchCompany('Falcon Defense Services Ltd', 'Sterling Goods Enterprises');
      expect(match2.match).toBe(false);
      expect(match2.similarity).toBeLessThan(0.5);
    });
  });
});
