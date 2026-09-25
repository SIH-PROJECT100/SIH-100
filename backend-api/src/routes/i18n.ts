import { Router, Request, Response } from 'express';
import { getGlossaryStrings } from '../i18n/glossary.js';
import { capturedErrorCodes } from '../middleware/i18nMiddleware.js';

const router = Router();

/**
 * GET /i18n/strings?lang=en|hi
 * Returns the full glossary keyed by string ID.
 * Defaults to 'en' if not specified.
 */
router.get('/strings', (req: Request, res: Response) => {
  const langParam = (req.query.lang as string)?.toLowerCase();
  const lang: 'en' | 'hi' = langParam === 'hi' ? 'hi' : 'en';

  const strings = getGlossaryStrings(lang);

  res.status(200).json({
    data: strings,
    error: null,
  });
});

/**
 * GET /i18n/captured-error-codes
 * Returns all unique error codes intercepted by i18nMiddleware.
 * Used by drift prevention test suite to assert glossary coverage.
 */
router.get('/captured-error-codes', (_req: Request, res: Response) => {
  const codes = Array.from(capturedErrorCodes);
  res.status(200).json({
    data: codes,
    count: codes.length,
    error: null,
  });
});

export default router;
