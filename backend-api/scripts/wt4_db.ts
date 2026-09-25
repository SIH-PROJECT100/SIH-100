import { prisma } from '../src/db/client.js';
import { adminPrisma, deleteLedgerEntriesAdmin } from '../tests/helpers/adminDb.js';

const TENDER_ID = 'tender-wt4';
const BIDDER_ID = 'bidder-wt4';


async function main() {
  const cmd = process.argv[2];

  if (cmd === 'setup') {
    // Teardown first if exists
    await deleteLedgerEntriesAdmin({ bidderId: BIDDER_ID });
    await prisma.awardDecision.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.applicationFeePayment.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.bidder.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.tender.deleteMany({ where: { id: TENDER_ID } });

    // Create tender with fee
    await prisma.tender.create({
      data: {
        id: TENDER_ID,
        gemTenderId: 'GEM-WT4-2026',
        title: 'Walkthrough Phase 4: Medical Equipment Procurement',
        status: 'open',
        applicationFee: 250,
      },
    });

    // Create bidder
    await prisma.bidder.create({
      data: {
        id: BIDDER_ID,
        tenderId: TENDER_ID,
        companyName: 'Apex Health Systems Pvt Ltd',
        pan: 'ABCDE1234F',
        gstin: '29ABCDE1234F1Z5',
        overallRisk: 'low',
        riskScore: 0.1,
        checks: [],
      },
    });

    console.log('SETUP_COMPLETE');
  } else if (cmd === 'age') {
    // Age bidder's checks past 365 days (past 30-day grace)
    const DAY_MS = 24 * 60 * 60 * 1000;
    await prisma.bidder.update({
      where: { id: BIDDER_ID },
      data: {
        checks: [
          {
            category: 'gst',
            status: 'verified',
            verifiedAt: new Date(Date.now() - 400 * DAY_MS).toISOString(),
            verificationExpiresAt: new Date(Date.now() - 35 * DAY_MS).toISOString(),
          },
        ],
        // Also qualify the bidder so Gate 1 passes and Gate 2 is the blocker!
        officerDecision: { status: 'qualified', reason: 'Pre-qualified for stale test' },
      },
    });
    console.log('AGE_COMPLETE');
  } else if (cmd === 'teardown') {
    await deleteLedgerEntriesAdmin({ bidderId: BIDDER_ID });
    await prisma.awardDecision.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.applicationFeePayment.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.bidder.deleteMany({ where: { tenderId: TENDER_ID } });
    await prisma.tender.deleteMany({ where: { id: TENDER_ID } });
    console.log('TEARDOWN_COMPLETE');
  }

  await prisma.$disconnect();
  await adminPrisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
