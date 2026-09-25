import { detectCollusionForTender } from '../src/services/collusion-detector.js';
import { prisma } from '../src/db/client.js';

async function main() {
  console.log('Testing fresh detectCollusionForTender on tender-001...');

  // Inspect the PAN dates on the three cartel bidders
  const cartelBidders = await prisma.bidder.findMany({
    where: { id: { in: ['bidder-c1', 'bidder-c2', 'bidder-c3'] } },
    select: { id: true, companyName: true, checks: true },
  });

  console.log('\n--- Cartel Bidders PAN Issuance Dates ---');
  for (const b of cartelBidders) {
    const checks = b.checks as any[];
    const panCheck = checks?.find((c: any) => c.name === 'pan_itr');
    console.log(`  ${b.id} (${b.companyName}): panIssuanceDate = ${panCheck?.detail?.panIssuanceDate}`);
  }

  // Run detectCollusion with forceFresh: true
  const result = await detectCollusionForTender('tender-001', {
    forceFresh: true,
    actorType: 'officer',
    actorId: 'user-officer-001',
  });

  console.log('\n--- Detect Collusion Result ---');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
