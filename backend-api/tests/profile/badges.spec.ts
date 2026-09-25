import { describe, it, expect } from 'vitest';
import { evaluateBadges } from '../../src/services/profile/badges.js';

const BASE = {
  totalBidsSubmitted: 0,
  onTimeDeliveries: 0,
  lateDeliveries: 0,
  failedDeliveries: 0,
  disqualifications: 0,
  trustScore: 50,
};

describe('evaluateBadges', () => {
  it('awards first_bid when totalBidsSubmitted >= 1', () => {
    const result = evaluateBadges({ ...BASE, totalBidsSubmitted: 1 }, []);
    expect(result.newBadges).toContain('first_bid');
    expect(result.allBadges).toContain('first_bid');
  });

  it('awards five_bids when totalBidsSubmitted >= 5', () => {
    const result = evaluateBadges({ ...BASE, totalBidsSubmitted: 5 }, []);
    expect(result.newBadges).toContain('first_bid');
    expect(result.newBadges).toContain('five_bids');
  });

  it('awards ten_bids when totalBidsSubmitted >= 10', () => {
    const result = evaluateBadges({ ...BASE, totalBidsSubmitted: 10 }, []);
    expect(result.newBadges).toContain('ten_bids');
  });

  it('awards on_time_streak_3 for 3+ on-time and 0 late/failed', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1, onTimeDeliveries: 3, lateDeliveries: 0, failedDeliveries: 0 },
      []
    );
    expect(result.newBadges).toContain('on_time_streak_3');
  });

  it('does NOT award on_time_streak_3 when lateDeliveries > 0', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1, onTimeDeliveries: 3, lateDeliveries: 1, failedDeliveries: 0 },
      []
    );
    expect(result.newBadges).not.toContain('on_time_streak_3');
  });

  it('awards verified_veteran at totalBidsSubmitted >= 10 AND trustScore >= 75', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 10, trustScore: 75 },
      []
    );
    expect(result.newBadges).toContain('verified_veteran');
  });

  it('does NOT award verified_veteran when trustScore < 75 even with 10+ bids', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 10, trustScore: 74 },
      []
    );
    expect(result.newBadges).not.toContain('verified_veteran');
  });

  it('does NOT award verified_veteran when bids < 10 even with high trustScore', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 9, trustScore: 90 },
      []
    );
    expect(result.newBadges).not.toContain('verified_veteran');
  });

  it('awards clean_slate for 1+ bids with 0 disqualifications and 0 failed deliveries', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1, disqualifications: 0, failedDeliveries: 0 },
      []
    );
    expect(result.newBadges).toContain('clean_slate');
  });

  it('does NOT award clean_slate when disqualifications > 0', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1, disqualifications: 1, failedDeliveries: 0 },
      []
    );
    expect(result.newBadges).not.toContain('clean_slate');
  });

  it('does NOT award clean_slate when failedDeliveries > 0', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1, disqualifications: 0, failedDeliveries: 1 },
      []
    );
    expect(result.newBadges).not.toContain('clean_slate');
  });

  it('is monotonic — does not remove existing badges even if no longer qualified', () => {
    // Simulate: previously earned first_bid, now has 0 bids submitted (impossible in reality, but tests the logic)
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 0 },
      ['first_bid', 'clean_slate']
    );
    expect(result.allBadges).toContain('first_bid');
    expect(result.allBadges).toContain('clean_slate');
    // newBadges should be empty (nothing newly earned)
    expect(result.newBadges).toHaveLength(0);
  });

  it('returns only newBadges that were not previously earned', () => {
    // Already has first_bid; now qualifies for five_bids too
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 5 },
      ['first_bid']
    );
    expect(result.newBadges).not.toContain('first_bid');
    expect(result.newBadges).toContain('five_bids');
    expect(result.allBadges).toContain('first_bid');
    expect(result.allBadges).toContain('five_bids');
  });

  it('awards all badges simultaneously for a perfect veteran bidder', () => {
    const result = evaluateBadges(
      {
        totalBidsSubmitted: 10,
        onTimeDeliveries: 3,
        lateDeliveries: 0,
        failedDeliveries: 0,
        disqualifications: 0,
        trustScore: 80,
      },
      []
    );
    expect(result.newBadges).toContain('first_bid');
    expect(result.newBadges).toContain('five_bids');
    expect(result.newBadges).toContain('ten_bids');
    expect(result.newBadges).toContain('on_time_streak_3');
    expect(result.newBadges).toContain('verified_veteran');
    expect(result.newBadges).toContain('clean_slate');
  });

  it('discards arbitrary/unrecognized badge strings from existingBadges', () => {
    const result = evaluateBadges(
      { ...BASE, totalBidsSubmitted: 1 },
      ['prompt_payer', 'zero_disqualification', 'first_bid'] as any
    );
    expect(result.allBadges).toContain('first_bid');
    expect(result.allBadges).not.toContain('prompt_payer');
    expect(result.allBadges).not.toContain('zero_disqualification');
    expect(result.newBadges).not.toContain('first_bid');
  });
});

