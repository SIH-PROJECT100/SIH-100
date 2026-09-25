import { describe, it, expect } from 'vitest';
import { computeCheckConfidence, type ConfidenceInput } from '../../src/services/verification/confidence.js';

describe('Confidence Scoring Pure Function (T2.4.e)', () => {
  it('Fixture 1: computes default baseline confidence without modifiers (0.70)', () => {
    const input: ConfidenceInput = {};
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.70);
  });

  it('Fixture 2: applies deterministic validator pass bonus (+0.30 -> 1.00)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      validatorPassed: true,
    };
    const score = computeCheckConfidence(input);
    expect(score).toBe(1.00);
  });

  it('Fixture 3: applies cross-doc consistency bonus (+0.20 -> 0.90)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      crossDocConsistent: true,
    };
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.90);
  });

  it('Fixture 4: penalises single low-confidence field (-0.15 -> 0.55)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      lowConfidenceCount: 1,
    };
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.55);
  });

  it('Fixture 5: penalises multiple low-confidence fields proportionally (-0.15 * 3 = -0.45 -> 0.25)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      lowConfidenceCount: 3,
    };
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.25);
  });

  it('Fixture 6: adjusts score upwards for high OCR confidence (ocrConfidence 1.0 -> +0.03)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      ocrConfidence: 1.0,
    };
    // (1.0 - 0.7) * 0.1 = 0.03 -> 0.73
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.73);
  });

  it('Fixture 7: adjusts score downwards for low OCR confidence (ocrConfidence 0.4 -> -0.03)', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      ocrConfidence: 0.4,
    };
    // (0.4 - 0.7) * 0.1 = -0.03 -> 0.67
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.67);
  });

  it('Fixture 8: strictly clamps upper bound to 1.0 when sum exceeds 1.0', () => {
    const input: ConfidenceInput = {
      base: 0.80,
      validatorPassed: true, // +0.30
      crossDocConsistent: true, // +0.20
      ocrConfidence: 1.0, // +0.03
    };
    // 0.80 + 0.30 + 0.20 + 0.03 = 1.33 -> clamped to 1.0
    const score = computeCheckConfidence(input);
    expect(score).toBe(1.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('Fixture 9: strictly clamps lower bound to 0.0 on extreme penalties', () => {
    const input: ConfidenceInput = {
      base: 0.40,
      lowConfidenceCount: 5, // -0.75
      validatorPassed: false,
      crossDocConsistent: false,
      ocrConfidence: 0.2, // -0.05
    };
    // 0.40 - 0.75 - 0.05 = -0.40 -> clamped to 0.0
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.0);
    expect(score).toBeGreaterThanOrEqual(0.0);
  });

  it('Fixture 10: exercises all dimensions simultaneously with balanced values', () => {
    const input: ConfidenceInput = {
      base: 0.70,
      lowConfidenceCount: 1, // -0.15
      ocrConfidence: 0.90, // (0.9-0.7)*0.1 = +0.02
      validatorPassed: true, // +0.30
      crossDocConsistent: false, // 0.0
    };
    // 0.70 - 0.15 + 0.02 + 0.30 = 0.87
    const score = computeCheckConfidence(input);
    expect(score).toBe(0.87);
    expect(score).toBeGreaterThanOrEqual(0.0);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('Fixture 11: asserts score is clamped to [0.0, 1.0] across extreme range variations', () => {
    const extremeCases: ConfidenceInput[] = [
      { base: 999 },
      { base: -999 },
      { base: 0.7, lowConfidenceCount: 100 },
      { base: 1.0, validatorPassed: true, crossDocConsistent: true, ocrConfidence: 10 },
      { base: -0.5, lowConfidenceCount: 10, ocrConfidence: -5 },
    ];

    for (const testCase of extremeCases) {
      const score = computeCheckConfidence(testCase);
      expect(score).toBeGreaterThanOrEqual(0.0);
      expect(score).toBeLessThanOrEqual(1.0);
    }
  });
});
