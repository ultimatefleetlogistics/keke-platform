import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a full set of real, sign-in-able demo accounts, plus enough
 * fleet, driver, contract, schedule, payment, wallet, and transfer data
 * for essentially every screen in the app to show something real instead
 * of an empty state. Expanded substantially in Module 23, the original
 * version of this script (one investor, one keke, one contract) only
 * really exercised the payout/remittance history and dashboard charts,
 * this version also exercises the fleet across every vehicle type and
 * status, drivers both with and without a Module 22 real account, a
 * completed ownership transfer, wallet balances and a withdrawal in
 * every reachable state (including the new investor-cancelled one), and
 * an unmatched Paystack transaction sitting in the reconciliation queue.
 *
 * Deliberately NOT seeded, and why: a historical PaymentBatch (creating
 * one that matches every invariant the real batch-processor produces,
 * transferStatus, linked PaymentTransaction, PaymentAllocation, and so
 * on, isn't worth the risk of a subtly wrong fabricated row when the
 * README's own tutorial already has you create and approve a real one by
 * hand in under a minute; this script makes sure at least two investors
 * have an installment due today so that tutorial always has something to
 * act on). Document and KycDocument rows are skipped too, a database row
 * pointing at a Storage path that was never actually uploaded to would
 * make "View" a broken link, worse than the honest empty state the
 * Documents section already shows. Notification rows are skipped, there
 * is no admin or investor screen that lists them yet, seeding rows
 * nobody can see would just be noise in the database.
 *
 * This is for local/dev use only, never run this against a production
 * project, it creates real Supabase Auth users with a known password.
 * Safe to run more than once, everything is upserted by a stable key.
 *
 * Run with: npm run db:seed:demo
 */

const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function ensureAuthUser(supabaseAdmin: SupabaseClient, email: string): Promise<string> {
  // listUsers is paginated, 200 is comfortably above what any dev project
  // will have while this script is in use.
  const { data: existing, error: listError } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listError) throw listError;

  const found = existing.users.find((u) => u.email === email);
  if (found) {
    console.log(`  auth user for ${email} already exists`);
    return found.id;
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`  created auth user for ${email}`);
  return data.user.id;
}

/**
 * Builds a weekly payment schedule for a contract starting `weeksAgo`
 * weeks before today, with `weeksPaid` of those weeks already paid (each
 * paid week gets the matching outbound investor payout + inbound agent
 * remittance pair, same shape the real webhook/batch flow produces), and
 * `weeksTotal` entries generated altogether (the rest UPCOMING). Returns
 * the sum actually paid, so the caller can set
 * InvestmentContract.totalPaidToInvestor from real entries rather than a
 * guessed number, the same discipline the original single-contract
 * version of this script used.
 */
async function seedWeeklySchedule(params: {
  contractId: string;
  agentId: string;
  investorId: string;
  installmentAmount: number;
  weeksAgo: number;
  weeksPaid: number;
  weeksTotal: number;
}): Promise<number> {
  const { contractId, agentId, investorId, installmentAmount, weeksAgo, weeksPaid, weeksTotal } = params;
  const today = new Date();
  let totalPaid = 0;

  for (let week = 1; week <= weeksTotal; week++) {
    const dueDate = addDays(today, (week - 1 - weeksAgo) * 7);
    const isPaid = week <= weeksPaid;
    const isDueToday = week === weeksPaid + 1;
    const status = isPaid ? "PAID" : isDueToday ? "DUE" : "UPCOMING";

    const existingEntry = await prisma.paymentScheduleEntry.findFirst({ where: { contractId, dueDate } });
    if (existingEntry) {
      if (existingEntry.status === "PAID") totalPaid += Number(existingEntry.amountPaid);
      continue;
    }

    const entry = await prisma.paymentScheduleEntry.create({
      data: {
        contractId,
        dueDate,
        expectedAmount: installmentAmount,
        amountPaid: isPaid ? installmentAmount : 0,
        status,
      },
    });

    if (isPaid) {
      const payoutTx = await prisma.paymentTransaction.create({
        data: {
          direction: "OUTBOUND",
          source: "INVESTOR_PAYOUT",
          amount: installmentAmount,
          status: "ALLOCATED",
          investorId,
          createdAt: dueDate,
        },
      });
      await prisma.paymentAllocation.create({
        data: { paymentTransactionId: payoutTx.id, scheduleEntryId: entry.id, amount: installmentAmount },
      });
      await prisma.paymentTransaction.create({
        data: {
          direction: "INBOUND",
          source: "AGENT_REMITTANCE",
          amount: installmentAmount,
          status: "ALLOCATED",
          agentId,
          createdAt: dueDate,
        },
      });
      totalPaid += installmentAmount;
    }
  }

  return totalPaid;
}

