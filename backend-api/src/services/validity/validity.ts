/**
 * Verification Validity Window & Expiration Service (Feature 2)
 *
 * Configurable validity window per check category:
 * - msme: 5 years (1825 days, Udyam certificate)
 * - gst: 365 days
 * - pan_itr: 365 days
 * - blacklist: 90 days (fast-changing)
 * - make_in_india: 365 days
 * - default: 365 days
 *
 * Status definition:
 * - fresh: every check's verificationExpiresAt is in the future (> now)
 * - stale: one or more checks within [expiresAt, expiresAt + 30 days] (grace window)
 * - expired: one or more checks > 30 days past expiresAt
 */

export const DEFAULT_CATEGORY_VALIDITY_DAYS: Record<string, number> = {
  msme: 1825, // 5 years
  gst: 365,
  pan_itr: 365,
  blacklist: 90,
  make_in_india: 365,
  mca: 365,
  epfo: 365,
  default: 365,
};

export function getCategoryValidityDays(
  category?: string | null,
  customRules?: Record<string, number>
): number {
  if (!category) return customRules?.default ?? DEFAULT_CATEGORY_VALIDITY_DAYS.default;
  const key = category.toLowerCase();
  return (
    customRules?.[key] ??
    DEFAULT_CATEGORY_VALIDITY_DAYS[key] ??
    customRules?.default ??
    DEFAULT_CATEGORY_VALIDITY_DAYS.default
  );
}

export function computeExpiresAt(
  category: string | undefined | null,
  verifiedAt: Date = new Date(),
  customRules?: Record<string, number>
): string {
  const days = getCategoryValidityDays(category, customRules);
  const expires = new Date(verifiedAt.getTime() + days * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

export type VerificationStatus = 'fresh' | 'stale' | 'expired';

export function computeVerificationStatus(
  checks: any[] | null | undefined,
  now: Date = new Date()
): VerificationStatus {
  if (!checks || !Array.isArray(checks) || checks.length === 0) {
    return 'expired';
  }

  const nowMs = now.getTime();
  const GRACE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  let hasExpired = false;
  let hasStale = false;

  for (const check of checks) {
    if (!check.verificationExpiresAt) {
      // If no explicit expiration, treat as expired
      hasExpired = true;
      continue;
    }

    const expiresAtMs = new Date(check.verificationExpiresAt).getTime();
    if (isNaN(expiresAtMs)) {
      hasExpired = true;
      continue;
    }

    if (nowMs > expiresAtMs + GRACE_WINDOW_MS) {
      // Past expiresAt + 30 days grace window
      hasExpired = true;
    } else if (nowMs > expiresAtMs) {
      // Between expiresAt and expiresAt + 30 days
      hasStale = true;
    }
  }

  if (hasExpired) return 'expired';
  if (hasStale) return 'stale';
  return 'fresh';
}
