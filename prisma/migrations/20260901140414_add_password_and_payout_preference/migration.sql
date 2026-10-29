-- AlterTable
ALTER TABLE "investor_profiles" ADD COLUMN     "defaultPayoutDestination" "PayoutDestination" NOT NULL DEFAULT 'BANK';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
