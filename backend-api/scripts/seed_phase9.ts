/**
 * Phase 9 Demo Seed Script — scripts/seed_phase9.ts
 *
 * Creates:
 *   - 3 Tenders (A: ₹5,000 fee / B: ₹500 fee / C: closed with award)
 *   - 2 Officers (user-officer-001 "Priya Sharma", user-officer-002 "Rajesh Kumar")
 *   - 1 Admin (user-admin-001)
 *   - 15 Bidders across Tender-A (12) and Tender-B (3):
 *       • 3 cartel cluster (S1+S2+S4+S5 fired; cluster score 0.75; above 0.60 threshold)
 *       • 1 verified veteran (12 past bids, badges up to verified_veteran, trust 86)
 *       • 1 stale-verification bidder (checks 400 days old, verificationStatus=expired)
 *       • 1 unpaid-fee bidder on Tender-A (fee status=pending → hidden from officer view)
 *       • 9 remaining bidders across risk levels (low/medium/high/critical)
 *   - Pre-loaded ledger (≥3 entries per bidder): verification_run, fee_paid/fee_transition, officer_decision/badge_awarded
 *   - Tender-C pre-closed award:
 *       • 6 delivery milestones: 3 accepted on_time, 1 inspected on_time, 1 shipped late, 1 pending/missed
 *       • award_closed ledger entry with full deliverySummary
 *
 * Usage:
 *   npx tsx scripts/seed_phase9.ts
 *
 * Idempotent: skips users/tenders already present (by email/gemTenderId).
 */

import { PrismaClient, LedgerActionType, ActorType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sha256(val: string): string {
  return crypto.createHash('sha256').update(val).digest('hex');
}

async function upsertUser(data: {
  id: string;
  email: string;
  name: string;
  role: 'officer' | 'admin' | 'bidder';
  password: string;
}) {
  // Check by email first
  const existingByEmail = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingByEmail) {
    console.log(`  [SKIP] User already exists (by email): ${data.email}`);
    return existingByEmail;
  }
  // Check by ID (may have been created with different email in prior phases)
  const existingById = await prisma.user.findUnique({ where: { id: data.id } });
  if (existingById) {
    console.log(`  [SKIP] User already exists (by id=${data.id}): ${existingById.email}`);
    return existingById;
  }
  const existing = null;
  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { id: data.id, email: data.email, name: data.name, role: data.role, passwordHash },
  });
  console.log(`  [CREATE] User: ${data.email} (${data.role})`);
  return user;
}

async function upsertTender(data: {
  id: string;
  gemTenderId: string;
  title: string;
  applicationFee: number;
  status?: any;
}) {
  const existingByGem = await prisma.tender.findUnique({ where: { gemTenderId: data.gemTenderId } });
  if (existingByGem) {
    console.log(`  [SKIP] Tender already exists (by gemTenderId): ${data.gemTenderId}`);
    return existingByGem;
  }
  const existingById = await prisma.tender.findUnique({ where: { id: data.id } });
  if (existingById) {
    console.log(`  [SKIP] Tender already exists (by id=${data.id}): ${existingById.gemTenderId}`);
    return existingById;
  }
  const tender = await prisma.tender.create({
    data: {
      id: data.id,
      gemTenderId: data.gemTenderId,
      title: data.title,
      applicationFee: data.applicationFee,
      status: data.status ?? 'open',
    },
  });
  console.log(`  [CREATE] Tender: ${data.gemTenderId} — ${data.title}`);
  return tender;
}

async function appendLedger(params: {
  bidderId: string;
  actorType: ActorType;
  actorId: string | null;
  action: LedgerActionType;
  detail: object;
  createdAt?: Date;
}) {
  return prisma.ledgerEntry.create({
    data: {
      bidderId: params.bidderId,
      actorType: params.actorType,
      actorId: params.actorId,
      action: params.action,
      detail: params.detail as any,
      createdAt: params.createdAt ?? new Date(),
    },
  });
}

