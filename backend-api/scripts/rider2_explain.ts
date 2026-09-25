import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/gem_compliance',
  });
  await client.connect();

  console.log('================================================================');
  console.log('RIDER 2: EXPLAIN ANALYZE WITHOUT enable_seqscan=off OVERRIDE');
  console.log('================================================================\n');

  // Verify enable_seqscan is ON (default)
  const settingRes = await client.query('SHOW enable_seqscan;');
  console.log(`Current enable_seqscan setting: ${settingRes.rows[0].enable_seqscan}\n`);

  const idxRes = await client.query("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ledger_entries';");
  console.log('Indexes on ledger_entries:');
  for (const row of idxRes.rows) {
    console.log(` - ${row.indexname}: ${row.indexdef}`);
  }
  console.log();

  await client.query('VACUUM ANALYZE ledger_entries;');

  console.log('--- 1. TRIGRAM ILIKE QUERY ---');
  console.log("Query: EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail::text ILIKE '%verification%' LIMIT 100;\n");
  const r1 = await client.query(
    "EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail::text ILIKE '%verification%' LIMIT 100;"
  );
  console.log(r1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n--- 2. JSONB CONTAINMENT (@>) QUERY ---');
  console.log("Query: EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail @> '{\"tenderId\": \"tender-001\"}'::jsonb LIMIT 100;\n");
  const r2 = await client.query(
    "EXPLAIN ANALYZE SELECT * FROM ledger_entries WHERE detail @> '{\"tenderId\": \"tender-001\"}'::jsonb LIMIT 100;"
  );
  console.log(r2.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n--- 4. GIN INDEX COST COMPARISON (with enable_seqscan=off) ---');
  await client.query('SET enable_seqscan = off;');
  const g1 = await client.query("EXPLAIN SELECT * FROM ledger_entries WHERE detail::text ILIKE '%verification%' LIMIT 100;");
  console.log('Trigram GIN Plan:\n' + g1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
  const g2 = await client.query("EXPLAIN SELECT * FROM ledger_entries WHERE detail @> '{\"tenderId\": \"tender-001\"}'::jsonb LIMIT 100;");
  console.log('\nJSONB GIN Plan:\n' + g2.rows.map((r: any) => r['QUERY PLAN']).join('\n'));
  await client.query('SET enable_seqscan = on;');

  await client.end();
}

main().catch(console.error);
