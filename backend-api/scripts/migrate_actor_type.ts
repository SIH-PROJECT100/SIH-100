import { adminPrisma } from '../tests/helpers/adminDb.js';

async function main() {
  await adminPrisma.$executeRawUnsafe(`ALTER TYPE "ActorType" ADD VALUE IF NOT EXISTS 'bidder';`);
  console.log('MIGRATION: Added bidder to ActorType enum successfully');
  await adminPrisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
