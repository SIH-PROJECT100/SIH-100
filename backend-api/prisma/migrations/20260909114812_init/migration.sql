-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('officer', 'admin', 'bidder');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "TenderStatus" AS ENUM ('draft', 'open', 'evaluation', 'awarded', 'closed');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('system', 'officer', 'admin');

-- CreateEnum
CREATE TYPE "LedgerActionType" AS ENUM ('verification_run', 'officer_decision', 'pii_reveal', 'config_change', 'admin_action');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenders" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "gem_tender_id" TEXT NOT NULL,
    "status" "TenderStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bidders" (
    "id" TEXT NOT NULL,
    "tender_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "udyam_number" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "overall_risk" "RiskLevel" NOT NULL,
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checks" JSONB NOT NULL DEFAULT '[]',
    "officer_decision" JSONB,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bidders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "bidder_id" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" TEXT,
    "action" "LedgerActionType" NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules_configs" (
    "id" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "rules_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tenders_gem_tender_id_key" ON "tenders"("gem_tender_id");

-- AddForeignKey
ALTER TABLE "bidders" ADD CONSTRAINT "bidders_tender_id_fkey" FOREIGN KEY ("tender_id") REFERENCES "tenders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_bidder_id_fkey" FOREIGN KEY ("bidder_id") REFERENCES "bidders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
