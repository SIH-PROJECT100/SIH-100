import { describe, it, expect } from 'vitest';
import { verifyWithAiTier } from '../../src/services/verification/tiers/ai.js';

describe('Tier 3: AI Extraction & Document Structured Validation', () => {
  it('extracts structured attributes from native-text Indian government certificate', async () => {
    const docText = `
GOVERNMENT OF INDIA
MINISTRY OF MICRO, SMALL AND MEDIUM ENTERPRISES
UDYAM REGISTRATION CERTIFICATE
NAME OF ENTERPRISE: M/s Sterling Goods Enterprises Pvt Ltd
UDYAM NUMBER: UDYAM-HR-09-0156789
PAN: AAACS1234H
GSTIN: 06AAACS1234H1ZS
DATE OF REGISTRATION: 15-04-2022
    `;

    const result = await verifyWithAiTier({
      bidderId: 'bidder-008',
      documentText: docText,
      fileName: 'udyam_cert.txt',
      expectedPan: 'AAACS1234H',
      expectedGstin: '06AAACS1234H1ZS',
    });

    expect(result.status).toBe('verified');
    expect(result.trust_source).toBe('ai_extracted');
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.extractedData.pan).toBe('AAACS1234H');
    expect(result.promptVersions.extract).toBe('v1');
    expect(result.promptVersions.evidence).toBe('v1');
  });

  it('flags document with invalid PAN/GSTIN checksums during AI verification', async () => {
    const invalidDocText = `
NAME OF ENTERPRISE: Fraudulent Enterprises
PAN: INVALIDPAN99
GSTIN: 06AAACS1234H1Z9
    `;

    const result = await verifyWithAiTier({
      bidderId: 'bidder-invalid',
      documentText: invalidDocText,
      fileName: 'invalid_doc.txt',
    });

    expect(result.status).toBe('flagged');
    expect(result.validationSummary.issues.length).toBeGreaterThan(0);
    expect(result.evidence).toContain('AI verification flagged discrepancies');
  });

  it('throws clean ExtractionError on corrupted binary payload', async () => {
    await expect(
      verifyWithAiTier({
        bidderId: 'bidder-corrupt',
        documentText: 'CORRUPT_DOCUMENT_DATA_BINARY_TRASH',
        fileName: 'corrupt.bin',
      })
    ).rejects.toThrow('Document corrupted or unreadable');
  });
});
