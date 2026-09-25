/**
 * Bidder Trust Score — pure, side-effect-free scoring function.
 *
 * Base score: 50
 * Adjustments (applied in order, clamped to [0, 100] at the end):
 *   +5  per on-time delivery  (cap +30, i.e. up to 6 events)
 *   -8  per late delivery
 *   -15 per failed delivery
 *   -10 per disqualification
 *   +2  per completed delivery (on_time + late)  (cap +20, i.e. up to 10 events)
 */

export interface TrustScoreMetrics {
  onTimeDeliveries: number;
  lateDeliveries: number;
  failedDeliveries: number;
  disqualifications: number;
}

/**
 * Computes the trust score for a bidder based on delivery and compliance metrics.
 * Returns an integer in [0, 100].
 */
export function computeTrustScore(metrics: TrustScoreMetrics): number {
  const {
    onTimeDeliveries,
    lateDeliveries,
    failedDeliveries,
    disqualifications,
  } = metrics;

  let score = 50;

  // +5 per on-time delivery, capped at +30
  score += Math.min(onTimeDeliveries * 5, 30);

  // -8 per late delivery
  score -= lateDeliveries * 8;

  // -15 per failed delivery
  score -= failedDeliveries * 15;

  // -10 per disqualification
  score -= disqualifications * 10;

  // +2 per completed delivery (on_time + late), capped at +20
  const completedDeliveries = onTimeDeliveries + lateDeliveries;
  score += Math.min(completedDeliveries * 2, 20);

  // Clamp strictly to [0, 100]
  return Math.max(0, Math.min(100, Math.round(score)));
}
