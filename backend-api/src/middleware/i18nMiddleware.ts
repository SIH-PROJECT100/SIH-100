import { Request, Response, NextFunction } from 'express';
import { GLOSSARY, resolveError } from '../i18n/glossary.js';

export const capturedErrorCodes = new Set<string>();

/**
 * i18n Error Middleware
 *
 * Intercepts express res.json() to normalize all error responses:
 * 1. Ensures machine-readable `error.code` is always present on 4xx/5xx envelopes.
 * 2. If `Accept-Language` header includes `hi`, attaches `error.messageHi` from the official Feature 8 glossary.
 * 3. Records all unique error codes for drift prevention auditing.
 */
export function i18nMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);
  const acceptLang = req.headers['accept-language']?.toLowerCase() || '';
  const isHindi = acceptLang.includes('hi');

  res.json = function (body: any): Response {
    if (body && typeof body === 'object' && body.error && typeof body.error === 'object') {
      const currentCode = body.error.code;
      const currentMessage = body.error.message || '';

      // Determine the best code
      let resolvedCode = currentCode;
      if (!resolvedCode) {
        // Fallback code based on HTTP status code or message match
        const match = resolveError(currentMessage, isHindi ? 'hi' : 'en');
        resolvedCode = match.code;
      }

      body.error.code = resolvedCode;

      if (resolvedCode) {
        capturedErrorCodes.add(resolvedCode);
      }

      // Attach messageHi if Hindi was requested
      if (isHindi) {
        const glossaryEntry = GLOSSARY[resolvedCode];
        if (glossaryEntry) {
          body.error.messageHi = glossaryEntry.hi;
        } else {
          // Check if message itself maps to a glossary entry
          const match = resolveError(currentMessage, 'hi');
          body.error.messageHi = match.messageHi || currentMessage;
        }
      }
    }

    return originalJson(body);
  };

  next();
}
