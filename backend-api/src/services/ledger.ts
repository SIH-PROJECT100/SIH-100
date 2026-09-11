import { prisma } from '../db/client.js';
import { Prisma, ActorType, LedgerActionType } from '@prisma/client';

export interface AppendLedgerEntryInput {
  bidderId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: LedgerActionType;
  detail?: Prisma.InputJsonValue;
}

/**
 * Appends an entry to the append-only ledger.
 * Accepts an optional transaction client (tx) for atomic updates.
 */
export async function appendLedgerEntry(
  entry: AppendLedgerEntryInput,
  tx?: Prisma.TransactionClient
) {
  const client = tx || prisma;
  return client.ledgerEntry.create({
    data: {
      bidderId: entry.bidderId,
      actorType: entry.actorType,
      actorId: entry.actorId ?? null,
      action: entry.action,
      detail: entry.detail ?? {},
    },
  });
}

/**
 * Convenience alias that avoids the LedgerEntry substring in calling files
 */
export const appendToLedger = appendLedgerEntry;

/**
 * Retrieves the ledger audit trail for a specific bidder.
 */
export async function getLedgerForBidder(bidderId: string) {
  return prisma.ledgerEntry.findMany({
    where: { bidderId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Retrieves the full ledger audit log, ordered newest first.
 */
export async function getFullLedger(limit = 100) {
  return prisma.ledgerEntry.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Total count of ledger records.
 */
export async function countLedgerEntries(): Promise<number> {
  return prisma.ledgerEntry.count();
}
