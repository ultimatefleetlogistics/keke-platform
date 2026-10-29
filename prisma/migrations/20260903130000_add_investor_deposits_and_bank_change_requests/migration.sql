-- Hand-written, the same discipline used for every earlier migration in
-- this project: `prisma migrate dev` could not be run to auto-generate
-- this file, binaries.prisma.sh is unreachable from the environment that
-- authored it, so this SQL was written directly against
-- prisma/schema.prisma and reviewed by hand instead of generated.
--
-- Module 41: self-service investor deposits (a Paystack Dedicated Virtual
-- Account per investor, same tech agents/drivers already have) and a
-- maker-checker request flow for investor-initiated bank account changes.
-- Everything here is purely additive: one new value on the existing
-- WalletTransactionSource enum, two brand new enums, three new nullable/
-- defaulted columns on investor_profiles, two new nullable columns on
-- wallet_transactions, and one new table
-- (investor_bank_change_requests). Nothing here renames, drops, or
-- narrows anything, every existing row keeps behaving exactly as it does
-- today.

-- AlterEnum: adds one new value to an existing enum, nothing else changes.
-- Postgres requires ALTER TYPE ... ADD VALUE to run outside a transaction
-- block, Prisma's migrate deploy/dev already handles this correctly on
-- its own, nothing extra is needed here, same as the CANCELLED addition
-- to WalletWithdrawalStatus in 20260901120000_add_wallet_withdrawal_cancelled.
ALTER TYPE "WalletTransactionSource" ADD VALUE 'DEPOSIT';

-- CreateEnum
CREATE TYPE "DepositIntent" AS ENUM ('WALLET_TOPUP', 'VEHICLE_PURCHASE');

-- CreateEnum
CREATE TYPE "BankChangeRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterTable: every existing investor has no Dedicated Virtual Account yet
-- (paystackCustomerCode/paystackDvaAccountNumber/paystackDvaBankName all
-- start null, same as Agent/Driver's equivalent columns did when those
-- were added, provisioned lazily the same way), and every existing
-- investor defaults to WALLET_TOPUP, the safe, no-behavior-change default
-- for a deposit intent that didn't exist before this migration.
ALTER TABLE "investor_profiles" ADD COLUMN "paystackCustomerCode" TEXT;
ALTER TABLE "investor_profiles" ADD COLUMN "paystackDvaAccountNumber" TEXT;
ALTER TABLE "investor_profiles" ADD COLUMN "paystackDvaBankName" TEXT;
ALTER TABLE "investor_profiles" ADD COLUMN "depositIntent" "DepositIntent" NOT NULL DEFAULT 'WALLET_TOPUP';
ALTER TABLE "investor_profiles" ADD COLUMN "depositIntentVehicleType" "VehicleType";

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_paystackCustomerCode_key" ON "investor_profiles"("paystackCustomerCode");

-- AlterTable: nullable, only ever set on a wallet_transactions row whose
-- source is DEPOSIT, every existing row keeps both columns null.
ALTER TABLE "wallet_transactions" ADD COLUMN "depositIntent" "DepositIntent";
ALTER TABLE "wallet_transactions" ADD COLUMN "depositIntentVehicleType" "VehicleType";

-- CreateTable
CREATE TABLE "investor_bank_change_requests" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "status" "BankChangeRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investor_bank_change_requests_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "investor_bank_change_requests" ADD CONSTRAINT "investor_bank_change_requests_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_bank_change_requests" ADD CONSTRAINT "investor_bank_change_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
