import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthUser {
  id: string;
  role: 'officer' | 'admin' | 'bidder';
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ data: null, error: { message: 'Missing or invalid Authorization header' } });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as AuthUser;
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch {
    res.status(401).json({ data: null, error: { message: 'Invalid or expired token' } });
  }
}

export function requireRole(...roles: Array<'officer' | 'admin' | 'bidder'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ data: null, error: { message: 'Unauthenticated' } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ data: null, error: { message: 'Insufficient permissions' } });
      return;
    }
    next();
  };
}
