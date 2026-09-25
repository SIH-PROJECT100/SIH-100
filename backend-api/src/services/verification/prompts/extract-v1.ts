/**
 * Versioned Gemini Structured Extraction Prompt - V1
 */

export const EXTRACT_PROMPT_VERSION = 'v1';

export const EXTRACT_PROMPT_V1 = `You are extracting structured data from an Indian government document. Return ONLY valid JSON matching the schema. Do not add commentary.

If a field is not present in the document, use null. If a field is present but you are not fully confident (illegible, ambiguous, or partial), still return your best reading AND list that field name in lowConfidenceFields.

Schema:
{
  "documentType": "gst_cert" | "pan_card" | "udyam_cert" | "itr" | "startup_india_cert" | "nsic_cert" | "other",
  "companyName": string | null,
  "pan": string | null,
  "gstin": string | null,
  "udyamNumber": string | null,
  "registrationDate": string | null,
  "issuingAuthority": string | null,
  "extractedFields": Record<string, string>,
  "lowConfidenceFields": string[]
}`;

export const EXTRACT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    documentType: {
      type: 'string',
      enum: ['gst_cert', 'pan_card', 'udyam_cert', 'itr', 'startup_india_cert', 'nsic_cert', 'other'],
    },
    companyName: { type: ['string', 'null'] },
    pan: { type: ['string', 'null'] },
    gstin: { type: ['string', 'null'] },
    udyamNumber: { type: ['string', 'null'] },
    registrationDate: { type: ['string', 'null'] },
    issuingAuthority: { type: ['string', 'null'] },
    extractedFields: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
    lowConfidenceFields: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['documentType', 'extractedFields', 'lowConfidenceFields'],
};
