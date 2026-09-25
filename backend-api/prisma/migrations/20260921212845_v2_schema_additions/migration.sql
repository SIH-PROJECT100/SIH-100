-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerActionType" ADD VALUE 'award_decision_primary';
ALTER TYPE "LedgerActionType" ADD VALUE 'award_decision_secondary';
ALTER TYPE "LedgerActionType" ADD VALUE 'verification_expiry_notice';
ALTER TYPE "LedgerActionType" ADD VALUE 'fee_transition';
ALTER TYPE "LedgerActionType" ADD VALUE 'fee_paid';
ALTER TYPE "LedgerActionType" ADD VALUE 'primary_decision';
ALTER TYPE "LedgerActionType" ADD VALUE 'secondary_decision';
ALTER TYPE "LedgerActionType" ADD VALUE 'badge_awarded';
ALTER TYPE "LedgerActionType" ADD VALUE 'collusion_analysis_run';
ALTER TYPE "LedgerActionType" ADD VALUE 'delivery_milestone';
ALTER TYPE "LedgerActionType" ADD VALUE 'award_closed';

-- AlterEnum
ALTER TYPE "TenderStatus" ADD VALUE 'evaluation_awarded_pending_2nd';

-- AlterTable
ALTER TABLE "bidders" ADD COLUMN     "approval_state" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "primary_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "primary_reviewer_id" TEXT,
ADD COLUMN     "secondary_reviewed_at" TIMESTAMP(3),
ADD COLUMN     "secondary_reviewer_id" TEXT;

-- AlterTable
ALTER TABLE "tenders" ADD COLUMN     "application_fee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "fee_refund_policy" TEXT NOT NULL DEFAULT 'refund_on_disqualification_only';

-- CreateTable
CREATE TABLE "award_decisions" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "winning_bidder_id" TEXT NOT NULL,
    "primary_officer_id" TEXT NOT NULL,
    "secondary_officer_id" TEXT,
    "justification" TEXT NOT NULL,
    "standout_factors" JSONB NOT NULL DEFAULT '[]',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalized_at" TIMESTAMP(3),

    CONSTRAINT "award_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_fee_payments" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gateway_ref" TEXT,
    "paid_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_fee_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidder_profiles" (
    "bidder_company_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "total_bids_submitted" INTEGER NOT NULL DEFAULT 0,
    "total_bids_won" INTEGER NOT NULL DEFAULT 0,
    "total_bids_lost" INTEGER NOT NULL DEFAULT 0,
    "on_time_deliveries" INTEGER NOT NULL DEFAULT 0,
    "late_deliveries" INTEGER NOT NULL DEFAULT 0,
    "failed_deliveries" INTEGER NOT NULL DEFAULT 0,
    "disqualifications" INTEGER NOT NULL DEFAULT 0,
    "trust_score" INTEGER NOT NULL DEFAULT 50,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidder_profiles_pkey" PRIMARY KEY ("bidder_company_id")
);

-- CreateTable
CREATE TABLE "delivery_milestones" (
    "id" TEXT NOT NULL,
    "award_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "proof_docs" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "award_decisions_tender_id_idx" ON "award_decisions"("tender_id");

-- CreateIndex
CREATE INDEX "award_decisions_winning_bidder_id_idx" ON "award_decisions"("winning_bidder_id");

-- CreateIndex
CREATE INDEX "award_decisions_primary_officer_id_idx" ON "award_decisions"("primary_officer_id");

-- CreateIndex
CREATE INDEX "award_decisions_secondary_officer_id_idx" ON "award_decisions"("secondary_officer_id");

-- CreateIndex
CREATE INDEX "application_fee_payments_tender_id_idx" ON "application_fee_payments"("tender_id");

-- CreateIndex
CREATE INDEX "application_fee_payments_bidder_id_idx" ON "application_fee_payments"("bidder_id");

-- CreateIndex
CREATE INDEX "application_fee_payments_status_idx" ON "application_fee_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "application_fee_payments_tender_id_bidder_id_key" ON "application_fee_payments"("tender_id", "bidder_id");

-- CreateIndex
CREATE INDEX "bidder_profiles_trust_score_idx" ON "bidder_profiles"("trust_score");

-- CreateIndex
CREATE INDEX "delivery_milestones_award_id_idx" ON "delivery_milestones"("award_id");

-- CreateIndex
CREATE INDEX "delivery_milestones_status_idx" ON "delivery_milestones"("status");

-- CreateIndex
CREATE INDEX "bidders_tender_id_idx" ON "bidders"("tender_id");

-- CreateIndex
CREATE INDEX "bidders_approval_state_idx" ON "bidders"("approval_state");

-- CreateIndex
CREATE INDEX "ledger_entries_bidder_id_idx" ON "ledger_entries"("bidder_id");

-- CreateIndex
CREATE INDEX "ledger_entries_action_idx" ON "ledger_entries"("action");

-- CreateIndex
CREATE INDEX "ledger_entries_created_at_idx" ON "ledger_entries"("created_at");

-- AddForeignKey
ALTER TABLE "award_decisions" ADD CONSTRAINT "award_decisions_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "award_decisions" ADD CONSTRAINT "award_decisions_winning_bidder_id_fkey" FOREIGN KEY ("winning_bidder_id") REFERENCES "bidders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_fee_payments" ADD CONSTRAINT "application_fee_payments_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_fee_payments" ADD CONSTRAINT "application_fee_payments_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "bidders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_milestones" ADD CONSTRAINT "delivery_milestones_award_id_fkey" FOREIGN KEY ("award_id") REFERENCES "award_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
