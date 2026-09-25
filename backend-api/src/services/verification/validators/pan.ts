/**
 * PAN (Permanent Account Number) Validator
 * Format: ^[A-Z]{5}[0-9]{4}[A-Z]$
 * 4th character: entity type (C = Company, P = Individual, F = Firm, etc.)
 */

export interface PanValidationResult {
  valid: boolean;
  error?: string;
  pan?: string;
  entityType?: string;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const ENTITY_TYPES: Record<string, string> = {
  C: 'Company',
  P: 'Individual / Person',
  H: 'Hindu Undivided Family (HUF)',
  F: 'Partnership Firm / LLP',
  A: 'Association of Persons (AOP)',
  T: 'Trust',
  B: 'Body of Individuals (BOI)',
  L: 'Local Authority',
  J: 'Artificial Juridical Person',
  G: 'Government Entity',
};

export function validatePan(panRaw: unknown): PanValidationResult {
  if (typeof panRaw !== 'string') {
    return { valid: false, error: 'PAN must be a string' };
  }

  const pan = panRaw.trim();

  // PAN must be submitted in uppercase — reject lowercase to prevent silent normalisation
  if (pan !== pan.toUpperCase()) {
    return { valid: false, error: `PAN must be in uppercase. Got: '${pan}'` };
  }

  if (pan.length !== 10) {
    return { valid: false, error: `PAN must be exactly 10 characters, got ${pan.length}` };
  }

  if (!PAN_REGEX.test(pan)) {
    return { valid: false, error: `PAN format invalid: '${pan}'. Expected 5 letters, 4 digits, 1 letter.` };
  }

  const entityChar = pan[3];
  const entityType = ENTITY_TYPES[entityChar] || 'Other';

  return {
    valid: true,
    pan,
    entityType,
  };
}
