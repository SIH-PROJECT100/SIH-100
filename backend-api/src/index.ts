import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { prisma, connectDatabase } from './db/client.js';
import { authenticate, requireRole } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRouter from './routes/auth.js';
import tendersRouter from './routes/tenders.js';
import biddersRouter from './routes/bidders.js';
import ledgerRouter from './routes/ledger.js';
import decisionsRouter from './routes/decisions.js';
import adminRouter from './routes/admin.js';

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json());

// ─── Rate limiter on auth endpoints ────────────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { data: null, error: { message: 'Too many requests, please try again later' } },
});

// ─── Public routes ─────────────────────────────────────────────────────────────
app.use('/auth', authLimiter, authRouter);

// ─── Health check (public, but does a real DB round-trip) ─────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.status(200).json({ data: { status: 'ok' }, error: null });
  } catch {
    return res.status(503).json({ data: null, error: { message: 'Database health check failed' } });
  }
});

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/tenders', authenticate, tendersRouter);
app.use('/bidders', authenticate, decisionsRouter);
app.use('/bidders', authenticate, biddersRouter);
app.use('/admin/ledger', authenticate, requireRole('admin'), ledgerRouter);
app.use('/admin', authenticate, adminRouter);

// 404 handler for API routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({ data: null, error: { message: 'Not found' } });
});

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────
async function startServer() {
  await connectDatabase();
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });
}

startServer();

export default app;
