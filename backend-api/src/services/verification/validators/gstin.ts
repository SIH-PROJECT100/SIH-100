/**
 * GSTIN (Goods and Services Tax Identification Number) Validator
 * 15-character alphanumeric string:
 * - Chars 1-2: State code (01-38, 97, 99)
 * - Chars 3-12: 10-digit PAN of the entity
 * - Char 13: Entity code (1-9, A-Z)
 * - Char 14: Default character 'Z'
 * - Char 15: Checksum digit (calculated via Mod 36 Luhn-like algorithm)
 */

import { validatePan } from './pan.js';

export interface GstinValidationResult {
  valid: boolean;
  error?: string;
  gstin?: string;
  stateCode?: string;
  embeddedPan?: string;
  expectedCheckDigit?: string;
  actualCheckDigit?: string;
}

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export function calculateGstinCheckDigit(gstin14: string): string {
  if (gstin14.length < 14) {
    throw new Error('GSTIN prefix must be at least 14 characters');
  }

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const val = GSTIN_CHARSET.indexOf(gstin14[i].toUpperCase());
    if (val === -1) {
      throw new Error(`Invalid character in GSTIN prefix: ${gstin14[i]}`);
    }
    const factor = (i % 2 === 0) ? 1 : 2;
    const prod = val * factor;
    sum += Math.floor(prod / 36) + (prod % 36);
  }

  const remainder = sum % 36;
  const checkVal = (36 - remainder) % 36;
  return GSTIN_CHARSET[checkVal];
}

export function validateGstin(gstinRaw: unknown): GstinValidationResult {
  if (typeof gstinRaw !== 'string') {
    return { valid: false, error: 'GSTIN must be a string' };
  }

  const gstin = gstinRaw.trim().toUpperCase();

  if (gstin.length !== 15) {
    return { valid: false, error: `GSTIN must be exactly 15 characters, got ${gstin.length}` };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return { valid: false, error: `GSTIN format invalid: '${gstin}'` };
  }

  const stateCode = gstin.substring(0, 2);
  const stateNum = parseInt(stateCode, 10);
  if ((stateNum < 1 || stateNum > 38) && stateNum !== 97 && stateNum !== 99) {
    return { valid: false, error: `Invalid GSTIN state code: '${stateCode}'` };
  }

  const embeddedPan = gstin.substring(2, 12);
  const panCheck = validatePan(embeddedPan);
  if (!panCheck.valid) {
    return { valid: false, error: `Invalid embedded PAN in GSTIN: ${panCheck.error}` };
  }

  const actualCheckDigit = gstin[14];
  const expectedCheckDigit = calculateGstinCheckDigit(gstin.substring(0, 14));

  if (actualCheckDigit !== expectedCheckDigit) {
    return {
      valid: false,
      error: `GSTIN checksum mismatch: expected ${expectedCheckDigit}, got ${actualCheckDigit}`,
      gstin,
      stateCode,
      embeddedPan,
      expectedCheckDigit,
      actualCheckDigit,
    };
  }

  return {
    valid: true,
    gstin,
    stateCode,
    embeddedPan,
    expectedCheckDigit,
    actualCheckDigit,
  };
}
