import { describe, it, expect } from 'vitest';
import { computeTrustScore } from '../../src/services/profile/score.js';

describe('computeTrustScore', () => {
  // Fixture 1: All-zero metrics → base score 50
  it('returns 50 for a brand-new bidder with no activity', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(50);
  });

  // Fixture 2: 6 on-time deliveries → +30 cap, +12 completedBonus → 50+30+12=92
  it('caps on-time bonus at +30 (6 deliveries)', () => {
    // 6 on-time: +30 (capped). 6 completed: +12. No penalties.
    // 50 + 30 + 12 = 92
    expect(
      computeTrustScore({ onTimeDeliveries: 6, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(92);
  });

  // Fixture 3: 10 on-time → still cap +30, +20 completed cap → 50+30+20=100
  it('caps completed-delivery bonus at +20 (10 on-time)', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 10, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(100);
  });

  // Fixture 4: 1 late delivery → -8, +2 completed bonus → 50-8+2=44
  it('applies -8 per late delivery and +2 completed bonus', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 1, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(44);
  });

  // Fixture 5: 2 failed deliveries → -30 → 50-30=20
  it('applies -15 per failed delivery', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 0, failedDeliveries: 2, disqualifications: 0 })
    ).toBe(20);
  });

  // Fixture 6: 3 disqualifications → -30 → 50-30=20
  it('applies -10 per disqualification', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 3 })
    ).toBe(20);
  });

  // Fixture 7: extreme negatives clamp to 0
  it('clamps to 0 on extreme penalties', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 0, failedDeliveries: 10, disqualifications: 10 })
    ).toBe(0);
  });

  // Fixture 8: mixed — 3 on-time, 1 late, 1 failed, 1 disqualification
  // +15 on-time, -8 late, -15 failed, -10 disq, +8 completed (4 completions * 2 = 8)
  // 50 + 15 - 8 - 15 - 10 + 8 = 40
  it('handles mixed metrics correctly', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 3, lateDeliveries: 1, failedDeliveries: 1, disqualifications: 1 })
    ).toBe(40);
  });

  // Fixture 9: 1 on-time delivery → +5 on-time, +2 completed → 57
  it('applies +5 per on-time and +2 per completed', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 1, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(57);
  });

  // Fixture 10: Max achievable → 100 (clamped)
  it('never exceeds 100', () => {
    const score = computeTrustScore({ onTimeDeliveries: 100, lateDeliveries: 0, failedDeliveries: 0, disqualifications: 0 });
    expect(score).toBeLessThanOrEqual(100);
  });

  // Fixture 11: All dimensions at once near upper bound
  it('returns value in [0, 100] regardless of inputs', () => {
    const testCases = [
      { onTimeDeliveries: 0, lateDeliveries: 20, failedDeliveries: 5, disqualifications: 5 },
      { onTimeDeliveries: 50, lateDeliveries: 50, failedDeliveries: 50, disqualifications: 50 },
      { onTimeDeliveries: 1, lateDeliveries: 1, failedDeliveries: 0, disqualifications: 0 },
    ];
    for (const tc of testCases) {
      const score = computeTrustScore(tc);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  // Fixture 12: late+on-time both contribute to completed bonus
  // 2 on-time + 2 late → completed=4 → +8; +10 on-time; -16 late; no fail/disq
  // 50 + 10 - 16 + 8 = 52
  it('counts late deliveries in completed bonus', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 2, lateDeliveries: 2, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(52);
  });

  // Fixture 13: completed cap — 10 late deliveries → completed=10 → +20 cap; -80 late
  // 50 + 0 - 80 + 20 = -10 → clamps to 0
  it('clamps to 0 when late deliveries overwhelm score', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 10, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(0);
  });

  // Fixture 14: completed cap verification — exactly 10 completions
  // 5 on-time, 5 late → completed=10 → +20 (capped); +25 on-time; -40 late
  // 50 + 25 - 40 + 20 = 55
  it('caps completed bonus at +20 for 10 completed deliveries', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 5, lateDeliveries: 5, failedDeliveries: 0, disqualifications: 0 })
    ).toBe(55);
  });

  // Fixture 15: 1 disq + 1 failed → -10 - 15 = -25 → 25
  it('combines disqualification and failed delivery penalties correctly', () => {
    expect(
      computeTrustScore({ onTimeDeliveries: 0, lateDeliveries: 0, failedDeliveries: 1, disqualifications: 1 })
    ).toBe(25);
  });
});
