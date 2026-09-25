import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { appendToLedger } from '../services/ledger.js';
import { requireRole } from '../middleware/auth.js';

export const paymentsRouter = Router();
export const adminPaymentsRouter = Router();

const MockConfirmSchema = z.object({
  paymentId: z.string().trim().min(1, 'paymentId is required'),
});

const RefundActionSchema = z.object({
  action: z.enum(['refund', 'forfeit']),
  reason: z.string().optional(),
});

// POST /payments/mock-confirm — Confirms mock application fee payment
paymentsRouter.post(
  '/mock-confirm',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = MockConfirmSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: { message: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        });
        return;
      }

      const { paymentId } = parsed.data;

      const payment = await prisma.applicationFeePayment.findUnique({
        where: { id: paymentId },
        include: { tender: true, bidder: true },
      });

      if (!payment) {
        res.status(404).json({
          data: null,
          error: { message: 'Application fee payment record not found' },
        });
        return;
      }

      if (payment.status === 'paid') {
        res.status(200).json({
          data: { payment, message: 'Payment already confirmed' },
          error: null,
        });
        return;
      }

      const now = new Date();
      const updatedPayment = await prisma.$transaction(async (tx) => {
        const updated = await tx.applicationFeePayment.update({
          where: { id: paymentId },
          data: {
            status: 'paid',
            paidAt: now,
          },
        });

        // Derive actorType from JWT role: admin | officer | bidder | system
        const feeActorType = (req.user?.role as string | undefined) === 'admin'
          ? 'admin'
          : (req.user?.role as string | undefined) === 'officer'
            ? 'officer'
            : (req.user?.role as string | undefined) === 'bidder'
              ? 'bidder'
              : 'system';
        const feeActorId = req.user?.id ?? null;

        // 1. Fee Paid event
        await appendToLedger(
          {
            bidderId: payment.bidderId,
            actorType: feeActorType as any,
            actorId: feeActorId,
            action: 'fee_paid',
            detail: {
              paymentId,
              tenderId: payment.tenderId,
              amount: Number(payment.amount),
              gatewayRef: payment.gatewayRef,
              paidAt: now.toISOString(),
            },
          },
          tx
        );

        // 2. Fee Transition event
        await appendToLedger(
          {
            bidderId: payment.bidderId,
            actorType: feeActorType as any,
            actorId: feeActorId,
            action: 'fee_transition',
            detail: {
              paymentId,
              tenderId: payment.tenderId,
              from: 'pending',
              to: 'paid',
              amount: Number(payment.amount),
              timestamp: now.toISOString(),
            },
          },
          tx
        );

        return updated;
      });

      res.status(200).json({
        data: { payment: updatedPayment, message: 'Payment confirmed successfully' },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /payments/:id — View payment status
paymentsRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const payment = await prisma.applicationFeePayment.findUnique({
        where: { id },
      });

      if (!payment) {
        res.status(404).json({ data: null, error: { message: 'Payment not found' } });
        return;
      }

      res.status(200).json({ data: payment, error: null });
    } catch (err) {
      next(err);
    }
  }
);

// POST /admin/payments/:id/refund — Admin refunds or forfeits application fee
adminPaymentsRouter.post(
  '/:id/refund',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const parsed = RefundActionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          data: null,
          error: { message: parsed.error.issues[0]?.message ?? 'Invalid payload' },
        });
        return;
      }

      const { action, reason } = parsed.data;

      const payment = await prisma.applicationFeePayment.findUnique({
        where: { id },
      });

      if (!payment) {
        res.status(404).json({ data: null, error: { message: 'Payment not found' } });
        return;
      }

      if (payment.status !== 'paid') {
        res.status(400).json({
          data: null,
          error: { message: `Cannot refund payment in '${payment.status}' status. Must be 'paid'.` },
        });
        return;
      }

      const nextStatus = action === 'forfeit' ? 'forfeited' : 'refunded';
      const now = new Date();

      const updatedPayment = await prisma.$transaction(async (tx) => {
        const updated = await tx.applicationFeePayment.update({
          where: { id },
          data: {
            status: nextStatus,
            refundedAt: now,
          },
        });

        await appendToLedger(
          {
            bidderId: payment.bidderId,
            actorType: 'admin',
            actorId: req.user!.id,
            action: 'fee_transition',
            detail: {
              paymentId: payment.id,
              tenderId: payment.tenderId,
              from: 'paid',
              to: nextStatus,
              amount: Number(payment.amount),
              reason: reason ?? null,
              timestamp: now.toISOString(),
            },
          },
          tx
        );

        return updated;
      });

      res.status(200).json({
        data: { payment: updatedPayment, message: `Payment ${nextStatus} successfully` },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /admin/payments — Admin list of all payments
adminPaymentsRouter.get(
  '/',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payments = await prisma.applicationFeePayment.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          tender: { select: { id: true, title: true, gemTenderId: true } },
          bidder: { select: { id: true, companyName: true, pan: true } },
        },
      });

      res.status(200).json({ data: payments, error: null });
    } catch (err) {
      next(err);
    }
  }
);
