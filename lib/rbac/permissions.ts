/**
 * The catalog of permission keys the app understands. Roles and the
 * mapping from role to permission are stored in the database (see the
 * Role/Permission/RolePermission models) so an admin can create new roles
 * and adjust access from the settings screen without a code change. This
 * file only defines the fixed vocabulary of actions the app can gate,
 * which is a much smaller, much more stable list than the roles built on
 * top of it.
 */
export const PERMISSIONS = {
  INVESTORS_VIEW: "investors.view",
  INVESTORS_MANAGE: "investors.manage",
  KYC_REVIEW: "kyc.review",

  FLEET_VIEW: "fleet.view",
  FLEET_MANAGE: "fleet.manage",

  CONTRACTS_VIEW: "contracts.view",
  CONTRACTS_CREATE: "contracts.create",
  CONTRACTS_MANAGE: "contracts.manage",

  PAYMENTS_VIEW: "payments.view",
  PAYMENT_BATCH_CREATE: "payments.batch.create",
  PAYMENT_BATCH_APPROVE: "payments.batch.approve",
  RECONCILIATION_VIEW: "payments.reconciliation.view",

  TRANSFER_VERIFY: "transfer.verify",
  TRANSFER_APPROVE: "transfer.approve",

  WALLET_VIEW: "wallet.view",
  WALLET_WITHDRAWAL_APPROVE: "wallet.withdrawal.approve",
  WALLET_FUNDING_MANAGE: "wallet.funding.manage",

  MAINTENANCE_MANAGE: "maintenance.manage",

  STAFF_MANAGE: "staff.manage",

  RBAC_MANAGE: "rbac.manage",
  SETTINGS_MANAGE: "settings.manage",
  AUDIT_LOG_VIEW: "audit.view",

  REPORTS_VIEW: "reports.view",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Default role to permission mapping used only to seed the database the
 * first time. After seeding, this mapping is not authoritative, the rows
 * in the database are, so this list is deliberately not imported by any
 * runtime authorization check.
 */
export const DEFAULT_ROLE_SEED: Record<string, PermissionKey[]> = {
  Admin: Object.values(PERMISSIONS),
  // Module 23: day-to-day company administration, deliberately everything
  // Admin has except the three permissions that control who has access to
  // what at all (STAFF_MANAGE, RBAC_MANAGE, SETTINGS_MANAGE). Those three
  // stay reserved for the system Admin role signed in at /admin-sign-in,
  // so the platform's own configuration always has a smaller, harder to
  // reach set of hands on it than everyday operations does. Unlike Admin,
  // this is an ordinary role: it can be renamed, have permissions added or
  // removed, or be deleted from /admin/settings/roles like any other role,
  // this starting permission set is just where a staff account created
  // with it begins.
  "Company Admin": Object.values(PERMISSIONS).filter(
    (permission) =>
      permission !== PERMISSIONS.STAFF_MANAGE &&
      permission !== PERMISSIONS.RBAC_MANAGE &&
      permission !== PERMISSIONS.SETTINGS_MANAGE
  ),
  Finance: [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENT_BATCH_CREATE,
    PERMISSIONS.RECONCILIATION_VIEW,
    PERMISSIONS.CONTRACTS_VIEW,
    PERMISSIONS.INVESTORS_VIEW,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.REPORTS_VIEW,
  ],
  Approver: [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.PAYMENT_BATCH_APPROVE,
    PERMISSIONS.TRANSFER_APPROVE,
    PERMISSIONS.WALLET_VIEW,
    PERMISSIONS.WALLET_WITHDRAWAL_APPROVE,
    PERMISSIONS.WALLET_FUNDING_MANAGE,
  ],
  Operations: [
    PERMISSIONS.FLEET_VIEW,
    PERMISSIONS.FLEET_MANAGE,
    PERMISSIONS.MAINTENANCE_MANAGE,
    PERMISSIONS.TRANSFER_VERIFY,
    PERMISSIONS.CONTRACTS_VIEW,
    PERMISSIONS.CONTRACTS_CREATE,
  ],
  ComplianceReviewer: [PERMISSIONS.KYC_REVIEW, PERMISSIONS.INVESTORS_VIEW],
  Investor: [],
  Agent: [],
  Driver: [],
};
