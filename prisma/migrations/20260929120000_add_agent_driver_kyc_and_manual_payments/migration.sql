-- Hand-written, the same discipline used for every earlier migration in
-- this project: `prisma migrate dev` could not be run to auto-generate
-- this file, binaries.prisma.sh is unreachable from the environment that
-- authored it, so this SQL was written directly against
-- prisma/schema.prisma and reviewed by hand instead of generated.
--
-- Module 59: two purely additive changes for the staff-facing agent/driver
-- admin tooling built this round (see CURRENT_STATE.md's own Module 59
-- entry for the full writeup).
--
-- 1. Agents and drivers get their own KycStatus, same enum InvestorProfile
--    already uses, defaulting NOT_STARTED so every existing row is
--    unaffected until staff actually start entering documents for them.
--    A new agent_driver_documents table mirrors kyc_documents (same two
--    document types, same review status enum) but is keyed by an optional
--    agentId OR driverId rather than a required investorId, since exactly
--    one of the two must be set for any given row, never both, never
--    neither, enforced with a CHECK constraint since Prisma's own schema
--    language has no way to express that XOR at the database level.
--    reviewedById is a plain TEXT column, not a foreign key, matching
--    kyc_documents.reviewedById's own precedent (see lib/data/kyc.ts's
--    doc comment on getInvestorKycDetail): adding a real @relation would
--    need its own migration for the constraint, a plain column looked up
--    as a second query avoids that for a field this narrow.
--
-- 2. payment_transactions gets two new nullable columns, "note" and
--    "recordedById", used for the first time by the new manual/cash
--    payment recording and reversal tooling: "note" holds the staff-typed
--    reason a MANUAL_ADJUSTMENT row exists (or, for a reversed row, why it
--    was reversed), "recordedById" holds which staff member (a
--    StaffProfile id, same "plain TEXT, not a real relation" reasoning as
--    reviewedById above) manually created the row. Both stay null for
--    every existing row and for every future webhook-sourced transaction,
--    which never sets either.

-- AlterTable
ALTER TABLE "agents" ADD COLUMN "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED';
ALTER TABLE "drivers" ADD COLUMN "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "agent_driver_documents" (
    "id" TEXT NOT NULL,
    "agentId" TEXT,
    "driverId" TEXT,
    "type" "KycDocumentType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "KycDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_driver_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "agent_driver_documents_subject_check" CHECK (
        ("agentId" IS NOT NULL AND "driverId" IS NULL) OR
        ("agentId" IS NULL AND "driverId" IS NOT NULL)
    )
);

-- AddForeignKey
ALTER TABLE "agent_driver_documents" ADD CONSTRAINT "agent_driver_documents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_driver_documents" ADD CONSTRAINT "agent_driver_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "payment_transactions" ADD COLUMN "note" TEXT;
ALTER TABLE "payment_transactions" ADD COLUMN "recordedById" TEXT;
