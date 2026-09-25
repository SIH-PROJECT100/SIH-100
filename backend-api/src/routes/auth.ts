import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { config } from '../config.js';
import { apiError, ErrorCode } from '../middleware/errorCodes.js';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        data: null,
        error: {
          code: ErrorCode.ERR_VALIDATION,
          message: parsed.error.issues.map(i => i.message).join(', '),
        },
      });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json(apiError(ErrorCode.ERR_CREDENTIALS, 'Invalid email or password'));
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res
        .status(401)
        .json(apiError(ErrorCode.ERR_CREDENTIALS, 'Invalid email or password'));
    }

    const nowSec = Math.floor(Date.now() / 1000);

    // origIat is the epoch-second of the original login; carried through refreshes
    // to enforce MAX_SESSION_LIFETIME_SEC.
    const token = jwt.sign(
      { id: user.id, role: user.role, origIat: nowSec },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /auth/refresh ───────────────────────────────────────────────────────
// Validates the current JWT, checks that the session has not exceeded
// MAX_SESSION_LIFETIME_SEC since the original login (origIat), then
// issues a new short-lived token preserving origIat.

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json(apiError(ErrorCode.ERR_UNAUTHENTICATED, 'Missing or invalid Authorization header'));
    }

    const token = authHeader.slice(7);

    let payload: any;
    try {
      payload = jwt.verify(token, config.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json(apiError(ErrorCode.ERR_INVALID_TOKEN, 'Invalid or expired token'));
    }

    // origIat: epoch-second when the session was first created (original login).
    // Falls back to payload.iat for tokens issued before Phase 8.
    const origIat: number = payload.origIat ?? payload.iat;
    const nowSec = Math.floor(Date.now() / 1000);
    const sessionAgeSec = nowSec - origIat;

    if (sessionAgeSec > config.MAX_SESSION_LIFETIME_SEC) {
      // Arithmetic: sessionAgeSec ({{sessionAgeSec}}) > MAX_SESSION_LIFETIME_SEC ({{max}})
      return res.status(401).json({
        data: null,
        error: {
          code: 'session.maxLifetimeExceeded',
          message: 'Session has exceeded maximum allowable lifetime. Please login again.',
        },
      });
    }

    // Look up user to ensure they still exist
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res
        .status(401)
        .json(apiError(ErrorCode.ERR_INVALID_TOKEN, 'Invalid or expired token'));
    }

    // Issue new token preserving origIat
    const newToken = jwt.sign(
      { id: user.id, role: user.role, origIat },
      config.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      data: { token: newToken },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
