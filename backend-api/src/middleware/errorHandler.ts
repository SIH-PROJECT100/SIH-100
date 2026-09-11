import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Prisma known request errors (constraint violations, not found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ data: null, error: { message: 'A record with that value already exists' } });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ data: null, error: { message: 'Record not found' } });
      return;
    }
    res.status(400).json({ data: null, error: { message: 'Database request error' } });
    return;
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ data: null, error: { message: 'Invalid data provided' } });
    return;
  }

  // Generic errors — never leak stack traces to client
  if (err instanceof Error) {
    console.error('[ErrorHandler]', err.message, err.stack);
    res.status(500).json({ data: null, error: { message: 'Internal server error' } });
    return;
  }

  console.error('[ErrorHandler] Unknown error:', err);
  res.status(500).json({ data: null, error: { message: 'Internal server error' } });
}
