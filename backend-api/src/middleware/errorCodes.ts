/**
 * Canonical API Error Codes (Phase 8 — Hardening)
 *
 * Every error envelope now carries a machine-readable `code` field
 * in addition to the human-readable `message`. Clients can switch
 * on `error.code` without parsing message strings.
 *
 * Format: ERR_<DOMAIN>_<REASON>
 */

export const ErrorCode = {
  // ── Validation ─────────────────────────────────────────────────────────────
  ERR_VALIDATION: 'ERR_VALIDATION',

  // ── Authentication ──────────────────────────────────────────────────────────
  ERR_UNAUTHENTICATED: 'ERR_UNAUTHENTICATED',
  ERR_INVALID_TOKEN: 'ERR_INVALID_TOKEN',
  ERR_CREDENTIALS: 'ERR_CREDENTIALS',

  // ── Authorization ───────────────────────────────────────────────────────────
  ERR_FORBIDDEN: 'ERR_FORBIDDEN',

  // ── Resource ────────────────────────────────────────────────────────────────
  ERR_NOT_FOUND: 'ERR_NOT_FOUND',
  ERR_CONFLICT: 'ERR_CONFLICT',

  // ── Database ────────────────────────────────────────────────────────────────
  ERR_DB_CONSTRAINT: 'ERR_DB_CONSTRAINT',
  ERR_DB_RECORD_NOT_FOUND: 'ERR_DB_RECORD_NOT_FOUND',
  ERR_DB_VALIDATION: 'ERR_DB_VALIDATION',

  // ── Rate Limiting ───────────────────────────────────────────────────────────
  ERR_RATE_LIMITED: 'ERR_RATE_LIMITED',

  // ── Payload ─────────────────────────────────────────────────────────────────
  ERR_PAYLOAD_TOO_LARGE: 'ERR_PAYLOAD_TOO_LARGE',

  // ── Server ──────────────────────────────────────────────────────────────────
  ERR_INTERNAL: 'ERR_INTERNAL',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Shape of every error response envelope. */
export interface ApiError {
  message: string;
  code: ErrorCodeType;
}

/** Helper — builds a typed error response body. */
export function apiError(code: ErrorCodeType, message: string): { data: null; error: ApiError } {
  return { data: null, error: { code, message } };
}
