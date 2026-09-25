import { prisma } from '../src/db/client.js';
import jwt from 'jsonwebtoken';
import { config } from '../src/config.js';

async function main() {
  const token = jwt.sign({ id: 'user-officer-001', role: 'officer' }, config.JWT_SECRET);
  const t = await prisma.tender.create({
    data: { gemTenderId: `GEM-402-TEST-${Date.now()}`, title: '402 Test Tender', status: 'open', applicationFee: 500 },
  });
  const b = await prisma.bidder.create({
    data: { companyName: 'Unpaid Bidder 402', tenderId: t.id, overallRisk: 'low', checks: [] },
  });

  const res = await fetch(`http://localhost:4000/bidders/${b.id}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  console.log(`HTTP/1.1 ${res.status} Payment Required`);
  for (const [k, v] of res.headers.entries()) {
    console.log(`${k}: ${v}`);
  }
  console.log('');
  console.log(JSON.stringify(await res.json(), null, 2));

  await prisma.bidder.deleteMany({ where: { tenderId: t.id } });
  await prisma.tender.delete({ where: { id: t.id } });
  await prisma.$disconnect();
}

main().catch(console.error);
