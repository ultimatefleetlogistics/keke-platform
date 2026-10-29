-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('NOT_STARTED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KycDocumentType" AS ENUM ('GOVERNMENT_ID', 'PROOF_OF_ADDRESS');

-- CreateEnum
CREATE TYPE "KycDocumentStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KekeStatus" AS ENUM ('PENDING_ONBOARDING', 'ACTIVE', 'MAINTENANCE', 'UNASSIGNED', 'RETIRED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'TARGET_ACHIEVED', 'TRANSFER_IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ScheduleEntryStatus" AS ENUM ('UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'DEFERRED');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "PaymentSource" AS ENUM ('INVESTOR_FUNDING', 'AGENT_REMITTANCE', 'INVESTOR_PAYOUT', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('RECORDED', 'ALLOCATED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ProviderTransactionStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'UNMATCHED');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BatchItemTransferStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OwnershipTransferTarget" AS ENUM ('MANAGER', 'NEW_INVESTOR');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('TARGET_ACHIEVED', 'VERIFICATION_PENDING', 'VERIFIED', 'APPROVAL_PENDING', 'APPROVED', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('CONTRACT', 'MAINTENANCE_RECEIPT', 'ASSET_PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVisibility" AS ENUM ('PRIVATE_OWNER', 'STAFF_ONLY');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "authId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "fullName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investor_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bvn" TEXT,
    "nin" TEXT,
    "bankAccountNumber" TEXT,
    "bankCode" TEXT,
    "bankAccountName" TEXT,
    "paystackRecipientCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "type" "KycDocumentType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "status" "KycDocumentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobTitle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "region" TEXT,
    "paystackCustomerCode" TEXT,
    "paystackDvaAccountNumber" TEXT,
    "paystackDvaBankName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "agentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "paystackCustomerCode" TEXT,
    "paystackDvaAccountNumber" TEXT,
    "paystackDvaBankName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_assignments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "kekeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "driver_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kekes" (
    "id" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "frameNumber" TEXT,
    "plateNumber" TEXT,
    "status" "KekeStatus" NOT NULL DEFAULT 'PENDING_ONBOARDING',
    "location" TEXT,
    "agentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentDriverId" TEXT,

    CONSTRAINT "kekes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "kekeId" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "description" TEXT NOT NULL,
    "cost" DECIMAL(14,2),
    "performedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investment_contracts" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "kekeId" TEXT NOT NULL,
    "principalAmount" DECIMAL(14,2) NOT NULL,
    "targetPayoutAmount" DECIMAL(14,2) NOT NULL,
    "installmentAmount" DECIMAL(14,2) NOT NULL,
    "paymentFrequency" "PaymentFrequency" NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "totalPaidToInvestor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "investment_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_schedule_entries" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "expectedAmount" DECIMAL(14,2) NOT NULL,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ScheduleEntryStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_schedule_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_transactions" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'paystack',
    "providerRef" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "status" "ProviderTransactionStatus" NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "provider_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "direction" "PaymentDirection" NOT NULL,
    "source" "PaymentSource" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'RECORDED',
    "providerTransactionId" TEXT,
    "agentId" TEXT,
    "driverId" TEXT,
    "investorId" TEXT,
    "batchItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentTransactionId" TEXT NOT NULL,
    "scheduleEntryId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batches" (
    "id" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batch_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "transferStatus" "BatchItemTransferStatus" NOT NULL DEFAULT 'PENDING',
    "paystackTransferCode" TEXT,
    "failureReason" TEXT,

    CONSTRAINT "payment_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_batch_approvals" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "approvedById" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_batch_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_transfers" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kekeId" TEXT NOT NULL,
    "target" "OwnershipTransferTarget" NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'TARGET_ACHIEVED',
    "fromInvestorId" TEXT NOT NULL,
    "toInvestorId" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "kekeId" TEXT,
    "contractId" TEXT,
    "type" "DocumentType" NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "visibility" "DocumentVisibility" NOT NULL DEFAULT 'STAFF_ONLY',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_authId_key" ON "users"("authId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_userId_roleId_key" ON "role_assignments"("userId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "investor_profiles_userId_key" ON "investor_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_profiles_userId_key" ON "staff_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_userId_key" ON "agents"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_paystackCustomerCode_key" ON "agents"("paystackCustomerCode");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_userId_key" ON "drivers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_paystackCustomerCode_key" ON "drivers"("paystackCustomerCode");

-- CreateIndex
CREATE UNIQUE INDEX "kekes_assetTag_key" ON "kekes"("assetTag");

-- CreateIndex
CREATE UNIQUE INDEX "kekes_frameNumber_key" ON "kekes"("frameNumber");

-- CreateIndex
CREATE UNIQUE INDEX "kekes_plateNumber_key" ON "kekes"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "kekes_currentDriverId_key" ON "kekes"("currentDriverId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_transactions_providerRef_key" ON "provider_transactions"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_providerTransactionId_key" ON "payment_transactions"("providerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_batchItemId_key" ON "payment_transactions"("batchItemId");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investor_profiles" ADD CONSTRAINT "investor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_assignments" ADD CONSTRAINT "driver_assignments_kekeId_fkey" FOREIGN KEY ("kekeId") REFERENCES "kekes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kekes" ADD CONSTRAINT "kekes_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kekes" ADD CONSTRAINT "kekes_currentDriverId_fkey" FOREIGN KEY ("currentDriverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_kekeId_fkey" FOREIGN KEY ("kekeId") REFERENCES "kekes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_contracts" ADD CONSTRAINT "investment_contracts_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investment_contracts" ADD CONSTRAINT "investment_contracts_kekeId_fkey" FOREIGN KEY ("kekeId") REFERENCES "kekes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_schedule_entries" ADD CONSTRAINT "payment_schedule_entries_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "investment_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_providerTransactionId_fkey" FOREIGN KEY ("providerTransactionId") REFERENCES "provider_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_batchItemId_fkey" FOREIGN KEY ("batchItemId") REFERENCES "payment_batch_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentTransactionId_fkey" FOREIGN KEY ("paymentTransactionId") REFERENCES "payment_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_scheduleEntryId_fkey" FOREIGN KEY ("scheduleEntryId") REFERENCES "payment_schedule_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batches" ADD CONSTRAINT "payment_batches_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "investment_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_items" ADD CONSTRAINT "payment_batch_items_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "investor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_approvals" ADD CONSTRAINT "payment_batch_approvals_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_batch_approvals" ADD CONSTRAINT "payment_batch_approvals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "investment_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_kekeId_fkey" FOREIGN KEY ("kekeId") REFERENCES "kekes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_fromInvestorId_fkey" FOREIGN KEY ("fromInvestorId") REFERENCES "investor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_toInvestorId_fkey" FOREIGN KEY ("toInvestorId") REFERENCES "investor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_transfers" ADD CONSTRAINT "ownership_transfers_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "staff_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_kekeId_fkey" FOREIGN KEY ("kekeId") REFERENCES "kekes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "investment_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
