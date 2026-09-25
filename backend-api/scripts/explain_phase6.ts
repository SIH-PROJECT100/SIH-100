import pg from 'pg';

async function main() {
  const client = new pg.Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/gem_compliance' });
  await client.connect();

  console.log('=== 1. DEFAULT PLANNER (Without SET enable_seqscan = off) ===');
  const d1 = await client.query("EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail::text ILIKE '%verification%' LIMIT 100;");
  console.log(d1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n=== 2. FORCED INDEX SCAN: TRIGRAM GIN (SET enable_seqscan = off) ===');
  await client.query('SET enable_seqscan = off;');
  const res1 = await client.query("EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail::text ILIKE '%verification%' LIMIT 100;");
  console.log(res1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n=== 3. FORCED INDEX SCAN: JSONB CONTAINMENT GIN (SET enable_seqscan = off) ===');
  const res2 = await client.query("EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail @> '{\"tenderId\": \"tender-001\"}'::jsonb LIMIT 100;");
  console.log(res2.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  await client.end();
}

main().catch(console.error);
