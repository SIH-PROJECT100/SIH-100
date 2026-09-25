import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import {
  parsePortalHtml,
  verifyWithPortalTier,
} from '../../src/services/verification/tiers/portal.js';

describe('Tier 2: Portal QR & Verify-Page Verification', () => {
  const fixturesDir = path.resolve(process.cwd(), 'demo/portal-fixtures');

  it('correctly parses HTML structure and extracts enterprise fields', () => {
    const html = fs.readFileSync(path.join(fixturesDir, 'udyam-match.html'), 'utf-8');
    const parsed = parsePortalHtml(html);

    expect(parsed.udyamNumber).toBe('UDYAM-DL-01-0012345');
    expect(parsed.companyName).toBe('Acme Enterprises Solutions');
    expect(parsed.pan).toBe('AABCP7890F');
    expect(parsed.registrationDate).toBe('2021-08-14');
  });

  it('verifies matching public registry record with confidence >= 0.90', async () => {
    const fixturePath = path.join(fixturesDir, 'udyam-match.html');

    const result = await verifyWithPortalTier({
      bidderId: 'bidder-001',
      companyName: 'Acme Enterprises Solutions',
      udyamNumber: 'UDYAM-DL-01-0012345',
      pan: 'AABCP7890F',
      fixturePath,
    });

    expect(result.status).toBe('verified');
    expect(result.trust_source).toBe('portal_verified');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    expect(result.evidence).toContain('Matched against Udyam public registry');
  });

  it('flags portal discrepancy when company name does not match public registry', async () => {
    const fixturePath = path.join(fixturesDir, 'udyam-mismatch.html');

    const result = await verifyWithPortalTier({
      bidderId: 'bidder-002',
      companyName: 'Acme Enterprises Solutions',
      udyamNumber: 'UDYAM-DL-01-0012345',
      pan: 'AABCP7890F',
      fixturePath,
    });

    expect(result.status).toBe('flagged');
    expect(result.trust_source).toBe('portal_verified');
    expect(result.confidence).toBeLessThan(0.6);
    expect(result.evidence).toMatch(/mismatch/i);
    expect(result.evidence).toContain('Completely Different Corp LLP');
  });
});
