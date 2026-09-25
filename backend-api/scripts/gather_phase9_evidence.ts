import { prisma } from '../src/db/client.js';

async function main() {
  console.log('================================================================');
  console.log('PHASE 9 EVIDENCE GATHERING');
  console.log('================================================================\n');

  // 1. Core seed counts for Phase 9
  const tenderA = await prisma.tender.findUnique({ where: { id: 'tender-001' } });
  const tenderB = await prisma.tender.findUnique({ where: { id: 'tender-002' } });
  const tenderC = await prisma.tender.findUnique({ where: { id: 'tender-003' } });

  console.log('--- 1. SEED TENDERS ---');
  console.log(`Tender-A: id=${tenderA?.id}, fee=₹${tenderA?.applicationFee}, status=${tenderA?.status}, title="${tenderA?.title}"`);
  console.log(`Tender-B: id=${tenderB?.id}, fee=₹${tenderB?.applicationFee}, status=${tenderB?.status}, title="${tenderB?.title}"`);
  console.log(`Tender-C: id=${tenderC?.id}, fee=₹${tenderC?.applicationFee}, status=${tenderC?.status}, title="${tenderC?.title}"\n`);

  // 2. Phase 9 Seed Bidders (15 across A & B, plus 1 on C)
  const phase9BidderIds = [
    'bidder-c1', 'bidder-c2', 'bidder-c3',
    'bidder-vet', 'bidder-stale', 'bidder-unpaid',
    'bidder-a4', 'bidder-a5', 'bidder-a6', 'bidder-a7', 'bidder-a8',
    'bidder-b1', 'bidder-b2', 'bidder-b3', 'bidder-b4',
    'bidder-c-winner'
  ];

  const bidders = await prisma.bidder.findMany({
    where: { id: { in: phase9BidderIds } },
    select: {
      id: true,
      tenderId: true,
      companyName: true,
      pan: true,
      overallRisk: true,
      riskScore: true,
      quotedPrice: true,
      approvalState: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log('--- 2. PHASE 9 SEED BIDDERS ---');
  console.log(`Total Phase 9 Bidders: ${bidders.length} (15 across Tenders A & B, 1 on Tender-C)`);
  for (const b of bidders) {
    console.log(`  - [${b.id}] (${b.tenderId}) ${b.companyName} | PAN: ${b.pan} | Risk: ${b.overallRisk} (${b.riskScore}) | State: ${b.approvalState} | Quoted: ₹${b.quotedPrice?.toLocaleString('en-IN')}`);
  }
  console.log();

  // 3. Officers & Admin
  const officers = await prisma.user.findMany({
    where: { id: { in: ['user-officer-001', 'user-officer-002', 'user-admin-001'] } },
    select: { id: true, name: true, email: true, role: true },
  });
  console.log('--- 3. PHASE 9 USERS ---');
  for (const u of officers) {
    console.log(`  - [${u.id}] ${u.name} <${u.email}> (${u.role})`);
  }
  console.log();

  // 4. Cartel Cluster in Ledger
  const cartelEntry = await prisma.ledgerEntry.findFirst({
    where: { action: 'collusion_analysis_run' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('--- 4. CARTEL CLUSTER LEDGER ENTRY ---');
  console.log(`Entry ID: ${cartelEntry?.id}`);
  console.log(`Bidder ID: ${cartelEntry?.bidderId}`);
  console.log(`Actor: ${cartelEntry?.actorType} (${cartelEntry?.actorId})`);
  console.log(`Action: ${cartelEntry?.action}`);
  console.log(`Detail:\n${JSON.stringify(cartelEntry?.detail, null, 2)}\n`);

  // 5. Winning Bidder for Tender-C full ledger sequence
  const winnerLedger = await prisma.ledgerEntry.findMany({
    where: { bidderId: 'bidder-c-winner' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      action: true,
      actorType: true,
      actorId: true,
      detail: true,
      createdAt: true,
    },
  });
  console.log('--- 5. TENDER-C WINNER FULL LEDGER SEQUENCE ---');
  console.log(`Total entries for bidder-c-winner: ${winnerLedger.length}`);
  winnerLedger.forEach((e, idx) => {
    console.log(`  [${idx + 1}] ${e.action} (by ${e.actorType}:${e.actorId ?? 'system'}) at ${e.createdAt.toISOString()}`);
    if (e.action === 'award_closed') {
      console.log(`      DeliverySummary: ${JSON.stringify((e.detail as any)?.deliverySummary, null, 2)}`);
    }
  });
  console.log();

  // 6. Tender-C Milestones
  const awardC = await prisma.awardDecision.findFirst({ where: { tenderId: 'tender-003' } });
  const milestonesC = await prisma.deliveryMilestone.findMany({
    where: { awardId: awardC?.id },
    orderBy: { dueDate: 'asc' },
  });
  console.log('--- 6. TENDER-C MILESTONES ---');
  console.log(`Award ID: ${awardC?.id}`);
  console.log(`Total Milestones: ${milestonesC.length}`);
  milestonesC.forEach((m, idx) => {
    console.log(`  [${idx + 1}] ${m.label} | status: ${m.status} | due: ${m.dueDate.toISOString().slice(0, 10)} | completed: ${m.completedAt?.toISOString().slice(0, 10) ?? 'none'}`);
  });
  console.log();

  // 7. Verified Veteran Profile
  const vetPan = 'AAVTV1111E';
  const crypto = await import('crypto');
  const vetHash = crypto.createHash('sha256').update(vetPan).digest('hex');
  const vetProfile = await prisma.bidderProfile.findUnique({
    where: { bidderCompanyId: vetHash },
  });
  console.log('--- 7. VERIFIED VETERAN PROFILE ---');
  console.log(JSON.stringify(vetProfile, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
