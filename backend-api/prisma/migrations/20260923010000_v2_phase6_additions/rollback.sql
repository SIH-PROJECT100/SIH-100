-- Drop GIN indexes
DROP INDEX IF EXISTS "ledger_entries_detail_trgm_idx";
DROP INDEX IF EXISTS "ledger_entries_detail_gin_idx";

-- Drop quoted_price index
DROP INDEX IF EXISTS "bidders_quoted_price_idx";

-- Drop columns from bidders
ALTER TABLE "bidders" DROP COLUMN IF EXISTS "quoted_price",
DROP COLUMN IF EXISTS "submission_ip";
