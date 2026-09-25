import jwt from 'jsonwebtoken';
import { prisma } from '../src/db/client.js';
import { config } from '../src/config.js';

const token = jwt.sign({ id: 'user-officer-001', role: 'officer' }, config.JWT_SECRET);
const DAY_MS = 24 * 60 * 60 * 1000;

async function testGates() {
  const tenderId = 'tender-001';

  // 1. Zod validation failure (<80 chars)
  const r1 = await fetch(`http://localhost:4000/tenders/${tenderId}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      winningBidderId: 'bidder-001',
      justification: 'Too short.',
      standoutFactors: [{ factor: 'Cost', note: 'Low' }],
    }),
  });
  console.log(`--- 1. ZOD VALIDATION FAILURE (<80 chars) [HTTP ${r1.status}] ---`);
  console.log(JSON.stringify(await r1.json(), null, 2));

  // 2. Winner not qualified
  const r2 = await fetch(`http://localhost:4000/tenders/${tenderId}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      winningBidderId: 'bidder-003',
      justification: 'A'.repeat(80),
      standoutFactors: [{ factor: 'Cost', note: 'Low' }],
    }),
  });
  console.log(`\n--- 2. WINNER NOT QUALIFIED [HTTP ${r2.status}] ---`);
  console.log(JSON.stringify(await r2.json(), null, 2));

  // 3. Stale verification and 4. Unpaid fee
  const t = await prisma.tender.create({
    data: {
      gemTenderId: `GEM-GATE-TEST-${Date.now()}`,
      title: 'Gate Error Verification Tender',
      status: 'open',
      applicationFee: 200,
    },
  });

  const bStale = await prisma.bidder.create({
    data: {
      companyName: 'Stale Gate Bidder',
      tenderId: t.id,
      overallRisk: 'low',
      officerDecision: { status: 'qualified', reason: 'Passed initial' },
      checks: [
        {
          category: 'gst',
          status: 'verified',
          verifiedAt: new Date(Date.now() - 400 * DAY_MS).toISOString(),
          verificationExpiresAt: new Date(Date.now() - 35 * DAY_MS).toISOString(),
        },
      ],
    },
  });

  const bUnpaid = await prisma.bidder.create({
    data: {
      companyName: 'Unpaid Gate Bidder',
      tenderId: t.id,
      overallRisk: 'low',
      officerDecision: { status: 'qualified', reason: 'Passed initial' },
      checks: [
        {
          category: 'gst',
          status: 'verified',
          verifiedAt: new Date().toISOString(),
          verificationExpiresAt: new Date(Date.now() + 300 * DAY_MS).toISOString(),
        },
      ],
    },
  });

  // 3. Stale verification
  const r3 = await fetch(`http://localhost:4000/tenders/${t.id}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      winningBidderId: bStale.id,
      justification: 'A'.repeat(80),
      standoutFactors: [{ factor: 'Cost', note: 'Low' }],
    }),
  });
  console.log(`\n--- 3. WINNER VERIFICATION STALE / EXPIRED [HTTP ${r3.status}] ---`);
  console.log(JSON.stringify(await r3.json(), null, 2));

  // 4. Winner fee unpaid
  const r4 = await fetch(`http://localhost:4000/tenders/${t.id}/award`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      winningBidderId: bUnpaid.id,
      justification: 'A'.repeat(80),
      standoutFactors: [{ factor: 'Cost', note: 'Low' }],
    }),
  });
  console.log(`\n--- 4. WINNER APPLICATION FEE UNPAID [HTTP ${r4.status}] ---`);
  console.log(JSON.stringify(await r4.json(), null, 2));

  // Clean up
  await prisma.bidder.deleteMany({ where: { tenderId: t.id } });
  await prisma.tender.delete({ where: { id: t.id } });
  await prisma.$disconnect();
}

testGates().catch(console.error);
