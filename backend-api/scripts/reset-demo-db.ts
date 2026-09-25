import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function reset() {
  console.log('--- 1. Connecting to PostgreSQL superuser to wipe public schema ---');
  const directUrl = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/gem_compliance';
  const client = new Client({ connectionString: directUrl });
  await client.connect();

  // Drop and recreate schema public
  await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
  await client.query('CREATE SCHEMA public;');
  await client.query('GRANT ALL ON SCHEMA public TO postgres, backend_app, app_readwrite, ledger_append_only;');
  await client.end();
  console.log('✓ Public schema cleanly wiped.');

  console.log('--- 2. Deploying Prisma migrations ---');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  const grantClient = new Client({ connectionString: directUrl });
  await grantClient.connect();
  await grantClient.query(`
    ALTER TYPE "ActorType" ADD VALUE IF NOT EXISTS 'bidder';
    GRANT ALL ON SCHEMA public TO postgres, backend_app, app_readwrite, ledger_append_only;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_readwrite;
    GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO app_readwrite;
    GRANT app_readwrite TO backend_app;
    GRANT ledger_append_only TO backend_app;
  `);
  await grantClient.end();
  console.log('✓ Granted table permissions and ensured ActorType has bidder.');

  console.log('--- 3. Applying ledger lockdown SQL ---');
  const lockdownSql = fs.readFileSync(path.resolve(__dirname, '../prisma/sql/ledger_lockdown.sql'), 'utf-8');
  const client2 = new Client({ connectionString: directUrl });
  await client2.connect();
  await client2.query(lockdownSql);
  await client2.end();
  console.log('✓ Ledger lockdown triggers and constraints applied.');

  console.log('--- 4. Seeding base data (npm run db:seed) ---');
  execSync('npm run db:seed', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  console.log('--- 5. Seeding Phase 9 demo data (seed_phase9.ts) ---');
  execSync('npx tsx scripts/seed_phase9.ts', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });

  console.log('✓ Demo database cleanly reset and seeded!');
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
