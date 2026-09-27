-- AlterEnum
ALTER TYPE "ActorType" ADD VALUE 'bidder';

-- AlterEnum
ALTER TYPE "LedgerActionType" ADD VALUE 'document_uploaded';
ALTER TYPE "LedgerActionType" ADD VALUE 'document_upload_rejected';
ALTER TYPE "LedgerActionType" ADD VALUE 'ai_extraction_run';
ALTER TYPE "LedgerActionType" ADD VALUE 'cross_check_run';
ALTER TYPE "LedgerActionType" ADD VALUE 'signature_verification_run';
ALTER TYPE "LedgerActionType" ADD VALUE 'document_deleted';
