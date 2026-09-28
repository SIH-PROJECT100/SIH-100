import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { prisma, connectDatabase } from './db/client.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { i18nMiddleware } from './middleware/i18nMiddleware.js';
import { authLimiter, verifyLimiter, collusionLimiter, vaultReportLimiter, piiLimiter, apiLimiter } from './middleware/rateLimits.js';
import { ErrorCode } from './middleware/errorCodes.js';
import authRouter from './routes/auth.js';
import tendersRouter from './routes/tenders.js';
import biddersRouter from './routes/bidders.js';
import ledgerRouter from './routes/ledger.js';
import decisionsRouter from './routes/decisions.js';
import adminRouter from './routes/admin.js';
import { paymentsRouter, adminPaymentsRouter } from './routes/payments.js';
import vaultRouter from './routes/vault.js';
import { awardsRouter, milestonesRouter } from './routes/delivery.js';
import i18nRouter from './routes/i18n.js';
import uploadsRouter from './routes/uploads.js';
import { docsRouter } from './docs/openapi.js';

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  config.CORS_ORIGIN,
  'http://localhost:4000',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:4000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Allow wildcard, matching origin, or any Vercel preview/production deployment
      if (
        config.CORS_ORIGIN === '*' ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.some((o) => o && origin.startsWith(o)) ||
        origin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      callback(null, false);
    },
    credentials: true,
  })
);

// ─── Payload limit (2 MB) — 413 handled by global errorHandler ───────────────
app.use(express.json({ limit: '2mb', strict: true }));

// ─── i18n error-localization middleware (wraps res.json) ─────────────────────
app.use(i18nMiddleware);

// ─── Public i18n glossary & OpenAPI Documentation (no auth required) ────────
app.use('/i18n', i18nRouter);
app.use('/', docsRouter);

// ─── Public routes (brute-force limited) ─────────────────────────────────────
app.use('/auth', authLimiter, authRouter);

// ─── Health check (public, real DB round-trip) ────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ data: { status: 'ok' }, error: null });
  } catch {
    return res.status(503).json({ data: null, error: { message: 'Database health check failed' } });
  }
});

// ─── Protected routes (all behind general API limiter) ───────────────────────
app.use('/tenders', apiLimiter, authenticate, tendersRouter);
app.use('/bidders', apiLimiter, authenticate, decisionsRouter);
app.use('/bidders', apiLimiter, authenticate, biddersRouter);
app.use('/admin/ledger', apiLimiter, authenticate, requireRole('admin'), ledgerRouter);
app.use('/ledger', apiLimiter, authenticate, requireRole('officer', 'admin'), ledgerRouter);
app.use('/payments', apiLimiter, authenticate, paymentsRouter);
app.use('/admin/payments', apiLimiter, authenticate, requireRole('admin'), adminPaymentsRouter);
app.use('/admin', apiLimiter, authenticate, adminRouter);

// ─── PII-limited vault route ─────────────────────────────────────────────────
app.use('/bidder/me', piiLimiter, authenticate, vaultRouter);

// ─── Delivery & Upload routes ────────────────────────────────────────────────
app.use('/awards', apiLimiter, authenticate, awardsRouter);
app.use('/milestones', apiLimiter, authenticate, milestonesRouter);
app.use('/uploads', apiLimiter, uploadsRouter);

// ─── 404 catch-all ───────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    data: null,
    error: { code: ErrorCode.ERR_NOT_FOUND, message: 'Not found' },
  });
});

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function startServer() {
  await connectDatabase();
  app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${config.PORT}`);
  });
}

startServer();

export { verifyLimiter, collusionLimiter, vaultReportLimiter, authLimiter };
export default app;
