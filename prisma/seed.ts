import { PrismaClient } from "@prisma/client";
import { DEFAULT_ROLE_SEED, PERMISSIONS, type PermissionKey } from "../lib/rbac/permissions";

/**
 * Populates the database-driven RBAC tables (Role, Permission,
 * RolePermission) from the fixed permission catalog and the default role
 * mapping in lib/rbac/permissions.ts. Safe to run more than once,
 * everything is an upsert. Run with: npx prisma db seed (or npm run
 * db:seed).
 */

const prisma = new PrismaClient();

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  [PERMISSIONS.INVESTORS_VIEW]: "View investor profiles and their contracts",
  [PERMISSIONS.INVESTORS_MANAGE]: "Create and edit investor profiles",
  [PERMISSIONS.KYC_REVIEW]: "Review and approve or reject KYC documents",
  [PERMISSIONS.FLEET_VIEW]: "View the vehicle fleet",
  [PERMISSIONS.FLEET_MANAGE]: "Add, edit, and reassign vehicles",
  [PERMISSIONS.CONTRACTS_VIEW]: "View investment contracts",
  [PERMISSIONS.CONTRACTS_CREATE]: "Create new investment contracts",
  [PERMISSIONS.CONTRACTS_MANAGE]: "Edit existing investment contracts",
  [PERMISSIONS.PAYMENTS_VIEW]: "View payment transactions and schedules",
  [PERMISSIONS.PAYMENT_BATCH_CREATE]: "Create a weekly investor payout batch",
  [PERMISSIONS.PAYMENT_BATCH_APPROVE]: "Approve a payout batch someone else created",
  [PERMISSIONS.RECONCILIATION_VIEW]: "View unmatched Paystack transactions",
  [PERMISSIONS.TRANSFER_VERIFY]: "Verify an ownership transfer's target achieved status",
  [PERMISSIONS.TRANSFER_APPROVE]: "Approve an ownership transfer someone else verified",
  [PERMISSIONS.WALLET_VIEW]: "View investor wallet balances and ledger history",
  [PERMISSIONS.WALLET_WITHDRAWAL_APPROVE]: "Approve or reject an investor's wallet withdrawal request",
  [PERMISSIONS.WALLET_FUNDING_MANAGE]: "Approve converting a wallet balance into a new vehicle's contract",
  [PERMISSIONS.MAINTENANCE_MANAGE]: "Log and update vehicle maintenance records",
  [PERMISSIONS.STAFF_MANAGE]: "Create staff and agent accounts",
  [PERMISSIONS.RBAC_MANAGE]: "Manage roles and permissions",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage system wide default settings",
  [PERMISSIONS.AUDIT_LOG_VIEW]: "View the audit log",
  [PERMISSIONS.REPORTS_VIEW]: "View money-flow reports: inflow, outflow, and per-partner breakdowns",
};

async function main() {
  console.log("Seeding permissions...");
  for (const [key, description] of Object.entries(PERMISSION_DESCRIPTIONS)) {
    await prisma.permission.upsert({
      where: { key },
      update: { description },
      create: { key, description },
    });
  }

  console.log("Seeding roles...");
  for (const [roleName, permissionKeys] of Object.entries(DEFAULT_ROLE_SEED)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: roleName === "Admin" },
    });

    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key: permissionKey } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
    console.log(`  ${roleName}: ${permissionKeys.length} permission(s)`);
  }

  // Default contract terms per vehicle type (principal, target payout,
  // installment, frequency, term) live in code now, in
  // lib/vehicle-types.ts, not as a SystemSetting row, since they differ by
  // vehicle type and a single flat number no longer makes sense here.

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
