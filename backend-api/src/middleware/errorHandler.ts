import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ErrorCode, apiError } from './errorCodes.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Payload too large (thrown by express.json body-parser)
  if ((err as any)?.type === 'entity.too.large') {
    res.status(413).json(apiError(ErrorCode.ERR_PAYLOAD_TOO_LARGE, 'Request body exceeds the 2 MB limit'));
    return;
  }

  // Prisma known request errors (constraint violations, not found, etc.)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json(apiError(ErrorCode.ERR_DB_CONSTRAINT, 'A record with that value already exists'));
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json(apiError(ErrorCode.ERR_DB_RECORD_NOT_FOUND, 'Record not found'));
      return;
    }
    res.status(400).json(apiError(ErrorCode.ERR_DB_VALIDATION, 'Database request error'));
    return;
  }

  // Prisma validation errors
  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json(apiError(ErrorCode.ERR_DB_VALIDATION, 'Invalid data provided'));
    return;
  }

  // Generic errors — never leak stack traces to client
  if (err instanceof Error) {
    console.error('[ErrorHandler]', err.message, err.stack);
    res.status(500).json(apiError(ErrorCode.ERR_INTERNAL, 'Internal server error'));
    return;
  }

  console.error('[ErrorHandler] Unknown error:', err);
  res.status(500).json(apiError(ErrorCode.ERR_INTERNAL, 'Internal server error'));
}

