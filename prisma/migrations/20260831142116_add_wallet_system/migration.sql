-- Hand-written, the same discipline used for the rename migration
-- (20260829144258_rename_keke_to_vehicle): `prisma migrate dev` could not
-- be run to auto-generate this file, binaries.prisma.sh is unreachable
-- from the environment that authored it, so this SQL was written directly
-- against prisma/schema.prisma and reviewed by hand instead of generated.
-- Every statement here is purely additive: four new enum types, one new
-- column on investor_profiles (walletBalance, defaults to 0 so every
-- existing investor starts with an empty wallet), one new column on
-- payment_batch_items (payoutDestination, defaults to BANK so every
-- existing batch item keeps behaving exactly as it does today), and two
-- new tables (wallet_transactions, wallet_withdrawals). Nothing here
-- renames, drops, or narrows anything, so it carries none of the
-- risk the rename migration had to work around.

-- CreateEnum
CREATE TYPE "PayoutDestination" AS ENUM ('BANK', 'WALLET');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionSource" AS ENUM ('PAYOUT_HELD', 'WITHDRAWAL', 'VEHICLE_FUNDING', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WalletWithdrawalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable: every existing investor starts with a zero wallet balance,
-- the real money they've already been paid stays exactly as recorded in
-- payment_transactions, this column only tracks money moving forward.
ALTER TABLE "investor_profiles" ADD COLUMN "walletBalance" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable: every existing and future batch item defaults to BANK, the
-- payout destination staff have always used, WALLET is opt-in per item.
ALTER TABLE "payment_batch_items" ADD COLUMN "payoutDestination" "PayoutDestination" NOT NULL DEFAULT 'BANK';

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "source" "WalletTransactionSource" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "paymentTransactionId" TEXT,
    "fundedContractId" TEXT,
    "withdrawalId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_withdrawals" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "WalletWithdrawalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "paystackTransferCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_paymentTransactionId_key" ON "wallet_transactions"("paymentTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_fundedContractId_key" ON "wallet_transactions"("fundedContractId");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_withdrawalId_key" ON "wallet_transactions"("withdrawalId");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "payment_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_fundedContractId_fkey" FOREIGN KEY ("fundedContractId") REFERENCES "investment_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "wallet_withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_withdrawals" ADD CONSTRAINT "wallet_withdrawals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
