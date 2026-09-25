import { prisma } from '../../db/client.js';
import { appendToLedger } from '../ledger.js';
import { computeVerificationStatus } from './validity.js';

export async function runVerificationExpiryNoticeScan(asOfDate: Date = new Date()): Promise<number> {
  const bidders = await prisma.bidder.findMany({
    select: {
      id: true,
      checks: true,
      companyName: true,
    },
  });

  let noticeCount = 0;

  for (const bidder of bidders) {
    const checks = Array.isArray(bidder.checks) ? (bidder.checks as any[]) : [];
    if (checks.length === 0) continue;

    const status = computeVerificationStatus(checks, asOfDate);

    if (status === 'stale') {
      // Check if a verification_expiry_notice was already emitted today for this bidder
      const startOfDay = new Date(asOfDate);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const existingNotice = await prisma.ledgerEntry.findFirst({
        where: {
          bidderId: bidder.id,
          action: 'verification_expiry_notice',
          createdAt: {
            gte: startOfDay,
          },
        },
      });

      if (!existingNotice) {
        await appendToLedger({
          bidderId: bidder.id,
          actorType: 'system',
          actorId: null,
          action: 'verification_expiry_notice',
          detail: {
            note: `Bidder verification validity has entered the stale window`,
            companyName: bidder.companyName,
            status: 'stale',
            scanTimestamp: asOfDate.toISOString(),
          },
        });
        noticeCount++;
      }
    }
  }

  return noticeCount;
}
