#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL to be ready..."
until pg_isready -h postgres -p 5432 -U postgres; do
  sleep 1
done
echo "✅ PostgreSQL is ready."

echo "🚀 Deploying Prisma migrations..."
npx prisma migrate deploy

echo "🔒 Applying Ledger trigger lockdown and constraints..."
psql "$DIRECT_URL" -f prisma/sql/ledger_lockdown.sql

echo "🌱 Seeding initial demo data..."
node -e "import('./dist/db/seed.js').catch(e => { console.log('Seed note:', e.message); })" || true

echo "✨ Starting API Server on port 4000..."
exec node dist/index.js
