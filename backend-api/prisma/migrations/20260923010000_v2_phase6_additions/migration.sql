-- AlterTable
ALTER TABLE "bidders" ADD COLUMN "quoted_price" DECIMAL(65,30),
ADD COLUMN "submission_ip" TEXT;

-- CreateIndex
CREATE INDEX "bidders_quoted_price_idx" ON "bidders"("quoted_price");

-- Create Extension for Trigram substring indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on detail for jsonb containment and path operations
CREATE INDEX IF NOT EXISTS "ledger_entries_detail_gin_idx" ON "ledger_entries" USING GIN ("detail");

-- Create GIN Trigram index on (detail::text) for fast ILIKE and substring queries
CREATE INDEX IF NOT EXISTS "ledger_entries_detail_trgm_idx" ON "ledger_entries" USING GIN (("detail"::text) gin_trgm_ops);
