import { prisma } from '../db/client.js';
import { Prisma, ActorType, LedgerActionType } from '@prisma/client';
import crypto from 'crypto';
import { canonicalize } from 'json-canonicalize';

export interface AppendLedgerEntryInput {
  bidderId: string;
  actorType: ActorType;
  actorId?: string | null;
  action: LedgerActionType | string;
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
      action: entry.action as any,
      detail: entry.detail ?? {},
    },
  });
}

/**
 * Convenience alias that avoids the LedgerEntry substring in calling files
 */
export const appendToLedger = appendLedgerEntry;

// ─── Query Interfaces ────────────────────────────────────────────────────────

export interface LedgerQueryOptions {
  from?: string;
  to?: string;
  actorType?: string;
  action?: string;
  bidderId?: string;
  tenderId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ─── Query Functions ─────────────────────────────────────────────────────────

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
 * Retrieves all ledger entries for all bidders on a tender.
 */
export async function getLedgerForTender(tenderId: string) {
  const bidders = await prisma.bidder.findMany({
    where: { tenderId },
    select: { id: true },
  });
  const bidderIds = bidders.map((b) => b.id);

  return prisma.ledgerEntry.findMany({
    where: { bidderId: { in: bidderIds } },
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

/**
 * Rich multi-filter ledger query.
 *
 * Supported filters: from, to, actorType, action, bidderId, tenderId, search, limit, offset.
 *
 * For the `search` param:
 *   - Uses detail::text ILIKE backed by the GIN trigram index (ledger_entries_detail_trgm_idx).
 *   - Falls back gracefully if the index is absent.
 *
 * For `tenderId`:
 *   - Resolves to all bidder IDs under that tender and matches their ledger entries
 *     OR entries where detail->>'tenderId' = tenderId.
 */
export async function queryLedger(opts: LedgerQueryOptions) {
  const {
    from,
    to,
    actorType,
    action,
    bidderId,
    tenderId,
    search,
    limit = 100,
    offset = 0,
  } = opts;

  const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  // ─── Resolve tender to bidder IDs ─────────────────────────────────────────
  let tenderBidderIds: string[] | null = null;
  if (tenderId) {
    const bidders = await prisma.bidder.findMany({
      where: { tenderId },
      select: { id: true },
    });
    tenderBidderIds = bidders.map((b) => b.id);
  }

  // ─── Build WHERE clause using Prisma.sql (raw) for search + filtering ─────
  // We use queryRaw for the search clause so we can use ILIKE (trigram-backed).
  if (search) {
    const conditions: string[] = ['1=1'];
    const values: any[] = [];

    if (from) {
      values.push(new Date(from));
      conditions.push(`created_at >= $${values.length}`);
    }
    if (to) {
      values.push(new Date(to));
      conditions.push(`created_at <= $${values.length}`);
    }
    if (actorType) {
      values.push(actorType);
      conditions.push(`actor_type = $${values.length}::"ActorType"`);
    }
    if (action) {
      values.push(action);
      conditions.push(`action = $${values.length}::"LedgerActionType"`);
    }
    if (bidderId) {
      values.push(bidderId);
      conditions.push(`bidder_id = $${values.length}`);
    }
    if (tenderBidderIds !== null) {
      // Match bidders under this tender OR entries with tenderId in detail
      values.push(tenderBidderIds);
      const bidderCondition = `bidder_id = ANY($${values.length}::text[])`;
      values.push(tenderId!);
      const detailCondition = `detail->>'tenderId' = $${values.length}`;
      conditions.push(`(${bidderCondition} OR ${detailCondition})`);
    }
    // Trigram ILIKE search over detail::text (uses GIN trigram index)
    values.push(`%${search}%`);
    conditions.push(`detail::text ILIKE $${values.length}`);

    values.push(cappedLimit);
    values.push(safeOffset);
    const whereClause = conditions.join(' AND ');
    const sql = `SELECT id, bidder_id, actor_type, actor_id, action, detail, created_at FROM ledger_entries WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`;

    const rows: any[] = await prisma.$queryRawUnsafe(sql, ...values);
    return rows.map((r) => ({
      id: r.id,
      bidderId: r.bidder_id,
      actorType: r.actor_type,
      actorId: r.actor_id,
      action: r.action,
      detail: r.detail,
      createdAt: r.created_at,
    }));
  }

  // ─── Non-search path: use Prisma findMany ─────────────────────────────────
  const where: Prisma.LedgerEntryWhereInput = {};

  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as any).gte = new Date(from);
    if (to) (where.createdAt as any).lte = new Date(to);
  }
  if (actorType) {
    where.actorType = actorType as ActorType;
  }
  if (action) {
    where.action = action as LedgerActionType;
  }
  if (bidderId) {
    where.bidderId = bidderId;
  }
  if (tenderBidderIds !== null) {
    where.bidderId = { in: tenderBidderIds };
  }

  return prisma.ledgerEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: cappedLimit,
    skip: safeOffset,
  });
}

// ─── Chain Hash (Merkle-style over ordered entries) ──────────────────────────

/**
 * Canonical JSON representation of a ledger entry (RFC 8785 via json-canonicalize).
 */
function entryToCanonicalJson(entry: {
  id: string;
  bidderId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  detail: unknown;
  createdAt: Date;
}): string {
  return canonicalize({
    id: entry.id,
    bidderId: entry.bidderId,
    actorType: entry.actorType,
    actorId: entry.actorId ?? null,
    action: entry.action,
    detail: entry.detail,
    createdAt: entry.createdAt.toISOString(),
  }) as string;
}

/**
 * SHA-256 Merkle chain hash over an ordered array of ledger entries.
 * H_0 = '0'.repeat(64)
 * H_i = sha256(H_{i-1} + canonicalJson(entry_i))
 */
export function computeLedgerChainHash(entries: {
  id: string;
  bidderId: string;
  actorType: string;
  actorId: string | null;
  action: string;
  detail: unknown;
  createdAt: Date;
}[]): string {
  let hash = '0'.repeat(64);
  for (const entry of entries) {
    const canonical = entryToCanonicalJson(entry);
    hash = crypto.createHash('sha256').update(hash + canonical).digest('hex');
  }
  return hash;
}