// ─── Trust Score Formula (mirrors src/services/profile/score.ts) ─────────────
function computeTrustScore(onTime: number, late: number, failed: number, disq: number): number {
  let score = 50;
  score += Math.min(onTime * 5, 30);
  score -= late * 8;
  score -= failed * 15;
  score -= disq * 10;
  score += Math.min((onTime + late) * 2, 20);
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n=== Phase 9 Demo Seed ===\n');

  // ─── 1. Users ───────────────────────────────────────────────────────────────
  console.log('─── Users ───────────────────────────────────────────────────');
  const officer1 = await upsertUser({
    id: 'user-officer-001',
    email: 'priya.sharma@gem.gov.in',
    name: 'Priya Sharma',
    role: 'officer',
    password: 'Officer@123!',
  });
  const officer2 = await upsertUser({
    id: 'user-officer-002',
    email: 'rajesh.kumar@gem.gov.in',
    name: 'Rajesh Kumar',
    role: 'officer',
    password: 'Officer@123!',
  });
  const adminUser = await upsertUser({
    id: 'user-admin-001',
    email: 'admin@gem.gov.in',
    name: 'GeM Admin',
    role: 'admin',
    password: 'Admin@123!',
  });
  console.log();

  // ─── 2. Tenders ─────────────────────────────────────────────────────────────
  console.log('─── Tenders ─────────────────────────────────────────────────');
  const tenderA = await upsertTender({
    id: 'tender-001',
    gemTenderId: 'GEM/2026/B/5001234',
    title: 'Procurement of IT Hardware and Peripherals 2026',
    applicationFee: 5000,
    status: 'open',
  });
  const tenderB = await upsertTender({
    id: 'tender-002',
    gemTenderId: 'GEM/2026/B/5001235',
    title: 'Procurement of Office Stationery and Supplies Q4 2026',
    applicationFee: 500,
    status: 'open',
  });
  const tenderC = await upsertTender({
    id: 'tender-003',
    gemTenderId: 'GEM/2026/B/5001236',
    title: 'Procurement of Network Infrastructure Equipment 2025',
    applicationFee: 0,
    status: 'closed',
  });
  console.log();

  // ─── 3. Bidder definitions ───────────────────────────────────────────────────
  console.log('─── Bidders ─────────────────────────────────────────────────');

  // Signal score math (for cartel cluster on Tender-A):
  //   S1=shared_director_pan  weight=0.25  ✓
  //   S2=shared_address        weight=0.15  ✓ (similarity=1.0)
  //   S3=sequential_pan_issuance weight=0.10 ✗ (dates differ >30 days)
  //   S4=sequential_submissions  weight=0.15  ✓ (same /24, within 5 min)
  //   S5=price_clustering        weight=0.20  ✓ (CoV <0.014%)
  //   S6=identical_templates     weight=0.15  ✗ (different templateHash)
  //   score = (0.25+0.15+0.15+0.20)/1.00 = 0.75 ∈ [0.72, 0.78] ✓
  //   Cluster fires above threshold=0.60 ✓

  const CARTEL_IP_PREFIX = '192.168.10';
  const CARTEL_DIRECTOR_PAN = 'AABCM1234D'; // shared across all 3 cartel bidders
  const CARTEL_ADDRESS_BASE = 'B-12 Tech Park Phase II Sector 62 Noida Uttar Pradesh 201301';
  const CARTEL_SUBMISSION_BASE = new Date('2026-09-20T09:00:00Z');
  // For CoV <0.014%: prices within 0.028% of each other
  // mean=5_100_000, all within 5_100_000 ± 700 → CoV ≈ 0.013%
  const CARTEL_PRICES = [5_100_000, 5_100_200, 5_099_800];

  // Common MCA check factory
  function mcaCheck(directorPan: string, address: string): object {
    return {
      name: 'mca',
      title: 'MCA21 Company Compliance',
      category: 'company_compliance',
      status: 'passed',
      trust_source: 'simulated',
      trustSource: 'Simulated',
      value: directorPan,
      detail: {
        directorPans: [directorPan],
        registeredAddress: address,
        companyType: 'Private Limited',
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  function panCheck(panIssuanceDate: string, mismatch = false): object {
    return {
      name: 'pan_itr',
      title: 'PAN & ITR Compliance',
      category: 'pan_itr_compliance',
      status: mismatch ? 'flagged' : 'passed',
      trust_source: 'simulated',
      trustSource: 'Simulated',
      value: 'ITR-V Filed',
      detail: {
        panIssuanceDate,
        itrFiled: true,
        mismatch,
      },
    };
  }

  function gstCheck(status: 'passed' | 'flagged' | 'warning' = 'passed'): object {
    return {
      name: 'gst',
      title: 'GST Compliance',
      category: 'tax_compliance',
      status,
      trust_source: 'simulated',
      trustSource: 'Simulated',
      value: 'GSTR-3B Active',
      detail: { gstinActive: status === 'passed', returnsFiled: true },
    };
  }

  function blacklistCheck(flagged = false): object {
    return {
      name: 'blacklist',
      title: 'Debarment & Blacklist Check',
      category: 'debarment',
      status: flagged ? 'flagged' : 'passed',
      trust_source: 'simulated',
      trustSource: 'Simulated',
      value: flagged ? 'Debarred' : 'Clean Record',
      detail: { blacklisted: flagged },
    };
  }

  function makeInIndiaCheck(compliant = true): object {
    return {
      name: 'make_in_india',
      title: 'Make in India (Local Content)',
      category: 'local_content',
      status: compliant ? 'passed' : 'warning',
      trust_source: 'simulated',
      trustSource: 'Simulated',
      value: compliant ? '65% Local Content' : '30% Local Content',
      detail: { compliant, localContentPercent: compliant ? 65 : 30 },
    };
  }

  function msmeCheck(registered = true): object {
    return {
      name: 'msme',
      title: 'MSME / Udyam Verification',
      category: 'msme_compliance',
      status: registered ? 'passed' : 'warning',
      trust_source: 'portal_verified',
      trustSource: 'Portal Verified',
      value: registered ? 'UDYAM Registered' : 'Not Registered',
      detail: { registered, udyamCertValid: registered },
    };
  }

  // Stale verification check factory (400 days old)
  function staleCheck(): object {
    const staleDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    return {
      name: 'stale_marker',
      category: 'verification_age',
      status: 'warning',
      trust_source: 'portal_verified',
      trustSource: 'Portal Verified',
      detail: { lastVerifiedAt: staleDate, ageInDays: 400, threshold: 365 },
    };
  }

  // ── Cartel Cluster (Tender-A, bidders C1, C2, C3) ──────────────────────────
  const cartelAddresses = [
    CARTEL_ADDRESS_BASE, // exact same
    'B-12 Tech Park Phase-II Sector 62 Noida UP 201301', // near-identical (≥0.90 Lev)
    'B-12 Tech Park Phase 2, Sector 62, Noida, Uttar Pradesh 201301', // ≥0.90 similarity
  ];

  const cartelBidders = [
    {
      id: 'bidder-c1',
      companyName: 'Apex Tech Solutions Pvt Ltd',
      pan: 'AATCS1234A',
      gstin: '09AATCS1234A1ZP',
      overallRisk: 'high' as const,
      riskScore: 0.72,
      quotedPrice: CARTEL_PRICES[0],
      submissionIp: `${CARTEL_IP_PREFIX}.101`,
      submissionOffset: 0,
      address: cartelAddresses[0],
      panDate: '2017-03-15',
    },
    {
      id: 'bidder-c2',
      companyName: 'Prime Digital Ventures Pvt Ltd',
      pan: 'AAPDV5678B',
      gstin: '09AAPDV5678B1ZQ',
      overallRisk: 'high' as const,
      riskScore: 0.74,
      quotedPrice: CARTEL_PRICES[1],
      submissionIp: `${CARTEL_IP_PREFIX}.102`,
      submissionOffset: 2,
      address: cartelAddresses[1],
      panDate: '2019-08-20',
    },
    {
      id: 'bidder-c3',
      companyName: 'Global IT Infra Services Pvt Ltd',
      pan: 'AAGIS9012C',
      gstin: '09AAGIS9012C1ZR',
      overallRisk: 'high' as const,
      riskScore: 0.73,
      quotedPrice: CARTEL_PRICES[2],
      submissionIp: `${CARTEL_IP_PREFIX}.103`,
      submissionOffset: 4,
      address: cartelAddresses[2],
      panDate: '2021-11-10',
    },
  ];

  for (const cb of cartelBidders) {
    const cartelChecks = [
      mcaCheck(CARTEL_DIRECTOR_PAN, cb.address),
      gstCheck('passed'),
      panCheck(cb.panDate), // dates > 30 days apart across cluster so S3 does NOT fire
      blacklistCheck(false),
      makeInIndiaCheck(true),
      msmeCheck(true),
    ];

    const existing = await prisma.bidder.findUnique({ where: { id: cb.id } });
    if (existing) {
      console.log(`  [UPDATE] Bidder ${cb.id} checks with panDate=${cb.panDate}`);
      await prisma.bidder.update({
        where: { id: cb.id },
        data: {
          checks: cartelChecks as any,
          submissionIp: cb.submissionIp,
          quotedPrice: cb.quotedPrice,
        },
      });
      continue;
    }
    const submissionTime = new Date(
      CARTEL_SUBMISSION_BASE.getTime() + cb.submissionOffset * 60 * 1000
    );
    await prisma.bidder.create({
      data: {
        id: cb.id,
        tenderId: tenderA.id,
        companyName: cb.companyName,
        pan: cb.pan,
        gstin: cb.gstin,
        overallRisk: cb.overallRisk,
        riskScore: cb.riskScore,
        quotedPrice: cb.quotedPrice,
        submissionIp: cb.submissionIp,
        approvalState: 'pending',
        createdAt: submissionTime,
        checks: cartelChecks as any,
      },
    });
    // Ensure fee payment exists and is paid (so they're visible)
    await prisma.applicationFeePayment.upsert({
      where: { tenderId_bidderId: { tenderId: tenderA.id, bidderId: cb.id } },
      update: {},
      create: {
        tenderId: tenderA.id,
        bidderId: cb.id,
        amount: tenderA.applicationFee,
        status: 'paid',
        gatewayRef: `MOCK-PAY-${cb.id}`,
        paidAt: new Date(),
      },
    });
    console.log(`  [CREATE] Cartel bidder: ${cb.id} (${cb.companyName})`);
  }

  // ── Verified Veteran (Tender-A) ─────────────────────────────────────────────
  // 12 past bids, 6 on-time, 1 late → trust = 50+30+14-8=86 ∈ [78,88]
  // verified_veteran badge requires bids>=10 && trust>=75 ✓
  const veteranPan = 'AAVTV1111E';
  const veteranProfileKey = sha256(veteranPan);
  {
    const existing = await prisma.bidder.findUnique({ where: { id: 'bidder-vet' } });
    if (existing) {
      console.log(`  [SKIP] Bidder bidder-vet already exists`);
    } else {
      await prisma.bidder.create({
        data: {
          id: 'bidder-vet',
          tenderId: tenderA.id,
          companyName: 'VetTech Enterprise Solutions',
          pan: veteranPan,
          gstin: '07AAVTV1111E1ZS',
          overallRisk: 'low',
          riskScore: 0.12,
          quotedPrice: 4_800_000,
          approvalState: 'pending',
          checks: [
            mcaCheck('AAVTD9999Z', '14 Connaught Place New Delhi 110001'),
            gstCheck('passed'),
            panCheck('2010-03-01'),
            blacklistCheck(false),
            makeInIndiaCheck(true),
            msmeCheck(false),
          ] as any,
        },
      });
      // Paid fee
      await prisma.applicationFeePayment.upsert({
        where: { tenderId_bidderId: { tenderId: tenderA.id, bidderId: 'bidder-vet' } },
        update: {},
        create: {
          tenderId: tenderA.id,
          bidderId: 'bidder-vet',
          amount: tenderA.applicationFee,
          status: 'paid',
          gatewayRef: 'MOCK-PAY-bidder-vet',
          paidAt: new Date(),
        },
      });
      console.log(`  [CREATE] Verified veteran bidder: bidder-vet`);
    }

    // Upsert BidderProfile for veteran (12 bids history)
    // 6 on_time, 1 late → trust=86, badges: first_bid, five_bids, ten_bids, verified_veteran, clean_slate(no, 1 late, so on_time_streak_3 won't apply either)
    // Wait: clean_slate = bids>=1 && disq==0 && failed==0 → 0 disq, 0 failed → clean_slate earned
    // on_time_streak_3 = onTime>=3 && late==0 && failed==0 → NOT earned (1 late)
    const veteranTrustScore = computeTrustScore(6, 1, 0, 0); // = 86
    await prisma.bidderProfile.upsert({
      where: { bidderCompanyId: veteranProfileKey },
      update: {
        displayName: 'VetTech Enterprise Solutions',
        totalBidsSubmitted: 12,
        totalBidsWon: 2,
        totalBidsLost: 4,
        onTimeDeliveries: 6,
        lateDeliveries: 1,
        failedDeliveries: 0,
        disqualifications: 0,
        trustScore: veteranTrustScore,
        badges: ['first_bid', 'five_bids', 'ten_bids', 'verified_veteran', 'clean_slate'],
      },
      create: {
        bidderCompanyId: veteranProfileKey,
        displayName: 'VetTech Enterprise Solutions',
        totalBidsSubmitted: 12,
        totalBidsWon: 2,
        totalBidsLost: 4,
        onTimeDeliveries: 6,
        lateDeliveries: 1,
        failedDeliveries: 0,
        disqualifications: 0,
        trustScore: veteranTrustScore,
        badges: ['first_bid', 'five_bids', 'ten_bids', 'verified_veteran', 'clean_slate'],
      },
    });
    console.log(`  [UPSERT] BidderProfile for veteran (trust=${veteranTrustScore})`);
  }

  // ── Stale-verification bidder (Tender-A) ────────────────────────────────────
  {
    const existing = await prisma.bidder.findUnique({ where: { id: 'bidder-stale' } });
    if (existing) {
      console.log(`  [SKIP] Bidder bidder-stale already exists`);
    } else {
      const staleDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      await prisma.bidder.create({
        data: {
          id: 'bidder-stale',
          tenderId: tenderA.id,
          companyName: 'Outdated Infra Corp',
          pan: 'AAOIC3456F',
          gstin: '27AAOIC3456F1ZT',
          overallRisk: 'medium',
          riskScore: 0.45,
          approvalState: 'pending',
          verifiedAt: staleDate,
          checks: [
            // All checks have stale timestamps (400 days old)
            {
              name: 'mca',
              category: 'company_compliance',
              status: 'passed',
              trust_source: 'simulated',
              trustSource: 'Simulated',
              detail: {
                directorPans: ['AAOMD8888G'],
                registeredAddress: '22 MG Road Bengaluru Karnataka 560001',
                verifiedAt: staleDate.toISOString(),
              },
            },
            {
              name: 'gst',
              category: 'tax_compliance',
              status: 'passed',
              trust_source: 'simulated',
              trustSource: 'Simulated',
              detail: { gstinActive: true, returnsFiled: true, verifiedAt: staleDate.toISOString() },
            },
            staleCheck(),
          ] as any,
        },
      });
      // Paid fee
      await prisma.applicationFeePayment.upsert({
        where: { tenderId_bidderId: { tenderId: tenderA.id, bidderId: 'bidder-stale' } },
        update: {},
        create: {
          tenderId: tenderA.id,
          bidderId: 'bidder-stale',
          amount: tenderA.applicationFee,
          status: 'paid',
          gatewayRef: 'MOCK-PAY-bidder-stale',
          paidAt: new Date(),
        },
      });
      console.log(`  [CREATE] Stale-verification bidder: bidder-stale (checks 400 days old)`);
    }
  }

  // ── Unpaid-fee bidder (Tender-A) ─────────────────────────────────────────────
  {
    const existing = await prisma.bidder.findUnique({ where: { id: 'bidder-unpaid' } });
    if (existing) {
      console.log(`  [SKIP] Bidder bidder-unpaid already exists`);
    } else {
      await prisma.bidder.create({
        data: {
          id: 'bidder-unpaid',
          tenderId: tenderA.id,
          companyName: 'NoPay Trading Co',
          pan: 'AANPT6789G',
          gstin: '36AANPT6789G1ZU',
          overallRisk: 'medium',
          riskScore: 0.40,
          approvalState: 'pending',
          checks: [gstCheck('passed'), panCheck('2018-01-01')] as any,
        },
      });
      // Fee payment exists but remains 'pending' — officer list will exclude this bidder
      await prisma.applicationFeePayment.upsert({
        where: { tenderId_bidderId: { tenderId: tenderA.id, bidderId: 'bidder-unpaid' } },
        update: {},
        create: {
          tenderId: tenderA.id,
          bidderId: 'bidder-unpaid',
          amount: tenderA.applicationFee,
          status: 'pending',
          gatewayRef: 'MOCK-PAY-bidder-unpaid',
        },
      });
      console.log(`  [CREATE] Unpaid-fee bidder: bidder-unpaid (fee=pending, hidden from officer view)`);
    }
  }

  // ── Remaining bidders on Tender-A (5 more) — risk variety ─────────────────
  const remainingBiddersA = [
    {
      id: 'bidder-a4',
      companyName: 'TrustLine Systems Pvt Ltd',
      pan: 'AATLS4444H',
      gstin: '06AATLS4444H1ZV',
      overallRisk: 'low' as const,
      riskScore: 0.08,
      quotedPrice: 5_250_000,
      submissionIp: '10.0.1.50',
      riskLabel: 'low',
    },
    {
      id: 'bidder-a5',
      companyName: 'NexGen Hardware Pvt Ltd',
      pan: 'AANGH5555I',
      gstin: '29AANGH5555I1ZW',
      overallRisk: 'medium' as const,
      riskScore: 0.38,
      quotedPrice: 5_400_000,
      submissionIp: '10.0.2.60',
      riskLabel: 'medium',
    },
    {
      id: 'bidder-a6',
      companyName: 'Digital Bridge Technologies',
      pan: 'AADBT6666J',
      gstin: '32AADBT6666J1ZX',
      overallRisk: 'high' as const,
      riskScore: 0.65,
      quotedPrice: 4_950_000,
      submissionIp: '10.0.3.70',
      riskLabel: 'high',
    },
    {
      id: 'bidder-a7',
      companyName: 'FastBit Computing Pvt Ltd',
      pan: 'AAFBC7777K',
      gstin: '08AAFBC7777K1ZY',
      overallRisk: 'medium' as const,
      riskScore: 0.42,
      quotedPrice: 4_500_000,
      submissionIp: '172.16.0.80',
      riskLabel: 'medium',
    },
    {
      id: 'bidder-a8',
      companyName: 'Spectrum IT Solutions',
      pan: 'AAITS8888L',
      gstin: '19AAITS8888L1ZZ',
      overallRisk: 'low' as const,
      riskScore: 0.15,
      quotedPrice: 5_150_000,
      submissionIp: '10.0.4.90',
      riskLabel: 'low',
    },
  ];

  for (const rb of remainingBiddersA) {
    const existing = await prisma.bidder.findUnique({ where: { id: rb.id } });
    if (existing) {
      console.log(`  [SKIP] Bidder ${rb.id} already exists`);
      continue;
    }
    const isFlagged = rb.riskLabel === 'critical' || rb.riskLabel === 'high';
    await prisma.bidder.create({
      data: {
        id: rb.id,
        tenderId: tenderA.id,
        companyName: rb.companyName,
        pan: rb.pan,
        gstin: rb.gstin,
        overallRisk: rb.overallRisk,
        riskScore: rb.riskScore,
        quotedPrice: rb.quotedPrice,
        submissionIp: rb.submissionIp,
        approvalState: 'pending',
        checks: [
          mcaCheck(`AADIR${rb.id.slice(-4).toUpperCase()}9Z`, `Plot ${rb.id} Industrial Area`),
          gstCheck(isFlagged ? 'flagged' : 'passed'),
          panCheck('2015-08-20', isFlagged),
          blacklistCheck(rb.riskLabel === 'critical'),
          makeInIndiaCheck(!isFlagged),
          msmeCheck(rb.riskLabel === 'low'),
        ] as any,
      },
    });
    await prisma.applicationFeePayment.upsert({
      where: { tenderId_bidderId: { tenderId: tenderA.id, bidderId: rb.id } },
      update: {},
      create: {
        tenderId: tenderA.id,
        bidderId: rb.id,
        amount: tenderA.applicationFee,
        status: 'paid',
        gatewayRef: `MOCK-PAY-${rb.id}`,
        paidAt: new Date(),
      },
    });
    console.log(`  [CREATE] Bidder ${rb.id} (${rb.riskLabel} risk, ${rb.companyName})`);
  }

  // ── 3 Bidders on Tender-B ──────────────────────────────────────────────────
  const tenderBBidders = [
    {
      id: 'bidder-b1',
      companyName: 'StatShop Office Supplies',
      pan: 'AASOP1111M',
      gstin: '11AASOP1111M1ZA',
      overallRisk: 'low' as const,
      riskScore: 0.10,
      quotedPrice: 180_000,
    },
    {
      id: 'bidder-b2',
      companyName: 'QuickPrint Wholesale',
      pan: 'AAQPW2222N',
      gstin: '22AAQPW2222N1ZB',
      overallRisk: 'medium' as const,
      riskScore: 0.35,
      quotedPrice: 210_000,
    },
    {
      id: 'bidder-b3',
      companyName: 'PaperTrail Enterprises',
      pan: 'AAPTE3333O',
      gstin: '33AAPTE3333O1ZC',
      overallRisk: 'low' as const,
      riskScore: 0.05,
      quotedPrice: 195_000,
    },
    {
      id: 'bidder-b4',
      companyName: 'SupplyHub Logistics & Warehousing',
      pan: 'AASHL4444P',
      gstin: '07AASHL4444P1ZD',
      overallRisk: 'medium' as const,
      riskScore: 0.30,
      quotedPrice: 220_000,
    },
  ];

  for (const bb of tenderBBidders) {
    const existing = await prisma.bidder.findUnique({ where: { id: bb.id } });
    if (existing) {
      console.log(`  [SKIP] Bidder ${bb.id} already exists`);
      continue;
    }
    await prisma.bidder.create({
      data: {
        id: bb.id,
        tenderId: tenderB.id,
        companyName: bb.companyName,
        pan: bb.pan,
        gstin: bb.gstin,
        overallRisk: bb.overallRisk,
        riskScore: bb.riskScore,
        quotedPrice: bb.quotedPrice,
        submissionIp: `10.10.1.${tenderBBidders.indexOf(bb) + 100}`,
        approvalState: 'pending',
        checks: [
          mcaCheck(`AADIRB${bb.id.slice(-2).toUpperCase()}9Z`, `Block ${bb.id}, Tilak Nagar, New Delhi 110018`),
          gstCheck('passed'),
          panCheck('2016-04-10'),
          blacklistCheck(false),
          makeInIndiaCheck(true),
          msmeCheck(true),
        ] as any,
      },
    });
    await prisma.applicationFeePayment.upsert({
      where: { tenderId_bidderId: { tenderId: tenderB.id, bidderId: bb.id } },
      update: {},
      create: {
        tenderId: tenderB.id,
        bidderId: bb.id,
        amount: tenderB.applicationFee,
        status: 'paid',
        gatewayRef: `MOCK-PAY-${bb.id}`,
        paidAt: new Date(),
      },
    });
    console.log(`  [CREATE] Tender-B bidder: ${bb.id} (${bb.companyName})`);
  }

  console.log();

  // ─── 4. Pre-loaded ledger entries (≥3 per bidder) ──────────────────────────
  console.log('─── Ledger Entries (initial) ─────────────────────────────────');

  const allBidderIds = [
    ...cartelBidders.map(b => b.id),
    'bidder-vet',
    'bidder-stale',
    'bidder-unpaid',
    ...remainingBiddersA.map(b => b.id),
    ...tenderBBidders.map(b => b.id),
  ];

  for (const bidderId of allBidderIds) {
    const existing = await prisma.ledgerEntry.findFirst({ where: { bidderId } });
    if (existing) {
      console.log(`  [SKIP] Ledger entries already exist for ${bidderId}`);
      continue;
    }

    const t0 = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const t1 = new Date(t0.getTime() + 2 * 60 * 60 * 1000);     // +2h
    const t2 = new Date(t1.getTime() + 4 * 60 * 60 * 1000);     // +4h

    // 1. verification_run
    await appendLedger({
      bidderId,
      actorType: 'officer',
      actorId: officer1.id,
      action: 'verification_run',
      detail: {
        bidderId,
        tiersRun: ['digilocker', 'portal', 'ai_extraction', 'simulated'],
        tiersSucceeded: ['digilocker', 'portal', 'ai_extraction', 'simulated'],
        overallRisk: 'low',
        riskScore: 0.15,
        note: 'Initial verification at application time',
      },
      createdAt: t0,
    });

    // 2. fee_paid or fee_transition
    if (bidderId !== 'bidder-unpaid') {
      await appendLedger({
        bidderId,
        actorType: 'bidder',
        actorId: bidderId,
        action: 'fee_paid',
        detail: {
          bidderId,
          amount: allBidderIds.indexOf(bidderId) < 9 ? 5000 : 500,
          paidAt: t1.toISOString(),
          note: 'Application fee paid via mock gateway',
        },
        createdAt: t1,
      });
    } else {
      await appendLedger({
        bidderId,
        actorType: 'bidder',
        actorId: bidderId,
        action: 'fee_transition',
        detail: {
          bidderId,
          from: 'created',
          to: 'pending',
          note: 'Fee payment initiated but not completed',
        },
        createdAt: t1,
      });
    }

    // 3. officer_decision or badge_awarded
    const isCartel = cartelBidders.some(cb => cb.id === bidderId);
    const isVeteran = bidderId === 'bidder-vet';

    if (isVeteran) {
      await appendLedger({
        bidderId,
        actorType: 'system',
        actorId: null,
        action: 'badge_awarded',
        detail: {
          badge: 'verified_veteran',
          bidderId,
          trustScore: computeTrustScore(6, 1, 0, 0),
          note: 'Badge unlocked: 12 bids, trust score 86',
        },
        createdAt: t2,
      });
    } else if (isCartel) {
      await appendLedger({
        bidderId,
        actorType: 'officer',
        actorId: officer1.id,
        action: 'officer_decision',
        detail: {
          bidderId,
          status: 'under_review',
          reason: 'Collusion signals detected — pending secondary review',
        },
        createdAt: t2,
      });
    } else {
      await appendLedger({
        bidderId,
        actorType: 'officer',
        actorId: officer1.id,
        action: 'officer_decision',
        detail: {
          bidderId,
          status: 'pending',
          reason: 'Awaiting officer review',
        },
        createdAt: t2,
      });
    }

    console.log(`  [LEDGER] 3 entries created for ${bidderId}`);
  }

  // Pre-load collusion_analysis_run entry for cartel cluster on Tender-A
  const existingCollusionEntry = await prisma.ledgerEntry.findFirst({
    where: { action: 'collusion_analysis_run', bidderId: 'bidder-c1' },
  });
  if (!existingCollusionEntry) {
    await appendLedger({
      bidderId: 'bidder-c1',
      actorType: 'officer',
      actorId: officer1.id,
      action: 'collusion_analysis_run',
      detail: {
        tenderId: tenderA.id,
        totalBiddersAnalyzed: 11,
        clusters: [
          {
            clusterId: 'cluster-cartel-001',
            bidderIds: ['bidder-c1', 'bidder-c2', 'bidder-c3'],
            signalsFired: ['shared_director_pan', 'shared_address', 'sequential_submissions', 'price_clustering'],
            aggregateScore: 0.75,
            pairs: [
              {
                bidderAId: 'bidder-c1',
                bidderBId: 'bidder-c2',
                score: 0.75,
                signalsFired: ['shared_director_pan', 'shared_address', 'sequential_submissions', 'price_clustering'],
              },
              {
                bidderAId: 'bidder-c1',
                bidderBId: 'bidder-c3',
                score: 0.75,
                signalsFired: ['shared_director_pan', 'shared_address', 'sequential_submissions', 'price_clustering'],
              },
              {
                bidderAId: 'bidder-c2',
                bidderBId: 'bidder-c3',
                score: 0.75,
                signalsFired: ['shared_director_pan', 'shared_address', 'sequential_submissions', 'price_clustering'],
              },
            ],
          },
        ],
        signalWeightsUsed: {
          sharedDirectorPan: 0.25,
          sharedAddress: 0.15,
          sequentialPanIssuance: 0.1,
          sequentialSubmissions: 0.15,
          priceClustering: 0.2,
          identicalTemplates: 0.15,
        },
        threshold: 0.6,
        timestamp: new Date().toISOString(),
      },
      createdAt: new Date(),
    });
    console.log('  [LEDGER] collusion_analysis_run entry created for cartel cluster (bidder-c1)');
  }

  console.log();

  // ─── 5. Tender-C: Pre-closed award with winning bidder ────────────────────
  console.log('─── Tender-C: Pre-closed Award ──────────────────────────────');

  // Winning bidder for Tender-C (a fresh bidder, separate from A/B)
  const winnerPan = 'AAWBS9999P';
  const winnerProfileKey = sha256(winnerPan);

  let winnerBidder = await prisma.bidder.findUnique({ where: { id: 'bidder-c-winner' } });
  if (!winnerBidder) {
    winnerBidder = await prisma.bidder.create({
      data: {
        id: 'bidder-c-winner',
        tenderId: tenderC.id,
        companyName: 'WinBridge Systems Ltd',
        pan: winnerPan,
        gstin: '07AAWBS9999P1ZQ',
        overallRisk: 'low',
        riskScore: 0.10,
        quotedPrice: 12_500_000,
        approvalState: 'awarded',
        officerDecision: { status: 'qualified', reason: 'All checks passed with exemplary scores', reviewedAt: new Date('2026-07-01T10:00:00Z').toISOString() } as any,
        verifiedAt: new Date('2026-07-01T09:00:00Z'),
        primaryReviewerId: officer1.id,
        secondaryReviewerId: officer2.id,
        primaryReviewedAt: new Date('2026-07-01T10:00:00Z'),
        secondaryReviewedAt: new Date('2026-07-01T14:00:00Z'),
        checks: [
          mcaCheck('AAWMB7777Z', '5 Rajiv Gandhi IT Park Chandigarh Punjab 160101'),
          gstCheck('passed'),
          panCheck('2012-06-01'),
          blacklistCheck(false),
          makeInIndiaCheck(true),
          msmeCheck(true),
        ] as any,
      },
    });
    console.log(`  [CREATE] Winning bidder for Tender-C: bidder-c-winner`);
  } else {
    console.log(`  [SKIP] bidder-c-winner already exists`);
  }

  // 2 Qualified losers for Tender-C (past history)
  let loser1Bidder = await prisma.bidder.findUnique({ where: { id: 'bidder-c-loser1' } });
  if (!loser1Bidder) {
    loser1Bidder = await prisma.bidder.create({
      data: {
        id: 'bidder-c-loser1',
        tenderId: tenderC.id,
        companyName: 'Apex Telecom Infrastructure Ltd',
        pan: 'AAATI1111L',
        gstin: '07AAATI1111L1Z1',
        overallRisk: 'low',
        riskScore: 0.12,
        quotedPrice: 14_200_000,
        approvalState: 'rejected',
        officerDecision: { status: 'qualified', reason: 'Qualified on compliance and technical evaluation; evaluated as L2 bidder on commercial opening', reviewedAt: new Date('2026-07-01T11:00:00Z').toISOString() } as any,
        verifiedAt: new Date('2026-07-01T09:30:00Z'),
        primaryReviewerId: officer1.id,
        secondaryReviewerId: officer2.id,
        primaryReviewedAt: new Date('2026-07-01T10:30:00Z'),
        secondaryReviewedAt: new Date('2026-07-01T14:30:00Z'),
        checks: [
          mcaCheck('AAATB1111Z', '12 Okhla Industrial Area Phase III New Delhi 110020'),
          gstCheck('passed'),
          panCheck('2014-04-10'),
          blacklistCheck(false),
          makeInIndiaCheck(true),
          msmeCheck(true),
        ] as any,
      },
    });
    console.log(`  [CREATE] Qualified loser 1 for Tender-C: bidder-c-loser1`);
  } else {
    console.log(`  [SKIP] bidder-c-loser1 already exists`);
  }

  let loser2Bidder = await prisma.bidder.findUnique({ where: { id: 'bidder-c-loser2' } });
  if (!loser2Bidder) {
    loser2Bidder = await prisma.bidder.create({
      data: {
        id: 'bidder-c-loser2',
        tenderId: tenderC.id,
        companyName: 'OptiNet Global Solutions Pvt Ltd',
        pan: 'AAONC2222M',
        gstin: '27AAONC2222M1Z2',
        overallRisk: 'low',
        riskScore: 0.15,
        quotedPrice: 13_800_000,
        approvalState: 'rejected',
        officerDecision: { status: 'qualified', reason: 'Qualified on compliance and technical evaluation; evaluated as L3 bidder on commercial opening', reviewedAt: new Date('2026-07-01T11:15:00Z').toISOString() } as any,
        verifiedAt: new Date('2026-07-01T09:45:00Z'),
        primaryReviewerId: officer1.id,
        secondaryReviewerId: officer2.id,
        primaryReviewedAt: new Date('2026-07-01T10:45:00Z'),
        secondaryReviewedAt: new Date('2026-07-01T14:45:00Z'),
        checks: [
          mcaCheck('AAONB2222Z', '404 Bandra Kurla Complex Mumbai Maharashtra 400051'),
          gstCheck('passed'),
          panCheck('2016-09-15'),
          blacklistCheck(false),
          makeInIndiaCheck(true),
          msmeCheck(false),
        ] as any,
      },
    });
    console.log(`  [CREATE] Qualified loser 2 for Tender-C: bidder-c-loser2`);
  } else {
    console.log(`  [SKIP] bidder-c-loser2 already exists`);
  }

  // Check if AwardDecision exists for Tender-C
  let award = await prisma.awardDecision.findFirst({ where: { tenderId: tenderC.id } });
  if (!award) {
    const awardDate = new Date('2026-07-02T11:00:00Z');
    const finalizeDate = new Date('2026-07-02T15:00:00Z');

    award = await prisma.awardDecision.create({
      data: {
        id: 'award-c-001',
        tenderId: tenderC.id,
        winningBidderId: winnerBidder.id,
        primaryOfficerId: officer1.id,
        secondaryOfficerId: officer2.id,
        justification:
          'WinBridge Systems Ltd demonstrated superior technical capability, full GeM compliance, competitive pricing at ₹1.25 Cr, and a proven delivery track record across 12 prior government contracts. All verification tiers passed with high confidence. No collusion signals detected. Two standout factors confirm the award.',
        standoutFactors: [
          { factor: 'On-time delivery record', note: '100% on-time across last 6 contracts' },
          { factor: 'Make in India compliance', note: '78% local content — exceeds 50% threshold' },
        ] as any,
        submittedAt: awardDate,
        finalizedAt: finalizeDate,
      },
    });
    console.log(`  [CREATE] AwardDecision: award-c-001`);
  } else {
    console.log(`  [SKIP] AwardDecision already exists for Tender-C`);
  }

  // Milestones
  const existingMilestones = await prisma.deliveryMilestone.findMany({ where: { awardId: award.id } });
  if (existingMilestones.length === 0) {
    const baseDate = new Date('2026-07-03T00:00:00Z');
    const day = (n: number) => new Date(baseDate.getTime() + n * 24 * 60 * 60 * 1000);

    const milestoneData = [
      // 3 accepted on_time
      { label: 'PO_issued',        dueDate: day(3),   completedAt: day(2),  status: 'on_time' },
      { label: 'shipped',          dueDate: day(10),  completedAt: day(9),  status: 'on_time' },
      { label: 'received',         dueDate: day(17),  completedAt: day(16), status: 'on_time' },
      // 1 inspected on_time
      { label: 'inspected',        dueDate: day(22),  completedAt: day(22), status: 'on_time' },
      // 1 shipped late
      { label: 'accepted',         dueDate: day(27),  completedAt: day(30), status: 'late' },
      // 1 pending with dueDate past → auto-missed at close
      { label: 'payment_released', dueDate: day(35),  completedAt: null,    status: 'missed' },
    ];

    for (const md of milestoneData) {
      await prisma.deliveryMilestone.create({
        data: {
          awardId: award.id,
          label: md.label,
          dueDate: md.dueDate,
          completedAt: md.completedAt,
          status: md.status,
        },
      });
    }
    console.log(`  [CREATE] 6 delivery milestones for award-c-001`);
  } else {
    console.log(`  [SKIP] Milestones already exist for award-c-001 (${existingMilestones.length} found)`);
  }

  // ─── 6. Ledger for Tender-C winner ───────────────────────────────────────────
  const winnerLedgerExisting = await prisma.ledgerEntry.findFirst({ where: { bidderId: 'bidder-c-winner' } });
  if (!winnerLedgerExisting) {
    const t0w = new Date('2026-07-01T08:00:00Z');

    // verification_run
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'officer',
      actorId: officer1.id,
      action: 'verification_run',
      detail: { tiersRun: ['digilocker', 'portal', 'ai_extraction', 'simulated'], overallRisk: 'low', riskScore: 0.10 },
      createdAt: t0w,
    });

    // fee_paid (tender-c had no fee but log the step)
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'bidder',
      actorId: 'bidder-c-winner',
      action: 'fee_paid',
      detail: { amount: 0, note: 'No application fee for Tender-C' },
      createdAt: new Date(t0w.getTime() + 1 * 60 * 60 * 1000),
    });

    // primary_decision
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'officer',
      actorId: officer1.id,
      action: 'primary_decision',
      detail: { status: 'qualified', tenderId: tenderC.id },
      createdAt: new Date('2026-07-01T10:00:00Z'),
    });

    // secondary_decision
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'officer',
      actorId: officer2.id,
      action: 'secondary_decision',
      detail: { status: 'qualified', tenderId: tenderC.id },
      createdAt: new Date('2026-07-01T14:00:00Z'),
    });

    // award_decision_primary
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'officer',
      actorId: officer1.id,
      action: 'award_decision_primary',
      detail: { awardId: award.id, tenderId: tenderC.id, stage: 'primary_award' },
      createdAt: new Date('2026-07-02T11:00:00Z'),
    });

    // award_decision_secondary
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'officer',
      actorId: officer2.id,
      action: 'award_decision_secondary',
      detail: { awardId: award.id, tenderId: tenderC.id, stage: 'secondary_award_finalized' },
      createdAt: new Date('2026-07-02T15:00:00Z'),
    });

    // delivery_milestone × 4 (4 completed milestones: 3 on_time + 1 late)
    const baseDate = new Date('2026-07-03T00:00:00Z');
    const day = (n: number) => new Date(baseDate.getTime() + n * 24 * 60 * 60 * 1000);
    const deliveryMilestones = await prisma.deliveryMilestone.findMany({ where: { awardId: award.id } });
    for (const dm of deliveryMilestones.filter(m => m.status !== 'missed')) {
      await appendLedger({
        bidderId: 'bidder-c-winner',
        actorType: 'officer',
        actorId: officer1.id,
        action: 'delivery_milestone',
        detail: {
          awardId: award.id,
          milestoneId: dm.id,
          label: dm.label,
          status: dm.status,
          dueDate: dm.dueDate.toISOString(),
          completedAt: dm.completedAt?.toISOString() ?? null,
        },
        createdAt: dm.completedAt ?? day(30),
      });
    }

    // award_closed with full deliverySummary
    await appendLedger({
      bidderId: 'bidder-c-winner',
      actorType: 'admin',
      actorId: adminUser.id,
      action: 'award_closed',
      detail: {
        awardId: award.id,
        tenderId: tenderC.id,
        winningBidderId: 'bidder-c-winner',
        totalMilestones: 6,
        onTimeDeliveries: 4,
        lateDeliveries: 1,
        failedDeliveries: 1,
        remainingPending: 0,
        closedAt: new Date('2026-08-10T12:00:00Z').toISOString(),
        deliverySummary: {
          breakdown: [
            { label: 'PO_issued',        status: 'on_time' },
            { label: 'shipped',          status: 'on_time' },
            { label: 'received',         status: 'on_time' },
            { label: 'inspected',        status: 'on_time' },
            { label: 'accepted',         status: 'late',    daysLate: 3 },
            { label: 'payment_released', status: 'missed',  autoMissedAt: new Date('2026-08-10T12:00:00Z').toISOString() },
          ],
        },
      },
      createdAt: new Date('2026-08-10T12:00:00Z'),
    });

    // badge_awarded for Tender-C winner: first_bid, clean_slate, and 4 domain badges
    const winnerScore = computeTrustScore(4, 1, 1, 0); // 50+20+10-8-15=57
    const winnerBadges = [
      'first_bid',
      'clean_slate',
      'msme_verified',
      'zero_gst_defaults',
      'class_1_local_supplier',
      'clean_anti_cartel',
    ];

    for (let i = 0; i < winnerBadges.length; i++) {
      const badge = winnerBadges[i];
      await appendLedger({
        bidderId: 'bidder-c-winner',
        actorType: 'system',
        actorId: null,
        action: 'badge_awarded',
        detail: {
          badge,
          bidderId: 'bidder-c-winner',
          trustScore: winnerScore,
        },
        createdAt: new Date(new Date('2026-08-10T12:01:00Z').getTime() + i * 1000),
      });
    }

    // Upsert winner BidderProfile
    await prisma.bidderProfile.upsert({
      where: { bidderCompanyId: winnerProfileKey },
      update: {
        displayName: 'WinBridge Systems Ltd',
        totalBidsSubmitted: 1,
        totalBidsWon: 1,
        totalBidsLost: 0,
        onTimeDeliveries: 4,
        lateDeliveries: 1,
        failedDeliveries: 1,
        disqualifications: 0,
        trustScore: winnerScore,
        badges: winnerBadges,
      },
      create: {
        bidderCompanyId: winnerProfileKey,
        displayName: 'WinBridge Systems Ltd',
        totalBidsSubmitted: 1,
        totalBidsWon: 1,
        totalBidsLost: 0,
        onTimeDeliveries: 4,
        lateDeliveries: 1,
        failedDeliveries: 1,
        disqualifications: 0,
        trustScore: winnerScore,
        badges: winnerBadges,
      },
    });

    console.log(`  [LEDGER] 10 entries created for bidder-c-winner (verification→award_closed)`);
    console.log(`  [UPSERT] BidderProfile for bidder-c-winner (trust=${winnerScore})`);
  } else {
    console.log(`  [SKIP] Ledger entries already exist for bidder-c-winner`);
  }

  // ─── 6b. RulesConfig with 9 compliance badge keys ───────────────────────────
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
  console.log(`  [RULES] Seeded default RulesConfig with 9 compliance badge keys`);

  // ─── 7. Summary counts ───────────────────────────────────────────────────────
  console.log('\n=== Seed Verification Counts ===\n');

  const tenderCount = await prisma.tender.count();
  const bidderCount = await prisma.bidder.count();
  const bidderProfileCount = await prisma.bidderProfile.count();
  const ledgerCount = await prisma.ledgerEntry.count();
  const milestoneCount = await prisma.deliveryMilestone.count();
  const awardCount = await prisma.awardDecision.count();
  const userCount = await prisma.user.count();
  const paymentCount = await prisma.applicationFeePayment.count();
  const closedTenderCount = await prisma.tender.count({ where: { status: 'closed' } });
  const biddersByTender = await prisma.bidder.groupBy({ by: ['tenderId'], _count: { id: true } });

  console.log(`  Total users:              ${userCount}`);
  console.log(`  Total tenders:            ${tenderCount} (${closedTenderCount} closed)`);
  biddersByTender.forEach(bt => {
    console.log(`    → Tender ${bt.tenderId}: ${bt._count.id} bidders`);
  });
  console.log(`  Total bidders:            ${bidderCount}`);
  console.log(`  Total bidder profiles:    ${bidderProfileCount}`);
  console.log(`  Total ledger entries:     ${ledgerCount}`);
  console.log(`  Total delivery milestones:${milestoneCount}`);
  console.log(`  Total award decisions:    ${awardCount}`);
  console.log(`  Total fee payments:       ${paymentCount}`);

  console.log('\n=== Phase 9 Seed Complete ===\n');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
