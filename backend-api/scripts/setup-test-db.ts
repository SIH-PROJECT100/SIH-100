import { Client } from 'pg';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupTestDb() {
  const directUrl = process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/gem_compliance';
  const client = new Client({ connectionString: directUrl });
  await client.connect();
  await client.query('CREATE SCHEMA IF NOT EXISTS test;');
  await client.query('GRANT ALL ON SCHEMA test TO postgres, backend_app, app_readwrite, ledger_append_only;');
  await client.end();
  console.log('✓ test schema ready');

  // Push schema to test
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=test';
  execSync('npx prisma db push --skip-generate', {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/gem_compliance?schema=test' }
  });
  console.log('✓ test schema synced');
}

setupTestDb().catch(console.error);