async function main() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env before running this script, " +
        "they are needed to create real Supabase Auth users via the admin API."
    );
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log("Creating demo Supabase Auth users...");
  const investorAuthId = await ensureAuthUser(supabaseAdmin, "investor.demo@ultimate.africa");
  const investor2AuthId = await ensureAuthUser(supabaseAdmin, "investor2.demo@ultimate.africa");
  const investor3AuthId = await ensureAuthUser(supabaseAdmin, "investor3.demo@ultimate.africa");
  const investor4AuthId = await ensureAuthUser(supabaseAdmin, "investor4.demo@ultimate.africa");
  const adminAuthId = await ensureAuthUser(supabaseAdmin, "admin.demo@ultimate.africa");
  const approverAuthId = await ensureAuthUser(supabaseAdmin, "approver.demo@ultimate.africa");
  const companyAdminAuthId = await ensureAuthUser(supabaseAdmin, "companyadmin.demo@ultimate.africa");
  const agentAuthId = await ensureAuthUser(supabaseAdmin, "agent.demo@ultimate.africa");
  const agent2AuthId = await ensureAuthUser(supabaseAdmin, "agent2.demo@ultimate.africa");
  // Two of the five demo drivers get a real account, the Module 22
  // pattern, the other three deliberately don't, so the seeded fleet
  // shows both kinds of driver a real deployment will have: pre-existing
  // drivers with no app access, and every driver created from now on with
  // one ready and waiting.
  const driver1AuthId = await ensureAuthUser(supabaseAdmin, "driver1.demo@ultimate.africa");
  const driver2AuthId = await ensureAuthUser(supabaseAdmin, "driver2.demo@ultimate.africa");

  console.log("Creating matching app users and profiles...");

  const investorUser = await prisma.user.upsert({
    where: { authId: investorAuthId },
    update: {},
    create: { authId: investorAuthId, email: "investor.demo@ultimate.africa", fullName: "Aisha Oyelaran" },
  });
  const investorProfile = await prisma.investorProfile.upsert({
    where: { userId: investorUser.id },
    update: {},
    create: {
      userId: investorUser.id,
      kycStatus: "VERIFIED",
      bvn: "22134587690",
      nin: "98213456701",
      bankAccountNumber: "0123456789",
      bankCode: "058",
      bankAccountName: "Aisha Oyelaran",
    },
  });

  // A second, fully verified investor with two contracts of her own (one
  // active, one already completed and transferred), so the dashboards,
  // transfer screen, and wallet don't all revolve around a single
  // investor.
  const investor4User = await prisma.user.upsert({
    where: { authId: investor4AuthId },
    update: {},
    create: { authId: investor4AuthId, email: "investor4.demo@ultimate.africa", fullName: "Grace Nwachukwu" },
  });
  const investor4Profile = await prisma.investorProfile.upsert({
    where: { userId: investor4User.id },
    update: {},
    create: {
      userId: investor4User.id,
      kycStatus: "VERIFIED",
      bvn: "31245698703",
      nin: "87654321099",
      bankAccountNumber: "0987654321",
      bankCode: "044",
      bankAccountName: "Grace Nwachukwu",
    },
  });

  // Two investors mid-onboarding, so /admin/kyc and the KYC status column
  // on the investor list show something other than a wall of "Verified".
  const investor2User = await prisma.user.upsert({
    where: { authId: investor2AuthId },
    update: {},
    create: { authId: investor2AuthId, email: "investor2.demo@ultimate.africa", fullName: "Chukwuemeka Okonkwo" },
  });
  await prisma.investorProfile.upsert({
    where: { userId: investor2User.id },
    update: {},
    create: { userId: investor2User.id, kycStatus: "PENDING_REVIEW", bvn: "45678912305" },
  });

  const investor3User = await prisma.user.upsert({
    where: { authId: investor3AuthId },
    update: {},
    create: { authId: investor3AuthId, email: "investor3.demo@ultimate.africa", fullName: "Blessing Adeyemi" },
  });
  await prisma.investorProfile.upsert({
    where: { userId: investor3User.id },
    update: {},
    create: { userId: investor3User.id, kycStatus: "REJECTED", bvn: "56789123406" },
  });

  const adminUser = await prisma.user.upsert({
    where: { authId: adminAuthId },
    update: {},
    create: { authId: adminAuthId, email: "admin.demo@ultimate.africa", fullName: "Ngozi Umeh" },
  });
  const staffProfile = await prisma.staffProfile.upsert({
    where: { userId: adminUser.id },
    update: {},
    create: { userId: adminUser.id, jobTitle: "Operations Manager" },
  });

  // A separate approver account, distinct from admin.demo, exists because
  // approving a payment batch requires a different staff member from
  // whoever created it (segregation of duties, see
  // lib/rbac/check-permission.ts's assertDifferentActor). admin.demo holds
  // every permission including approval, but can never approve its own
  // batches, so testing that flow end to end needs this second account.
  const approverUser = await prisma.user.upsert({
    where: { authId: approverAuthId },
    update: {},
    create: { authId: approverAuthId, email: "approver.demo@ultimate.africa", fullName: "Tunde Bakare" },
  });
  const approverStaffProfile = await prisma.staffProfile.upsert({
    where: { userId: approverUser.id },
    update: {},
    create: { userId: approverUser.id, jobTitle: "Payments Approver" },
  });

  // The new Module 23 role in action: day-to-day company administration
  // (fleet, contracts, investors, payments, wallet, KYC review),
  // deliberately without staff.manage/rbac.manage/settings.manage, those
  // three stay reserved for admin.demo, the system Admin role signed in
  // at /admin-sign-in. See lib/rbac/permissions.ts, DEFAULT_ROLE_SEED.
  const companyAdminUser = await prisma.user.upsert({
    where: { authId: companyAdminAuthId },
    update: {},
    create: { authId: companyAdminAuthId, email: "companyadmin.demo@ultimate.africa", fullName: "Chidinma Eze" },
  });
  const companyAdminStaffProfile = await prisma.staffProfile.upsert({
    where: { userId: companyAdminUser.id },
    update: {},
    create: { userId: companyAdminUser.id, jobTitle: "Head of Operations" },
  });

  const agentUser = await prisma.user.upsert({
    where: { authId: agentAuthId },
    update: {},
    create: { authId: agentAuthId, email: "agent.demo@ultimate.africa", fullName: "Musa Adamu" },
  });
  const agentProfile = await prisma.agent.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      region: "Kano",
      // Placeholder values so the agent dashboard has something to show.
      // Once PAYSTACK_SECRET_KEY is set, real Dedicated Virtual Accounts
      // should replace these, see lib/payments/paystack-provider.ts.
      paystackDvaAccountNumber: "9021447583",
      paystackDvaBankName: "Titan Trust Bank (demo, not a real Paystack account)",
    },
  });

  const agent2User = await prisma.user.upsert({
    where: { authId: agent2AuthId },
    update: {},
    create: { authId: agent2AuthId, email: "agent2.demo@ultimate.africa", fullName: "Chiamaka Nwosu" },
  });
  const agent2Profile = await prisma.agent.upsert({
    where: { userId: agent2User.id },
    update: {},
    create: {
      userId: agent2User.id,
      region: "Lagos",
      paystackDvaAccountNumber: "8134502216",
      paystackDvaBankName: "Titan Trust Bank (demo, not a real Paystack account)",
    },
  });

  console.log("Assigning roles...");
  const [investorRole, adminRole, agentRole, approverRole, companyAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "Investor" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Admin" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Agent" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Approver" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "Company Admin" } }),
  ]);
  await Promise.all(
    [
      [investorUser.id, investorRole.id],
      [investor2User.id, investorRole.id],
      [investor3User.id, investorRole.id],
      [investor4User.id, investorRole.id],
      [adminUser.id, adminRole.id],
      [agentUser.id, agentRole.id],
      [agent2User.id, agentRole.id],
      [approverUser.id, approverRole.id],
      [companyAdminUser.id, companyAdminRole.id],
    ].map(([userId, roleId]) =>
      prisma.roleAssignment.upsert({
        where: { userId_roleId: { userId, roleId } },
        update: {},
        create: { userId, roleId },
      })
    )
  );

  console.log("Creating drivers...");
  // Three legacy-style drivers, no app access, exactly how every driver
  // worked before Module 22.
  const driverIbrahim = await prisma.driver.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      agentId: agentProfile.id,
      fullName: "Ibrahim Sule",
      phone: "08031234567",
    },
  });
  const driverYakubu = await prisma.driver.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      agentId: agentProfile.id,
      fullName: "Yakubu Danladi",
      phone: "08041234567",
    },
  });
  const driverEmeka = await prisma.driver.upsert({
    where: { id: "00000000-0000-0000-0000-000000000003" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000003",
      agentId: agent2Profile.id,
      fullName: "Emeka Okafor",
      phone: "08051234567",
    },
  });

  // Two Module 22-style drivers, a real Supabase Auth account each,
  // created the same way /admin/drivers/new creates one today.
  const driver1User = await prisma.user.upsert({
    where: { authId: driver1AuthId },
    update: {},
    create: {
      authId: driver1AuthId,
      email: "driver1.demo@ultimate.africa",
      phone: "08061234567",
      fullName: "Fatima Bello",
    },
  });
  const driverFatima = await prisma.driver.upsert({
    where: { userId: driver1User.id },
    update: {},
    create: { userId: driver1User.id, agentId: agentProfile.id, fullName: "Fatima Bello", phone: "08061234567" },
  });

  const driver2User = await prisma.user.upsert({
    where: { authId: driver2AuthId },
    update: {},
    create: {
      authId: driver2AuthId,
      email: "driver2.demo@ultimate.africa",
      phone: "08071234567",
      fullName: "Chinedu Obi",
    },
  });
  const driverChinedu = await prisma.driver.upsert({
    where: { userId: driver2User.id },
    update: {},
    create: { userId: driver2User.id, agentId: agent2Profile.id, fullName: "Chinedu Obi", phone: "08071234567" },
  });

  // Neither the driver portal (Module 24) nor anything else actually gates
  // on the "Driver" role, it carries zero permissions same as Investor
  // and Agent, resolvePortalDestination checks for a linked Driver
  // profile directly. Assigned anyway for the same reason every other
  // portal-holding demo account gets one: consistency with how a real
  // deployment's data should look, not because anything reads it.
  const driverRole = await prisma.role.findUniqueOrThrow({ where: { name: "Driver" } });
  await Promise.all(
    [driver1User.id, driver2User.id].map((userId) =>
      prisma.roleAssignment.upsert({
        where: { userId_roleId: { userId, roleId: driverRole.id } },
        update: {},
        create: { userId, roleId: driverRole.id },
      })
    )
  );

  // A couple of deposits landing directly in Fatima's own collection
  // account, unrelated to any contract schedule, exactly what the
  // original driver-DVA idea was for: a passenger paying a fare by
  // transfer instead of cash. No PaymentAllocation here on purpose, a
  // deposit like this was never a scheduled installment to begin with,
  // see handleChargeSuccess in lib/payments/webhook-handler.ts, this
  // mirrors the RECORDED (not ALLOCATED) status it leaves a driver
  // deposit in when there's no unpaid schedule entry on their vehicle to
  // apply it to. Gives /driver/dashboard and /driver/deposits something
  // real to show rather than an empty state.
  const existingDriverDeposit = await prisma.paymentTransaction.findFirst({ where: { driverId: driverFatima.id } });
  if (!existingDriverDeposit) {
    await prisma.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "AGENT_REMITTANCE",
        amount: 4_500,
        status: "RECORDED",
        driverId: driverFatima.id,
        createdAt: addDays(new Date(), -5),
      },
    });
    await prisma.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "AGENT_REMITTANCE",
        amount: 3_200,
        status: "RECORDED",
        driverId: driverFatima.id,
        createdAt: addDays(new Date(), -1),
      },
    });
  }

  console.log("Creating the fleet across every vehicle type and status...");
  const vehicles = await Promise.all([
    prisma.vehicle.upsert({
      where: { assetTag: "KKE-001" },
      update: {},
      create: {
        assetTag: "KKE-001",
        type: "KEKE",
        status: "ACTIVE",
        location: "Kano",
        agentId: agentProfile.id,
        currentDriverId: driverIbrahim.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "KKE-002" },
      update: {},
      create: {
        assetTag: "KKE-002",
        type: "KEKE",
        status: "MAINTENANCE",
        location: "Kano",
        agentId: agentProfile.id,
        currentDriverId: driverYakubu.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "KKE-003" },
      update: {},
      create: { assetTag: "KKE-003", type: "KEKE", status: "UNASSIGNED", location: "Kano", agentId: agentProfile.id },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "KKE-004" },
      update: {},
      create: { assetTag: "KKE-004", type: "KEKE", status: "RETIRED", location: "Kano", agentId: agentProfile.id },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "BIKE-002" },
      update: {},
      create: {
        assetTag: "BIKE-002",
        type: "BIKE",
        status: "ACTIVE",
        location: "Kano",
        agentId: agentProfile.id,
        currentDriverId: driverFatima.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "CAR-001" },
      update: {},
      create: {
        assetTag: "CAR-001",
        type: "CAR",
        status: "ACTIVE",
        location: "Lagos",
        agentId: agent2Profile.id,
        currentDriverId: driverChinedu.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "CAR-002" },
      update: {},
      create: {
        assetTag: "CAR-002",
        type: "CAR",
        status: "PENDING_ONBOARDING",
        location: "Lagos",
        agentId: agent2Profile.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "BIKE-001" },
      update: {},
      create: {
        assetTag: "BIKE-001",
        type: "BIKE",
        status: "ACTIVE",
        location: "Lagos",
        agentId: agent2Profile.id,
        currentDriverId: driverEmeka.id,
      },
    }),
    prisma.vehicle.upsert({
      where: { assetTag: "KKE-005" },
      update: {},
      create: { assetTag: "KKE-005", type: "KEKE", status: "UNASSIGNED", location: "Lagos", agentId: agent2Profile.id },
    }),
  ]);
  const vehicleKke001 = vehicles.find((v) => v.assetTag === "KKE-001")!;
  const vehicleCar001 = vehicles.find((v) => v.assetTag === "CAR-001")!;
  const vehicleBike001 = vehicles.find((v) => v.assetTag === "BIKE-001")!;

  console.log("Creating contracts and payment history...");

  // Contract A: the original demo contract, roughly two-thirds of the way
  // through, with an installment due today so the "click New batch"
  // tutorial in the README always has an obvious first candidate.
  const existingContractA = await prisma.investmentContract.findFirst({
    where: { investorId: investorProfile.id, vehicleId: vehicleKke001.id },
  });
  const contractA =
    existingContractA ??
    (await prisma.investmentContract.create({
      data: {
        investorId: investorProfile.id,
        vehicleId: vehicleKke001.id,
        principalAmount: 3_850_000,
        targetPayoutAmount: 6_500_000,
        installmentAmount: 65_000,
        paymentFrequency: "WEEKLY",
        termMonths: 25,
        status: "ACTIVE",
        startDate: addDays(new Date(), -8 * 7),
        totalPaidToInvestor: 0,
        createdById: staffProfile.id,
      },
    }));
  const contractAPaid = await seedWeeklySchedule({
    contractId: contractA.id,
    agentId: agentProfile.id,
    investorId: investorProfile.id,
    installmentAmount: 65_000,
    weeksAgo: 8,
    weeksPaid: 8,
    weeksTotal: 12,
  });
  await prisma.investmentContract.update({ where: { id: contractA.id }, data: { totalPaidToInvestor: contractAPaid } });

  // Contract B: a second investor, a car contract that only just started,
  // week two due today, so more than one investor is ever due at once.
  const existingContractB = await prisma.investmentContract.findFirst({
    where: { investorId: investor4Profile.id, vehicleId: vehicleCar001.id },
  });
  const contractB =
    existingContractB ??
    (await prisma.investmentContract.create({
      data: {
        investorId: investor4Profile.id,
        vehicleId: vehicleCar001.id,
        principalAmount: 9_000_000,
        targetPayoutAmount: 15_000_000,
        installmentAmount: 150_000,
        paymentFrequency: "WEEKLY",
        termMonths: 25,
        status: "ACTIVE",
        startDate: addDays(new Date(), -1 * 7),
        totalPaidToInvestor: 0,
        createdById: companyAdminStaffProfile.id,
      },
    }));
  const contractBPaid = await seedWeeklySchedule({
    contractId: contractB.id,
    agentId: agent2Profile.id,
    investorId: investor4Profile.id,
    installmentAmount: 150_000,
    weeksAgo: 1,
    weeksPaid: 1,
    weeksTotal: 6,
  });
  await prisma.investmentContract.update({ where: { id: contractB.id }, data: { totalPaidToInvestor: contractBPaid } });

  // Contract C: already fully paid out and transferred, so /admin/transfers
  // and the "Fleet by status" chart both have a completed example, not
  // just active ones. Deliberately not replaying a full multi-year weekly
  // schedule to get there, see the file header comment on scope.
  const existingContractC = await prisma.investmentContract.findFirst({
    where: { investorId: investor4Profile.id, vehicleId: vehicleBike001.id },
  });
  const contractC =
    existingContractC ??
    (await prisma.investmentContract.create({
      data: {
        investorId: investor4Profile.id,
        vehicleId: vehicleBike001.id,
        principalAmount: 1_200_000,
        targetPayoutAmount: 2_000_000,
        installmentAmount: 25_000,
        paymentFrequency: "WEEKLY",
        termMonths: 25,
        status: "COMPLETED",
        startDate: addDays(new Date(), -30 * 7),
        totalPaidToInvestor: 2_000_000,
        createdById: staffProfile.id,
      },
    }));

  const existingTransfer = await prisma.ownershipTransfer.findFirst({ where: { contractId: contractC.id } });
  if (!existingTransfer) {
    const verifiedAt = addDays(new Date(), -10);
    const approvedAt = addDays(new Date(), -7);
    await prisma.ownershipTransfer.create({
      data: {
        contractId: contractC.id,
        vehicleId: vehicleBike001.id,
        target: "MANAGER",
        status: "COMPLETED",
        fromInvestorId: investor4Profile.id,
        verifiedById: companyAdminStaffProfile.id,
        verifiedAt,
        approvedById: approverStaffProfile.id,
        approvedAt,
        completedAt: approvedAt,
      },
    });
  }

  console.log("Creating wallet activity...");

  // investor.demo: two payouts held in the wallet instead of paid to the
  // bank, then one open withdrawal request, exactly the state the new
  // "Cancel request" button (Module 23) needs to be visible for.
  const existingWalletTx = await prisma.walletTransaction.findFirst({ where: { investorId: investorProfile.id } });
  if (!existingWalletTx) {
    const heldTx1 = await prisma.paymentTransaction.create({
      data: {
        direction: "OUTBOUND",
        source: "INVESTOR_PAYOUT",
        amount: 65_000,
        status: "ALLOCATED",
        investorId: investorProfile.id,
        createdAt: addDays(new Date(), -21),
      },
    });
    await prisma.walletTransaction.create({
      data: {
        investorId: investorProfile.id,
        type: "CREDIT",
        source: "PAYOUT_HELD",
        amount: 65_000,
        balanceAfter: 65_000,
        paymentTransactionId: heldTx1.id,
        note: "Payout held in wallet instead of sent to bank",
        createdAt: addDays(new Date(), -21),
      },
    });
    const heldTx2 = await prisma.paymentTransaction.create({
      data: {
        direction: "OUTBOUND",
        source: "INVESTOR_PAYOUT",
        amount: 40_000,
        status: "ALLOCATED",
        investorId: investorProfile.id,
        createdAt: addDays(new Date(), -7),
      },
    });
    await prisma.walletTransaction.create({
      data: {
        investorId: investorProfile.id,
        type: "CREDIT",
        source: "PAYOUT_HELD",
        amount: 40_000,
        balanceAfter: 105_000,
        paymentTransactionId: heldTx2.id,
        note: "Payout held in wallet instead of sent to bank",
        createdAt: addDays(new Date(), -7),
      },
    });
    await prisma.investorProfile.update({ where: { id: investorProfile.id }, data: { walletBalance: 105_000 } });
  }

  const existingOpenWithdrawal = await prisma.walletWithdrawal.findFirst({
    where: { investorId: investorProfile.id, status: "PENDING_APPROVAL" },
  });
  if (!existingOpenWithdrawal) {
    await prisma.walletWithdrawal.create({
      data: { investorId: investorProfile.id, amount: 50_000, status: "PENDING_APPROVAL" },
    });
  }

  // investor4.demo: a smaller wallet balance with a withdrawal already
  // paid out, so the staff review history list has more than one kind of
  // outcome to show.
  const existingWalletTx4 = await prisma.walletTransaction.findFirst({ where: { investorId: investor4Profile.id } });
  if (!existingWalletTx4) {
    const heldTx = await prisma.paymentTransaction.create({
      data: {
        direction: "OUTBOUND",
        source: "INVESTOR_PAYOUT",
        amount: 30_000,
        status: "ALLOCATED",
        investorId: investor4Profile.id,
        createdAt: addDays(new Date(), -28),
      },
    });
    await prisma.walletTransaction.create({
      data: {
        investorId: investor4Profile.id,
        type: "CREDIT",
        source: "PAYOUT_HELD",
        amount: 30_000,
        balanceAfter: 30_000,
        paymentTransactionId: heldTx.id,
        note: "Payout held in wallet instead of sent to bank",
        createdAt: addDays(new Date(), -28),
      },
    });

    const paidWithdrawal = await prisma.walletWithdrawal.create({
      data: {
        investorId: investor4Profile.id,
        amount: 30_000,
        status: "PAID",
        reviewedById: approverStaffProfile.id,
        reviewedAt: addDays(new Date(), -20),
        paystackTransferCode: "TRF_demo_paid_001",
        createdAt: addDays(new Date(), -21),
      },
    });
    await prisma.walletTransaction.create({
      data: {
        investorId: investor4Profile.id,
        type: "DEBIT",
        source: "WITHDRAWAL",
        amount: 30_000,
        balanceAfter: 0,
        withdrawalId: paidWithdrawal.id,
        createdById: approverStaffProfile.id,
        note: "Withdrawal paid out",
        createdAt: addDays(new Date(), -20),
      },
    });
    await prisma.investorProfile.update({ where: { id: investor4Profile.id }, data: { walletBalance: 0 } });
  }

  console.log("Creating a reconciliation example...");
  await prisma.providerTransaction.upsert({
    where: { providerRef: "demo-unmatched-charge-001" },
    update: {},
    create: {
      provider: "paystack",
      providerRef: "demo-unmatched-charge-001",
      eventType: "charge.success",
      status: "UNMATCHED",
      rawPayload: {
        event: "charge.success",
        data: {
          reference: "demo-unmatched-charge-001",
          amount: 5_000_00, // kobo, same unit Paystack sends
          customer: { email: "unrecognized.payer@example.com", customer_code: "CUS_demounmatched001" },
        },
      },
      receivedAt: addDays(new Date(), -2),
    },
  });

  console.log("Creating maintenance records...");
  const kke002 = vehicles.find((v) => v.assetTag === "KKE-002")!;
  const existingMaintenance = await prisma.maintenanceRecord.findFirst({ where: { vehicleId: kke002.id } });
  if (!existingMaintenance) {
    await prisma.maintenanceRecord.create({
      data: {
        vehicleId: kke002.id,
        status: "COMPLETED",
        description: "Engine oil change and brake pad replacement",
        cost: 18_000,
        performedAt: addDays(new Date(), -3),
        createdById: companyAdminStaffProfile.id,
      },
    });
    await prisma.maintenanceRecord.create({
      data: {
        vehicleId: kke002.id,
        status: "SCHEDULED",
        description: "Annual roadworthiness inspection",
        createdById: companyAdminStaffProfile.id,
      },
    });
  }

  console.log("\nDone. Sign in at /sign-in with any of these (password for all: Password123!):");
  console.log("  Investor: investor.demo@ultimate.africa (verified, active contract, wallet balance + pending withdrawal)");
  console.log("  Investor: investor4.demo@ultimate.africa (verified, one active contract, one completed + transferred)");
  console.log("  Investor: investor2.demo@ultimate.africa (KYC pending review)");
  console.log("  Investor: investor3.demo@ultimate.africa (KYC rejected)");
  console.log("  Admin:    admin.demo@ultimate.africa, sign in at /admin-sign-in (system Admin, every permission)");
  console.log("  Company Admin: companyadmin.demo@ultimate.africa (day-to-day admin, not staff/roles/settings)");
  console.log("  Approver: approver.demo@ultimate.africa (use this to approve a batch someone else created)");
  console.log("  Agent:    agent.demo@ultimate.africa (Kano)");
  console.log("  Agent:    agent2.demo@ultimate.africa (Lagos)");
  console.log("  Driver:   driver1.demo@ultimate.africa (Fatima Bello, Kano, has deposit history to look at)");
  console.log("  Driver:   driver2.demo@ultimate.africa (Chinedu Obi, Lagos)");
  console.log("  (three more drivers exist with no app access, the pre-Module-22 kind, see /admin/drivers)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
