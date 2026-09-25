import { PrismaClient } from '@prisma/client';
import { detectCollusionForTender } from '../src/services/collusion-detector.js';

const prisma = new PrismaClient();

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function fail(msg: string): never {
  console.error(`${RED}${BOLD}✖ PRE-DEMO ASSERTION FAILED: ${msg}${RESET}`);
  process.exit(1);
}

function pass(msg: string) {
  console.log(`${GREEN}✓ ${msg}${RESET}`);
}

async function verify() {
  console.log(`${BOLD}--- BharatBid Pre-Demo State Verification ---${RESET}\n`);

  // 1. Exactly 3 tenders
  const tenders = await prisma.tender.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { bidders: true } } },
  });

  if (tenders.length !== 3) {
    fail(`Expected exactly 3 tenders in database, found ${tenders.length}`);
  }
  pass(`Exactly 3 tenders present (count = ${tenders.length})`);

  // 2. Expected titles
  const expectedTitles = [
    'Procurement of IT Hardware and Peripherals 2026',
    'Procurement of Office Stationery and Supplies Q4 2026',
    'Procurement of Network Infrastructure Equipment 2025',
  ];

  const actualTitles = tenders.map((t) => t.title);
  for (const expected of expectedTitles) {
    if (!actualTitles.includes(expected)) {
      fail(`Expected tender title "${expected}" not found. Current titles: ${actualTitles.join(', ')}`);
    }
  }
  pass(`Tender titles match exact expected list`);

  // 3. No banned patterns in tender titles
  const bannedTenderSubstrings = ['test', 'walkthrough', 'phase', 'rate limit', '999999'];
  for (const t of tenders) {
    const lower = t.title.toLowerCase();
    for (const banned of bannedTenderSubstrings) {
      if (lower.includes(banned)) {
        fail(`Tender "${t.title}" contains banned substring "${banned}"`);
      }
    }
  }
  pass(`No tender title contains test fixtures or banned substrings`);

  // 4. Bidders count: exactly 15 active bidders + 3 closed bidders (1 winner + 2 qualified losers)
  const activeTenders = tenders.filter((t) => t.status !== 'closed');
  const closedTenders = tenders.filter((t) => t.status === 'closed');

  const activeBidders = await prisma.bidder.findMany({
    where: { tenderId: { in: activeTenders.map((t) => t.id) } },
  });
  const closedBidders = await prisma.bidder.findMany({
    where: { tenderId: { in: closedTenders.map((t) => t.id) } },
  });

  if (activeBidders.length !== 15) {
    fail(`Expected exactly 15 active bidders across open tenders, found ${activeBidders.length}`);
  }
  pass(`Exactly 15 active bidders on open tenders (11 on Tender-A, 4 on Tender-B)`);

  if (closedBidders.length !== 3) {
    fail(`Expected exactly 3 bidders on closed tender (1 winner + 2 qualified losers), found ${closedBidders.length}`);
  }
  pass(`Exactly 3 bidders on closed tender Tender-C (1 winner + 2 qualified losers)`);

  // 5. Users count: exactly 2 officers + 1 admin
  const officers = await prisma.user.findMany({ where: { role: 'officer' } });
  if (officers.length !== 2) {
    fail(`Expected exactly 2 officers, found ${officers.length}`);
  }
  pass(`Exactly 2 officers present (${officers.map((o) => o.name).join(', ')})`);

  const admins = await prisma.user.findMany({ where: { role: 'admin' } });
  if (admins.length !== 1) {
    fail(`Expected exactly 1 admin, found ${admins.length}`);
  }
  pass(`Exactly 1 admin present (${admins.map((a) => a.name).join(', ')})`);

  // 6. No bidder company name contains "test", "demo", "sample"
  const allBidders = [...activeBidders, ...closedBidders];
  const bannedBidderWords = ['test', 'demo', 'sample'];
  for (const b of allBidders) {
    const lower = b.companyName.toLowerCase();
    for (const word of bannedBidderWords) {
      if (lower.includes(word)) {
        fail(`Bidder company name "${b.companyName}" contains banned keyword "${word}"`);
      }
    }
  }
  pass(`All ${allBidders.length} bidder company names clean (no 'test', 'demo', 'sample')`);

  // 7. Cartel cluster present with aggregate score in [0.72, 0.78]
  const tenderA = tenders.find((t) => t.id === 'tender-001') || tenders[0];
  const collusionResult = await detectCollusionForTender(tenderA.id);
  const clusters = collusionResult.clusters || [];

  if (clusters.length === 0) {
    fail(`No cartel cluster detected on Tender-A (${tenderA.id})`);
  }

  const cluster = clusters[0];
  const score = cluster.aggregateScore;
  if (score < 0.72 || score > 0.78) {
    fail(`Cartel cluster score ${score} is not in required range [0.72, 0.78]`);
  }
  pass(`Cartel cluster detected on Tender-A with aggregate score ${score} (in [0.72, 0.78])`);

  console.log(`\n${GREEN}${BOLD}✔ ALL PRE-DEMO INVARIANTS VERIFIED. READY FOR STAGE.${RESET}\n`);
}

verify()
  .catch((err) => {
    console.error(`${RED}${BOLD}Verification crashed: ${err.message}${RESET}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
