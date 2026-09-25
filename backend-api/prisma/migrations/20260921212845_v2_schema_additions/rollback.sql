-- Rollback migration for 20260921212845_v2_schema_additions

-- Drop Foreign Keys
ALTER TABLE IF EXISTS "delivery_milestones" DROP CONSTRAINT IF EXISTS "delivery_milestones_award_id_fkey";
ALTER TABLE IF EXISTS "application_fee_payments" DROP CONSTRAINT IF EXISTS "application_fee_payments_bidder_id_fkey";
ALTER TABLE IF EXISTS "application_fee_payments" DROP CONSTRAINT IF EXISTS "application_fee_payments_tender_id_fkey";
ALTER TABLE IF EXISTS "award_decisions" DROP CONSTRAINT IF EXISTS "award_decisions_winning_bidder_id_fkey";
ALTER TABLE IF EXISTS "award_decisions" DROP CONSTRAINT IF EXISTS "award_decisions_tender_id_fkey";

-- Drop Indexes
DROP INDEX IF EXISTS "ledger_entries_created_at_idx";
DROP INDEX IF EXISTS "ledger_entries_action_idx";
DROP INDEX IF EXISTS "ledger_entries_bidder_id_idx";
DROP INDEX IF EXISTS "bidders_approval_state_idx";
DROP INDEX IF EXISTS "bidders_tender_id_idx";

-- Drop Tables
DROP TABLE IF EXISTS "delivery_milestones";
DROP TABLE IF EXISTS "bidder_profiles";
DROP TABLE IF EXISTS "application_fee_payments";
DROP TABLE IF EXISTS "award_decisions";

-- Revert columns on tenders
ALTER TABLE IF EXISTS "tenders"
  DROP COLUMN IF EXISTS "application_fee",
  DROP COLUMN IF EXISTS "fee_refund_policy";

-- Revert columns on bidders
ALTER TABLE IF EXISTS "bidders"
  DROP COLUMN IF EXISTS "approval_state",
  DROP COLUMN IF EXISTS "primary_reviewed_at",
  DROP COLUMN IF EXISTS "primary_reviewer_id",
  DROP COLUMN IF EXISTS "secondary_reviewed_at",
  DROP COLUMN IF EXISTS "secondary_reviewer_id";
