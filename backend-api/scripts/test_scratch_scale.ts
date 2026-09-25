import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/gem_compliance',
  });
  await client.connect();

  console.log('Testing GIN index selection on scratch table at scale...');

  // Create scratch table with identical schema & indexes
  await client.query(`
    DROP TABLE IF EXISTS scratch_ledger_entries;
    CREATE TABLE scratch_ledger_entries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bidder_id TEXT NOT NULL,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      detail JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    CREATE INDEX scratch_detail_gin_idx ON scratch_ledger_entries USING gin (detail);
    CREATE INDEX scratch_detail_trgm_idx ON scratch_ledger_entries USING gin (((detail)::text) gin_trgm_ops);
  `);

  console.log('Inserting 25,000 synthetic rows...');
  // Insert 25,000 rows with diverse detail payloads
  await client.query(`
    INSERT INTO scratch_ledger_entries (bidder_id, actor_type, action, detail, created_at)
    SELECT
      'bidder-' || (i % 500),
      CASE WHEN i % 3 = 0 THEN 'officer' WHEN i % 3 = 1 THEN 'bidder' ELSE 'system' END,
      CASE WHEN i % 4 = 0 THEN 'verification_run' WHEN i % 4 = 1 THEN 'fee_paid' WHEN i % 4 = 2 THEN 'primary_decision' ELSE 'delivery_milestone' END,
      jsonb_build_object(
        'tenderId', 'tender-' || (i % 200),
        'score', (i % 100) / 100.0,
        'tag', CASE WHEN i = 12345 THEN 'special_needle_verification' ELSE 'standard_payload_' || i END,
        'notes', 'Synthetic audit record sequence ' || i
      ),
      NOW() - (i || ' minutes')::interval
    FROM generate_series(1, 25000) AS i;
  `);

  await client.query('VACUUM ANALYZE scratch_ledger_entries;');

  console.log('\n=== EXPLAIN ANALYZE AT 25,000 ROWS (enable_seqscan = ON) ===\n');

  console.log('--- 1. TRIGRAM ILIKE QUERY ---');
  const q1 = await client.query(
    "EXPLAIN ANALYZE SELECT * FROM scratch_ledger_entries WHERE (detail)::text ILIKE '%special_needle_verification%' LIMIT 100;"
  );
  console.log(q1.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  console.log('\n--- 2. JSONB CONTAINMENT (@>) QUERY ---');
  const q2 = await client.query(
    "EXPLAIN ANALYZE SELECT * FROM scratch_ledger_entries WHERE detail @> '{\"tenderId\": \"tender-42\"}'::jsonb LIMIT 100;"
  );
  console.log(q2.rows.map((r: any) => r['QUERY PLAN']).join('\n'));

  // Clean up
  await client.query('DROP TABLE IF EXISTS scratch_ledger_entries;');
  await client.end();
}

main().catch(console.error);
