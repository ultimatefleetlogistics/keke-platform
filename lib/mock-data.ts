/**
 * Sample data shaped like the real Prisma models. This was used by every
 * page before Module 2, when every screen read from here so the design
 * could be reviewed with zero configuration. As of Module 2, no page
 * imports this file any more, they all read from lib/data/*.ts, which
 * queries Prisma directly. Kept only as a reference for the shape each
 * screen expects, safe to delete once that's no longer useful.
 */

export const mockInvestor = {
  fullName: "Aisha Oyelaran",
  initials: "AO",
  kycStatus: "VERIFIED" as const,
  stats: {
    totalInvested: 11_550_000,
    totalRealized: 8_340_000,
    outstanding: 3_210_000,
    activeInvestments: 2,
    totalInvestments: 3,
  },
  kekes: [
    {
      assetTag: "KKE-001",
      agentName: "Musa Adamu",
      location: "Kano",
      status: "ACTIVE" as const,
      progressPercent: 90,
      realized: 5_850_000,
      target: 6_500_000,
      weekly: 65_000,
    },
    {
      assetTag: "KKE-014",
      agentName: "Fatima Bello",
      location: "Kaduna",
      status: "PAYMENT_DEFERRED" as const,
      progressPercent: 38,
      realized: 2_490_000,
      target: 6_500_000,
      weekly: 65_000,
    },
  ],
  recentPayments: [
    { keke: "KKE-001", week: 22, amount: 65_000, date: "2026-08-21", status: "PAID" as const },
    { keke: "KKE-014", week: 9, amount: 65_000, date: "2026-08-19", status: "DEFERRED" as const },
    { keke: "KKE-001", week: 21, amount: 65_000, date: "2026-08-14", status: "PAID" as const },
  ],
};

export const mockAdminStats = {
  totalKekes: 412,
  activeFleet: 368,
  inMaintenance: 21,
  investmentValue: 1_587_450_000,
};

export const mockFleetStatusCounts = {
  all: 412,
  active: 368,
  maintenance: 21,
  unassigned: 9,
  pending: 14,
};

export const mockFleetKekes = [
  { assetTag: "KKE-057", status: "ACTIVE" as const, location: "Kano", agent: "Musa Adamu", driver: "Ibrahim Sule" },
  { assetTag: "KKE-058", status: "ACTIVE" as const, location: "Kano", agent: "Musa Adamu", driver: "Aliyu Garba" },
  { assetTag: "KKE-102", status: "MAINTENANCE" as const, location: "Kaduna", agent: "Fatima Bello", driver: "Yusuf Danladi" },
  { assetTag: "KKE-140", status: "UNASSIGNED" as const, location: "Kaduna", agent: "Fatima Bello", driver: "Unassigned" },
  { assetTag: "KKE-201", status: "PENDING" as const, location: "Abuja", agent: "Chidi Okeke", driver: "Pending onboarding" },
  { assetTag: "KKE-014", status: "ACTIVE" as const, location: "Kaduna", agent: "Fatima Bello", driver: "Musa Bala" },
];

export const mockWeeklyPayments = {
  weeks: ["W27", "W28", "W29", "W30", "W31", "W32", "W33", "W34"],
  latestLabel: "Week 34",
  latestAmount: 4_850_000,
};

export const mockNeedsAttention = [
  {
    tone: "bad" as const,
    text: "3 unmatched Paystack transactions awaiting reconciliation",
  },
  {
    tone: "warn" as const,
    text: "Contract KKE-014 payment deferred: approval needed",
  },
  {
    tone: "accent" as const,
    text: "Contract KKE-041 target achieved: ready for ownership transfer",
  },
];

export const mockInvestorsDueToday = [
  { investor: "Tunde Bakare", keke: "KKE-071", amount: 65_000 },
  { investor: "Grace Emeka", keke: "KKE-033", amount: 65_000 },
  { investor: "Samuel Okoro", keke: "KKE-118", amount: 65_000 },
];

export const mockAgentDashboard = {
  agentName: "Musa Adamu",
  region: "Kano",
  virtualAccount: { accountNumber: "9021447583", bankName: "Titan Trust Bank" },
  weeklyTarget: 65_000,
  paidThisWeek: 65_000,
  assignedKekes: [
    { assetTag: "KKE-057", driver: "Ibrahim Sule", status: "PAID" as const, amount: 65_000, date: "2026-08-24" },
    { assetTag: "KKE-058", driver: "Aliyu Garba", status: "PAID" as const, amount: 65_000, date: "2026-08-23" },
  ],
};
