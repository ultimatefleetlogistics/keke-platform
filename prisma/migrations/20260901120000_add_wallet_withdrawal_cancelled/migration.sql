-- Hand-written, the same discipline used for the two earlier migrations in
-- this project (20260829144258_rename_keke_to_vehicle,
-- 20260831142116_add_wallet_system): `prisma migrate dev` could not be run
-- to auto-generate this file, binaries.prisma.sh is unreachable from the
-- environment that authored it, so this SQL was written directly against
-- prisma/schema.prisma and reviewed by hand instead of generated.

-- AlterEnum: adds one new value to an existing enum, nothing else changes.
-- CANCELLED is the status an investor sets on their own pending withdrawal
-- request (see cancelWalletWithdrawal in lib/actions/wallet.ts, Module 23),
-- distinct from REJECTED, which is always a staff decision. Postgres
-- requires ALTER TYPE ... ADD VALUE to run outside a transaction block,
-- Prisma's migrate deploy/dev already handles this correctly on its own,
-- nothing extra is needed here.
ALTER TYPE "WalletWithdrawalStatus" ADD VALUE 'CANCELLED';
