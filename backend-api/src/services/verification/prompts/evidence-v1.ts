/**
 * Versioned Gemini Evidence Generation Prompt - V1
 */

export const EVIDENCE_PROMPT_VERSION = 'v1';

export const EVIDENCE_PROMPT_V1 = `You are writing a one-sentence evidence note for a government procurement officer. Facts only, no speculation. Reference only fields present in the extracted data below. Max 30 words.`;

export function formatEvidencePrompt(extractedData: unknown, validatorResults: unknown): string {
  return `${EVIDENCE_PROMPT_V1}

Extracted data: ${JSON.stringify(extractedData)}
Validator results: ${JSON.stringify(validatorResults)}`;
}
