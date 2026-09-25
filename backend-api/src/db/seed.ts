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

  // ─── 2. Tenders & 3. Bidders ─────────────────────────────────────────────
  if (process.env.SEED_LEGACY_BIDDERS === 'true') {
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
    console.log(`✅ Seeded ${tenders.length} legacy tenders`);

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
          approvalState: 'pending',
          primaryReviewerId: null,
          primaryReviewedAt: null,
          secondaryReviewerId: null,
          secondaryReviewedAt: null,
          officerDecision: null as any,
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
    console.log(`✅ Seeded ${biddersSeeded} legacy bidders`);

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
  } else {
    console.log('ℹ️ Skipping legacy fixtures (seed_phase9.ts manages demo dataset)');
  }

  // ─── 5. Default RulesConfig ───────────────────────────────────────────────
  const defaultConfig = {
    msme: { weight: 0.25, requiredForTender: true },
    gst: { weight: 0.2, flaggedPenalty: 0.3 },
    pan_itr: { weight: 0.2, mismatchPenalty: 0.25 },
    blacklist: { weight: 0.25, flaggedPenalty: 1.0 },
    make_in_india: { weight: 0.1, requiredForTender: false },
    local_content: { minPercentage: 50, weight: 0.1 },
    verificationValidity: {
      msme: 1825,
      gst: 365,
      pan_itr: 365,
      blacklist: 90,
      make_in_india: 365,
    },
    confidenceThresholds: {
      auto_flag_below: 0.6,
      human_review_below: 0.8,
    },
    collusionSignalWeights: {
      sequential_pan: 0.2,
      address_similarity: 0.2,
      ip_prefix: 0.15,
      price_cv: 0.2,
      common_director: 0.15,
      registration_cluster: 0.1,
    },
    collusionThreshold: 0.6,
    deliveryGraceDays: 7,
    riskThresholds: { low: 0.3, medium: 0.6, high: 0.85 },
    session: { maxLifetimeSeconds: 3600 },
    compliance: {
      first_bid: { weight: 5, enabled: true },
      five_bids: { weight: 10, enabled: true },
      ten_bids: { weight: 15, enabled: true },
      on_time_streak_3: { weight: 15, enabled: true },
      verified_veteran: { weight: 20, enabled: true },
      msme_verified: { weight: 10, enabled: true },
      zero_gst_defaults: { weight: 15, enabled: true },
      class_1_local_supplier: { weight: 10, enabled: true },
      clean_anti_cartel: { weight: 20, enabled: true },
    },
  };

  await prisma.rulesConfig.deleteMany();
  await prisma.rulesConfig.create({
    data: {
      config: defaultConfig,
      updatedBy: 'system',
    },
  });
  console.log(`✅ Seeded default RulesConfig with 9 compliance badge keys`);

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
