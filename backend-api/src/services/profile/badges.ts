/**
 * Badge evaluation logic — pure, side-effect-free.
 *
 * Badge keys:
 *   first_bid          totalBidsSubmitted >= 1
 *   five_bids          totalBidsSubmitted >= 5
 *   ten_bids           totalBidsSubmitted >= 10
 *   on_time_streak_3   onTimeDeliveries >= 3 && lateDeliveries === 0 && failedDeliveries === 0
 *   verified_veteran   totalBidsSubmitted >= 10 && trustScore >= 75  (V2 spec Feature 6)
 *   clean_slate        totalBidsSubmitted >= 1 && disqualifications === 0 && failedDeliveries === 0
 */

export type BadgeKey =
  | 'first_bid'
  | 'five_bids'
  | 'ten_bids'
  | 'on_time_streak_3'
  | 'verified_veteran'
  | 'clean_slate'
  | 'msme_verified'
  | 'zero_gst_defaults'
  | 'class_1_local_supplier'
  | 'clean_anti_cartel';

export const ALL_BADGE_KEYS: readonly BadgeKey[] = [
  'first_bid',
  'five_bids',
  'ten_bids',
  'on_time_streak_3',
  'verified_veteran',
  'clean_slate',
  'msme_verified',
  'zero_gst_defaults',
  'class_1_local_supplier',
  'clean_anti_cartel',
] as const;

export interface ProfileMetrics {
  totalBidsSubmitted: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  failedDeliveries: number;
  disqualifications: number;
  trustScore: number;
  isMsmeVerified?: boolean;
  hasZeroGstDefaults?: boolean;
  isClass1LocalSupplier?: boolean;
  hasCleanAntiCartel?: boolean;
}

export interface BadgeEvaluationResult {
  newBadges: BadgeKey[];
  allBadges: BadgeKey[];
}

/**
 * Determines which badges are newly earned and returns the full set.
 * Badges are monotonic: once earned they are never revoked.
 * existingBadges is the current persisted badge list.
 */
export function evaluateBadges(
  profile: ProfileMetrics,
  existingBadges: string[] = []
): BadgeEvaluationResult {
  // Only accept existing badges that belong to the defined BadgeKey enum
  const validExisting = existingBadges.filter((b): b is BadgeKey =>
    (ALL_BADGE_KEYS as readonly string[]).includes(b)
  );
  const existing = new Set<BadgeKey>(validExisting);

  const qualified = new Set<BadgeKey>();

  if (profile.totalBidsSubmitted >= 1) qualified.add('first_bid');
  if (profile.totalBidsSubmitted >= 5) qualified.add('five_bids');
  if (profile.totalBidsSubmitted >= 10) qualified.add('ten_bids');
  if (
    profile.onTimeDeliveries >= 3 &&
    profile.lateDeliveries === 0 &&
    profile.failedDeliveries === 0
  ) {
    qualified.add('on_time_streak_3');
  }
  // V2 spec Feature 6: verified_veteran threshold
  if (profile.totalBidsSubmitted >= 10 && profile.trustScore >= 75) {
    qualified.add('verified_veteran');
  }
  if (
    profile.totalBidsSubmitted >= 1 &&
    profile.disqualifications === 0 &&
    profile.failedDeliveries === 0
  ) {
    qualified.add('clean_slate');
  }

  // Domain badges (new)
  if (profile.isMsmeVerified) qualified.add('msme_verified');
  if (profile.hasZeroGstDefaults) qualified.add('zero_gst_defaults');
  if (profile.isClass1LocalSupplier) qualified.add('class_1_local_supplier');
  if (profile.hasCleanAntiCartel) qualified.add('clean_anti_cartel');

  const newBadges: BadgeKey[] = [];
  for (const badge of qualified) {
    if (!existing.has(badge)) {
      newBadges.push(badge);
    }
  }

  // Union: monotonic — preserves previously unlocked valid badges
  const allBadges: BadgeKey[] = Array.from(new Set([...validExisting, ...qualified]));

  return { newBadges, allBadges };
}
