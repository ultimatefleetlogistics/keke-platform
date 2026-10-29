-- Hand-written, the same discipline used for every earlier migration in
-- this project: `prisma migrate dev` could not be run to auto-generate
-- this file, binaries.prisma.sh is unreachable from the environment that
-- authored it, so this SQL was written directly against
-- prisma/schema.prisma and reviewed by hand instead of generated.
--
-- Module 46: automated BVN/NIN verification against Dojah. Purely
-- additive: one new enum, and four new nullable columns on
-- investor_profiles (two per identifier: a status and the name Dojah
-- returned, plus a timestamp each). The existing "bvn"/"nin" text
-- columns are untouched, they still hold exactly what the investor
-- typed, unrelated to whether it has ever been checked. Every existing
-- row gets all four new columns as null, meaning "never checked," a
-- real, distinct state from any of the four enum values, not something
-- this migration invents a default for.

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('VERIFIED', 'NAME_MISMATCH', 'NOT_FOUND', 'FAILED');

-- AlterTable
ALTER TABLE "investor_profiles" ADD COLUMN "bvnVerificationStatus" "VerificationStatus";
ALTER TABLE "investor_profiles" ADD COLUMN "bvnVerifiedName" TEXT;
ALTER TABLE "investor_profiles" ADD COLUMN "bvnVerifiedAt" TIMESTAMP(3);
ALTER TABLE "investor_profiles" ADD COLUMN "ninVerificationStatus" "VerificationStatus";
ALTER TABLE "investor_profiles" ADD COLUMN "ninVerifiedName" TEXT;
ALTER TABLE "investor_profiles" ADD COLUMN "ninVerifiedAt" TIMESTAMP(3);
