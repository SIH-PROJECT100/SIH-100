import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { RiskLevel, Prisma } from '@prisma/client';

const router = Router();

const IdParamSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Tender id cannot be empty')
    .regex(/^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|tender-[a-zA-Z0-9_-]+)$/, 'Invalid tender id format'),
});

// GET /tenders — list all tenders
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tenders = await prisma.tender.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { bidders: true },
        },
      },
    });
    res.status(200).json({ data: tenders, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /tenders/:id — get tender details
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
      });
      return;
    }
    const { id } = paramParsed.data;
    const tender = await prisma.tender.findUnique({
      where: { id },
      include: {
        _count: {
          select: { bidders: true },
        },
      },
    });

    if (!tender) {
      res.status(404).json({ data: null, error: { message: 'Tender not found' } });
      return;
    }

    res.status(200).json({ data: tender, error: null });
  } catch (err) {
    next(err);
  }
});

// GET /tenders/:id/bidders — list bidders for a tender with ?risk= and ?status= filters
router.get('/:id/bidders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paramParsed = IdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: paramParsed.error.issues[0]?.message ?? 'Invalid tender id' },
      });
      return;
    }
    const { id } = paramParsed.data;
    const { risk, status } = req.query;

    const tender = await prisma.tender.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!tender) {
      res.status(404).json({ data: null, error: { message: 'Tender not found' } });
      return;
    }

    const where: Prisma.BidderWhereInput = {
      tenderId: id,
    };

    if (risk && typeof risk === 'string') {
      const normalizedRisk = risk.toLowerCase();
      const validRisks: string[] = ['low', 'medium', 'high', 'critical'];
      if (validRisks.includes(normalizedRisk)) {
        where.overallRisk = normalizedRisk as RiskLevel;
      }
    }

    if (status && typeof status === 'string') {
      const normalizedStatus = status.toLowerCase();
      if (normalizedStatus === 'pending') {
        where.OR = [
          { officerDecision: { equals: Prisma.AnyNull } },
          { officerDecision: { path: ['status'], equals: 'pending' } },
        ];
      } else {
        where.officerDecision = {
          path: ['status'],
          equals: normalizedStatus,
        };
      }
    }

    const bidders = await prisma.bidder.findMany({
      where,
      orderBy: [{ riskScore: 'desc' }, { createdAt: 'asc' }],
    });

    res.status(200).json({ data: bidders, error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
