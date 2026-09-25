/**
 * Named rate limiters (Phase 8 — Hardening)
 *
 * Limiters:
 *   authLimiter        — /auth routes: 20 req / 15min (brute-force protection, per IP)
 *   verifyLimiter      — POST /bidders/:id/verify: 5 req / 1min (expensive AI calls, per user)
 *   collusionLimiter   — POST /tenders/:id/detect-collusion: 3 req / 1min (heavy graph clustering, per user)
 *   vaultReportLimiter — GET /bidder/me/vault/:tenderId/report: 10 req / 1min (PDF + Merkle chain computation, per user)
 *   piiLimiter         — /bidder/me/profile: 30 req / 15min (PII reveal audit gate, per user)
 *   apiLimiter         — general authenticated routes: 200 req / 15min (DDoS blanket guard, per user)
 *
 * All limiters:
 *   - standardHeaders: true / legacyHeaders: false → RFC 6585 RateLimit-* headers
 *   - handler: sets Retry-After: <seconds> header with exact remaining window
 *   - skip: bypassed in test environment (NODE_ENV=test) UNLESS x-enable-rate-limit: true
 *           or ENABLE_RATE_LIMITS=true
 */

import rateLimit, { Options } from 'express-rate-limit';
import { Request, Response } from 'express';

// Test window overrides: when NODE_ENV=test or RATE_LIMIT_TEST_MODE=true, use short windows (3s/4s)
// to allow fast assertions in test suite without waiting 1m or 15m.
const isTestMode = process.env.NODE_ENV?.trim() === 'test' || process.env.RATE_LIMIT_TEST_MODE?.trim() === 'true';
const WINDOW_1MIN = isTestMode ? 3000 : 60 * 1000;
const WINDOW_15MIN = isTestMode ? 4000 : 15 * 60 * 1000;

/**
 * Builds a rate-limit handler that sets Retry-After: <seconds> on 429 responses.
 * resetTime is a Date exposed by express-rate-limit on req.rateLimit.
 */
function makeHandler(message: string, code: string = 'rateLimit.exceeded') {
  return (req: Request, res: Response) => {
    const resetTime: Date | undefined = (req as any).rateLimit?.resetTime;
    let retryAfterSec = 1;
    if (resetTime) {
      retryAfterSec = Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
    }
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({
      data: null,
      error: {
        code,
        message,
      },
    });
  };
}

function shouldSkip(req: Request): boolean {
  if (req.headers['x-enable-rate-limit'] === 'true') {
    return false;
  }
  if (process.env.ENABLE_RATE_LIMITS?.trim() === 'true') {
    return false;
  }
  return process.env.NODE_ENV?.trim() === 'test';
}

const keyByUser = (req: Request): string =>
  (req as any).user?.id ? `user_${(req as any).user.id}` : (req.ip || 'anonymous');

const keyByIp = (req: Request): string => req.ip || 'anonymous';

const commonOptions: Partial<Options> = {
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkip,
};

/** Brute-force guard on /auth endpoints: 20 req / 15 min (per IP). */
export const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_15MIN,
  max: 20,
  keyGenerator: keyByIp,
  handler: makeHandler(
    'Too many login attempts, please wait 15 minutes before trying again.',
    'rateLimit.login'
  ),
});

/** Expensive AI orchestration calls: 5 req / 1 min (per user). */
export const verifyLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_1MIN,
  max: 5,
  keyGenerator: keyByUser,
  handler: makeHandler(
    'Verification rate limit exceeded — max 5 per minute per user',
    'rateLimit.exceeded'
  ),
});

/** Cartel & collusion graph clustering: 3 req / 1 min (per user). */
export const collusionLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_1MIN,
  max: 3,
  keyGenerator: keyByUser,
  handler: makeHandler(
    'Collusion detection rate limit exceeded — max 3 per minute per user',
    'rateLimit.exceeded'
  ),
});

/** Pitch Vault verifiable PDF generation: 10 req / 1 min (per user). */
export const vaultReportLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_1MIN,
  max: 10,
  keyGenerator: keyByUser,
  handler: makeHandler(
    'Vault report generation rate limit exceeded — max 10 per minute per user',
    'rateLimit.exceeded'
  ),
});

/** PII reveal audit gate: 30 req / 15 min (per user). */
export const piiLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_15MIN,
  max: 30,
  keyGenerator: keyByUser,
  handler: makeHandler(
    'PII reveal rate limit exceeded — max 30 per 15 minutes',
    'rateLimit.exceeded'
  ),
});

/** General authenticated API rate limiter: 200 req / 15 min (per user). */
export const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: WINDOW_15MIN,
  max: 200,
  keyGenerator: keyByUser,
  handler: makeHandler(
    'Too many requests, please slow down',
    'rateLimit.exceeded'
  ),
});
