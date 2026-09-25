/**
 * Udyam Registration Number Validator
 * Format: ^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$
 * e.g., UDYAM-HR-09-0156789
 */

export interface UdyamValidationResult {
  valid: boolean;
  error?: string;
  udyamNumber?: string;
  stateCode?: string;
  districtCode?: string;
  serialNumber?: string;
}

const UDYAM_REGEX = /^UDYAM-([A-Z]{2})-([0-9]{2})-([0-9]{7})$/;

export function validateUdyam(udyamRaw: unknown): UdyamValidationResult {
  if (typeof udyamRaw !== 'string') {
    return { valid: false, error: 'Udyam number must be a string' };
  }

  const udyam = udyamRaw.trim().toUpperCase();

  const match = udyam.match(UDYAM_REGEX);
  if (!match) {
    return {
      valid: false,
      error: `Udyam format invalid: '${udyam}'. Expected format: UDYAM-XX-00-0000000`,
    };
  }

  return {
    valid: true,
    udyamNumber: udyam,
    stateCode: match[1],
    districtCode: match[2],
    serialNumber: match[3],
  };
}
