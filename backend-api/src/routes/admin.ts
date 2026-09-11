import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Zod schema for RulesConfig validation
export const RulesConfigPayloadSchema = z
  .object({
    msme: z
      .object({
        weight: z.number().optional(),
        requiredForTender: z.boolean().optional(),
      })
      .optional(),
    gst: z
      .object({
        weight: z.number().optional(),
        flaggedPenalty: z.number().optional(),
      })
      .optional(),
    pan_itr: z
      .object({
        weight: z.number().optional(),
        mismatchPenalty: z.number().optional(),
      })
      .optional(),
    blacklist: z
      .object({
        weight: z.number().optional(),
        flaggedPenalty: z.number().optional(),
      })
      .optional(),
    make_in_india: z
      .object({
        weight: z.number().optional(),
        requiredForTender: z.boolean().optional(),
      })
      .optional(),
    local_content: z
      .object({
        minPercentage: z.number().optional(),
        weight: z.number().optional(),
      })
      .optional(),
    riskThresholds: z
      .object({
        low: z.number(),
        medium: z.number(),
        high: z.number(),
      })
      .optional(),
  })
  .passthrough();

const PutRulesBodySchema = z.union([
  z.object({ config: RulesConfigPayloadSchema }).transform((d) => d.config),
  RulesConfigPayloadSchema,
]);

// All routes in this router require admin role
router.use(requireRole('admin'));

// GET /admin/rules — retrieves active rules configuration
router.get('/rules', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await prisma.rulesConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!row) {
      res.status(404).json({ data: null, error: { message: 'RulesConfig not found' } });
      return;
    }

    res.status(200).json({
      data: {
        id: row.id,
        config: row.config,
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

// PUT /admin/rules — updates rules configuration
router.put('/rules', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = PutRulesBodySchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        data: null,
        error: {
          message: 'Invalid rules configuration payload',
          issues: parsed.error.issues,
        },
      });
      return;
    }

    const newConfig = parsed.data;
    const existing = await prisma.rulesConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    let updatedRow;
    if (existing) {
      updatedRow = await prisma.rulesConfig.update({
        where: { id: existing.id },
        data: {
          config: newConfig as any,
          updatedBy: req.user?.id || 'admin',
        },
      });
    } else {
      updatedRow = await prisma.rulesConfig.create({
        data: {
          config: newConfig as any,
          updatedBy: req.user?.id || 'admin',
        },
      });
    }

    res.status(200).json({
      data: {
        id: updatedRow.id,
        config: updatedRow.config,
        updatedAt: updatedRow.updatedAt,
        updatedBy: updatedRow.updatedBy,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
