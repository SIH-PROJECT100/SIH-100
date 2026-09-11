import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { appendToLedger, getLedgerForBidder, countLedgerEntries } from '../services/ledger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const prisma = new PrismaClient();

interface BidderSeedData {
  id: string;
  tenderId: string;
  companyName: string;
  udyamNumber: string | null;
  gstin: string;
  pan: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  checks: unknown[];
}

async function seed() {
  console.log('🌱 Seeding database...');

  // ─── 1. Users (3 demo roles) ─────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234!', 12);

  const users = [
    {
      id: 'user-officer-001',
      email: 'officer@demo.com',
      passwordHash,
      role: 'officer' as const,
      name: 'Priya Sharma',
    },
    {
      id: 'user-admin-001',
      email: 'admin@demo.com',
      passwordHash,
      role: 'admin' as const,
      name: 'Rajesh Kumar',
    },
    {
      id: 'user-bidder-001',
      email: 'bidder@demo.com',
      passwordHash,
      role: 'bidder' as const,
      name: 'Ananya Verma',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash: user.passwordHash, role: user.role, name: user.name },
      create: user,
    });
  }
  console.log(`✅ Seeded ${users.length} users`);

  // ─── 2. Tenders ──────────────────────────────────────────────────────────
  const tenders = [
    {
      id: 'tender-001',
      title: 'Procurement of IT Hardware and Peripherals 2026',
      gemTenderId: 'GEM/2026/B/3245678',
      status: 'evaluation' as const,
    },
    {
      id: 'tender-002',
      title: 'Supply of Office Stationery and Consumables 2026',
      gemTenderId: 'GEM/2026/B/3345679',
      status: 'evaluation' as const,
    },
  ];

  for (const tender of tenders) {
    await prisma.tender.upsert({
      where: { gemTenderId: tender.gemTenderId },
      update: { title: tender.title, status: tender.status },
      create: tender,
    });
  }
  console.log(`✅ Seeded ${tenders.length} tenders`);

  // ─── 3. Bidders ───────────────────────────────────────────────────────────
  const seedDataPath = join(__dirname, '../../../seed-data/bidders.json');
  const biddersData: BidderSeedData[] = JSON.parse(readFileSync(seedDataPath, 'utf-8'));

  let biddersSeeded = 0;
  for (const bidder of biddersData) {
    await prisma.bidder.upsert({
      where: { id: bidder.id },
      update: {
        overallRisk: bidder.overallRisk,
        riskScore: bidder.riskScore,
        checks: bidder.checks as never,
      },
      create: {
        id: bidder.id,
        tenderId: bidder.tenderId,
        companyName: bidder.companyName,
        udyamNumber: bidder.udyamNumber,
        gstin: bidder.gstin,
        pan: bidder.pan,
        overallRisk: bidder.overallRisk,
        riskScore: bidder.riskScore,
        checks: bidder.checks as never,
      },
    });
    biddersSeeded++;
  }
  console.log(`✅ Seeded ${biddersSeeded} bidders`);

  // ─── 4. Initial audit trail entries (one verification_run per bidder) ───
  let ledgerSeeded = 0;
  for (const bidder of biddersData) {
    const existingEntries = await getLedgerForBidder(bidder.id);
    if (existingEntries.length === 0) {
      await appendToLedger({
        bidderId: bidder.id,
        actorType: 'system',
        actorId: null,
        action: 'verification_run',
        detail: {
          note: 'Initial verification seeded from bidders.json',
          checksCount: (bidder.checks as unknown[]).length,
        },
      });
      ledgerSeeded++;
    }
  }
  console.log(`✅ Seeded ${ledgerSeeded} initial ledger entries`);

  // ─── 5. Default RulesConfig ───────────────────────────────────────────────
  const defaultConfig = {
    msme: { weight: 20, requiredForTender: true },
    gst: { weight: 20, flaggedPenalty: 15 },
    pan_itr: { weight: 15, mismatchPenalty: 20 },
    blacklist: { weight: 30, flaggedPenalty: 50 },
    make_in_india: { weight: 10, requiredForTender: false },
    local_content: { minPercentage: 50, weight: 5 },
    riskThresholds: { low: 25, medium: 50, high: 75 },
  };

  const existing = await prisma.rulesConfig.count();
  if (existing === 0) {
    await prisma.rulesConfig.create({
      data: {
        config: defaultConfig,
        updatedBy: 'system',
      },
    });
    console.log(`✅ Seeded default RulesConfig`);
  } else {
    console.log(`ℹ️  RulesConfig already exists, skipping`);
  }

  const totalBidders = await prisma.bidder.count();
  const totalLedger = await countLedgerEntries();
  const totalTenders = await prisma.tender.count();

  console.log(`\n📊 Seed complete:`);
  console.log(`   Tenders:       ${totalTenders}`);
  console.log(`   Bidders:       ${totalBidders}`);
  console.log(`   Ledger entries: ${totalLedger}`);

  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
