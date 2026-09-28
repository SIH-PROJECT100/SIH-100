/**
 * Test-only: superuser Prisma client used for teardown operations
 * that require DELETE on append-only tables (e.g. ledger_entries).
 * Uses DIRECT_URL (postgres superuser), never the restricted app role.
 */
import { PrismaClient, Prisma } from "@prisma/client";

export const adminPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
  log: [],
});

/**
 * Superuser helper to delete ledger entries during test teardown.
 * Sets session_replication_role = 'replica' to bypass append-only trigger.
 */
export async function deleteLedgerEntriesAdmin(where: Prisma.LedgerEntryWhereInput) {
  await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'replica';");
  try {
    return await adminPrisma.ledgerEntry.deleteMany({ where });
  } finally {
    await adminPrisma.$executeRawUnsafe("SET session_replication_role = 'origin';");
  }
}


export async function disconnectAdminPrisma() {
  await adminPrisma.$disconnect();
}
