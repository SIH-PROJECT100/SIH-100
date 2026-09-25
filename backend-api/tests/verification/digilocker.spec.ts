import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { verifyWithDigiLockerTier } from '../../src/services/verification/tiers/digilocker.js';

describe('Tier 1: DigiLocker Cryptographic Verification', () => {
  const samplesDir = path.resolve(process.cwd(), 'demo/digilocker-samples');

  it('verifies valid XML document with cryptographic signature against CCA root', async () => {
    const validXmlPath = path.join(samplesDir, 'valid-cert.xml');
    const xmlContent = fs.readFileSync(validXmlPath, 'utf-8');

    const result = await verifyWithDigiLockerTier({
      bidderId: 'bidder-008',
      xmlContent,
      companyName: 'Sterling Goods Enterprises',
      pan: 'AAACS1234H',
    });

    expect(result.status).toBe('verified');
    expect(result.trust_source).toBe('digilocker');
    expect(result.confidence).toBe(1.0);
    expect(result.evidence).toContain('Cryptographic signature valid against CCA India root');
    expect(result.simulated).toBe(false);
  });

  it('flags tampered XML with a named cryptographic signature error', async () => {
    const tamperedXmlPath = path.join(samplesDir, 'tampered-cert.xml');
    const xmlContent = fs.readFileSync(tamperedXmlPath, 'utf-8');

    const result = await verifyWithDigiLockerTier({
      bidderId: 'bidder-tampered',
      xmlContent,
      companyName: 'Fraudulent Shell Corp Ltd',
    });

    expect(result.status).toBe('flagged');
    expect(result.trust_source).toBe('digilocker');
    expect(result.confidence).toBe(0.0);
    expect(result.signatureError).toBeDefined();
    expect(result.evidence).toMatch(/signature/i);
    expect(result.evidence).toContain('Signature verification failed');
  });

  it('flags expired certificate with named expiration error', async () => {
    const expiredXmlPath = path.join(samplesDir, 'expired-cert.xml');
    const xmlContent = fs.readFileSync(expiredXmlPath, 'utf-8');

    const result = await verifyWithDigiLockerTier({
      bidderId: 'bidder-expired',
      xmlContent,
      companyName: 'Expired Entity Ltd',
    });

    expect(result.status).toBe('flagged');
    expect(result.confidence).toBe(0.0);
    expect(result.signatureError).toMatch(/expired/i);
    expect(result.evidence).toContain('Certificate expired');
  });
});
