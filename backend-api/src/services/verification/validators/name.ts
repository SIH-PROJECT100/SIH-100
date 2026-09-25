/**
 * Name Normalisation & Fuzzy Matcher
 * Strips legal suffixes, normalises whitespace, removes punctuation.
 * Uses fastest-levenshtein for Levenshtein-based similarity.
 */

import { distance } from 'fastest-levenshtein';

const LEGAL_SUFFIXES = [
  /\bM\/S\.?\b/gi,
  /\bPVT\.?\s*LTD\.?\b/gi,
  /\bPRIVATE\s+LIMITED\b/gi,
  /\bLIMITED\b/gi,
  /\bLTD\.?\b/gi,
  /\bLLP\b/gi,
  /\bINC\.?\b/gi,
  /\bCORP\.?\b/gi,
  /\bENTERPRISES?\b/gi,
  /\bSOLUTIONS?\b/gi,
  /\bSERVICES?\b/gi,
  /\bINDUSTRIES\b/gi,
  /\bCO\.?\b/gi,
  /\bCOMPANY\b/gi,
];

export function normaliseCompanyName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let normalised = name.toUpperCase().trim();

  // Strip legal prefixes/suffixes
  for (const pattern of LEGAL_SUFFIXES) {
    normalised = normalised.replace(pattern, ' ');
  }

  // Remove punctuation (dots, commas, hyphens, slashes, brackets)
  normalised = normalised.replace(/[^A-Z0-9\s]/g, ' ');

  // Collapse consecutive whitespaces
  normalised = normalised.replace(/\s+/g, ' ').trim();

  return normalised;
}

export function normalisePersonName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let normalised = name.toUpperCase().trim();

  // Strip honorifics
  normalised = normalised.replace(/\b(MR|MRS|MS|DR|SHRI|SHRIMATI)\.?\b/gi, ' ');

  // Remove punctuation
  normalised = normalised.replace(/[^A-Z\s]/g, ' ');

  // Collapse whitespaces
  normalised = normalised.replace(/\s+/g, ' ').trim();

  return normalised;
}

export function computeSimilarity(a: string, b: string): number {
  if (!a && !b) return 1.0;
  if (!a || !b) return 0.0;
  if (a === b) return 1.0;

  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;

  const dist = distance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

export function fuzzyMatchCompany(submitted: string, extracted: string, threshold = 0.90): {
  match: boolean;
  similarity: number;
  normalisedSubmitted: string;
  normalisedExtracted: string;
} {
  const normSub = normaliseCompanyName(submitted);
  const normExt = normaliseCompanyName(extracted);

  const similarity = computeSimilarity(normSub, normExt);
  return {
    match: similarity >= threshold,
    similarity: Math.round(similarity * 1000) / 1000,
    normalisedSubmitted: normSub,
    normalisedExtracted: normExt,
  };
}

export function fuzzyMatchPerson(submitted: string, extracted: string, threshold = 0.85): {
  match: boolean;
  similarity: number;
  normalisedSubmitted: string;
  normalisedExtracted: string;
} {
  const normSub = normalisePersonName(submitted);
  const normExt = normalisePersonName(extracted);

  const similarity = computeSimilarity(normSub, normExt);
  return {
    match: similarity >= threshold,
    similarity: Math.round(similarity * 1000) / 1000,
    normalisedSubmitted: normSub,
    normalisedExtracted: normExt,
  };
}
