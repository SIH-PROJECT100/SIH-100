import { describe, it, expect } from 'vitest';
import { crossCheckDocuments } from '../../src/services/verification/tiers/cross-check.js';
import { fuzzyMatchCompany } from '../../src/services/verification/validators/name.js';

describe('Tier 3: Cross-Document Consistency Testing (T2.4.d)', () => {
  it('(a) flags two docs with mismatched PANs with named evidence', () => {
    const docs = [
      {
        documentType: 'pan_card',
        sourceName: 'PAN_Card.pdf',
        companyName: 'Sharma Enterprises Pvt Ltd',
        pan: 'AAACS1234H',
      },
      {
        documentType: 'gst_cert',
        sourceName: 'GST_Registration.pdf',
        companyName: 'Sharma Enterprises Pvt Ltd',
        pan: 'BBBCS5678K',
      },
    ];

    const result = crossCheckDocuments(docs);

    expect(result.consistent).toBe(false);
    expect(result.mismatches.length).toBeGreaterThan(0);
    const panMismatch = result.mismatches.find((m) => m.field === 'pan');
    expect(panMismatch).toBeDefined();
    expect(panMismatch!.docA).toBe('PAN_Card.pdf');
    expect(panMismatch!.valA).toBe('AAACS1234H');
    expect(panMismatch!.docB).toBe('GST_Registration.pdf');
    expect(panMismatch!.valB).toBe('BBBCS5678K');
    expect(panMismatch!.detail).toContain('PAN mismatch between PAN_Card.pdf (\'AAACS1234H\') and GST_Registration.pdf (\'BBBCS5678K\')');
    expect(result.evidence).toContain('PAN mismatch between PAN_Card.pdf (\'AAACS1234H\') and GST_Registration.pdf (\'BBBCS5678K\')');
  });

  it('(b) passes cleanly when two docs have matching PANs', () => {
    const docs = [
      {
        documentType: 'pan_card',
        sourceName: 'PAN_Card.pdf',
        companyName: 'Sterling Goods Enterprises Pvt Ltd',
        pan: 'AAACS1234H',
      },
      {
        documentType: 'udyam_cert',
        sourceName: 'Udyam_Certificate.pdf',
        companyName: 'Sterling Goods Enterprises Pvt Ltd',
        pan: 'AAACS1234H',
      },
    ];

    const result = crossCheckDocuments(docs);

    expect(result.consistent).toBe(true);
    expect(result.mismatches.length).toBe(0);
    expect(result.evidence).toContain('Cross-document verification passed across 2 submitted documents.');
  });

  it('(c) passes two docs with fuzzy-matched company names at threshold 0.90', () => {
    // 1. Direct validation via fuzzyMatchCompany validator
    const fuzzyCheck = fuzzyMatchCompany(
      'Sharma Enterprises',
      'Sharma Enterprises Pvt. Ltd.',
      0.90
    );
    expect(fuzzyCheck.match).toBe(true);
    expect(fuzzyCheck.similarity).toBeGreaterThanOrEqual(0.90);

    // 2. Integration via crossCheckDocuments
    const docs = [
      {
        documentType: 'gst_cert',
        sourceName: 'GST_Certificate.pdf',
        companyName: 'Sharma Enterprises',
        pan: 'AAACS1234H',
      },
      {
        documentType: 'udyam_cert',
        sourceName: 'Udyam_Registration.pdf',
        companyName: 'Sharma Enterprises Pvt. Ltd.',
        pan: 'AAACS1234H',
      },
    ];

    const result = crossCheckDocuments(docs, { companyNameThreshold: 0.90 });

    expect(result.consistent).toBe(true);
    expect(result.mismatches.length).toBe(0);
    expect(result.evidence).toContain('Cross-document verification passed across 2 submitted documents.');
  });
});
