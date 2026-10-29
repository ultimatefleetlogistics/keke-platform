"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentProvider } from "@/lib/payments/provider";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * An investor asking to change the bank account their weekly payouts and
 * wallet withdrawals land in. The account number and bank are still always
 * resolved against Paystack first (the same way a real fintech checkout
 * confirms an account before accepting it), the account name that comes
 * back is what gets saved on the request, never whatever the investor
 * might have typed for it. Unlike phone number self-service (updateOwnPhone
 * in lib/actions/auth.ts, immediate, no review, a wrong phone number only
 * risks a missed alert), this never touches InvestorProfile directly, it
 * only creates a PENDING_APPROVAL InvestorBankChangeRequest, a real bank
 * account controls where real money is sent, that needs a staff member's
 * eyes on it first, see approveBankChangeRequest/rejectBankChangeRequest in
 * lib/actions/investors.ts for the other half. Module 41, direct feedback:
 * "should be sent as a request until approve by a staff". Only one open
 * request is allowed at a time, same reasoning as requestWalletWithdrawal
 * in lib/actions/wallet.ts, so a second request can't leave staff reviewing
 * two different accounts for the same investor at once.
 *
 * Named requestPayoutDetailsChange, not updatePayoutDetails as it used to
 * be: nothing is updated here anymore, only requested. Still returns
 * `{error?}` instead of throwing, same Module 26 fix as before, a Paystack
 * rejection here (a bad account number, Paystack briefly down) must show
 * the investor what actually went wrong, not crash to the generic error
 * boundary.
 */
export async function requestPayoutDetailsChange(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.investor) return { error: "Only investor accounts have payout details." };

  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (!bankCode || !accountNumber) {
    return { error: "Choose a bank and enter an account number." };
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return { error: "Nigerian account numbers are 10 digits." };
  }

  const existingOpenRequest = await prisma.investorBankChangeRequest.findFirst({
    where: { investorId: user.investor.id, status: "PENDING_APPROVAL" },
  });
  if (existingOpenRequest) {
    return { error: "You already have a bank change request pending review, wait for it to be decided before requesting another." };
  }

  const provider = await getPaymentProvider();
  let accountName: string;
  try {
    const resolved = await provider.resolveBankAccount({ accountNumber, bankCode });
    accountName = resolved.accountName;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify this account.";
    return { error: `Could not verify this account with the bank: ${message}` };
  }

  let bankName = bankCode;
  try {
    const banks = await provider.listBanks();
    bankName = banks.find((bank) => bank.code === bankCode)?.name ?? bankCode;
  } catch {
    // Not fatal, same fallback InvestorBankForm/payout-details already use
    // elsewhere when the bank list itself can't be fetched: the raw code
    // is still better than nothing, and the account itself already
    // resolved fine above.
  }

  await prisma.investorBankChangeRequest.create({
    data: {
      investorId: user.investor.id,
      bankCode,
      bankName,
      accountNumber,
      accountName,
    },
  });

  await sendNotification({
    userId: user.id,
    type: "bank_change_requested",
    title: "Bank change request submitted",
    body: `Your request to change your payout account to ${accountName} (${accountNumber}) is pending staff review.`,
    channels: ["EMAIL"],
  });

  revalidatePath("/investor/payout-details");
  return {};
}

/**
 * An investor cancelling their own pending bank change request, same
 * pattern as cancelWalletWithdrawal in lib/actions/wallet.ts. Only
 * reachable while still PENDING_APPROVAL, nothing has changed on
 * InvestorProfile at that point, so this is a pure status change with
 * nothing to reverse.
 *
 * Module 43: this used to throw on every real failure path, with a doc
 * comment here explaining that away as fine since it was bound to a plain
 * `<form action={cancelBankChangeRequest}>` (a Server Component form, no
 * client-side catch), a plain form action can only be typed
 * `void | Promise<void>`. "Never destructive" only means no data
 * corruption, it does not mean the crash-to-Next's-generic-error-boundary
 * UX was actually fine, the same bug shape as the six other throw-bound
 * actions already fixed before this module, see
 * `components/ui/action-form.tsx`'s doc comment. Converted to a `{error?}`
 * return, its call site on `/investor/payout-details` now uses
 * `ActionForm`, which accepts exactly that return type.
 */
export async function cancelBankChangeRequest(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  if (!user.investor) throw new Error("Only investor accounts have payout details.");

  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) throw new Error("Missing request.");

  const request = await prisma.investorBankChangeRequest.findUnique({ where: { id: requestId } });
  if (!request || request.investorId !== user.investor.id) {
    return { error: "This isn't your bank change request." };
  }
  if (request.status !== "PENDING_APPROVAL") {
    return { error: `This request is already ${request.status.toLowerCase().replaceAll("_", " ")}, it can no longer be cancelled.` };
  }

  await prisma.investorBankChangeRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  revalidatePath("/investor/payout-details");
}

const VALID_PAYOUT_DESTINATIONS = ["BANK", "WALLET"] as const;

/**
 * Module 26: lets an investor change their own standing preference for
 * where a payout lands, set initially by staff at onboarding
 * (createInvestor in lib/actions/investors.ts), editable here at any
 * time afterward. This only ever changes the default new batches are
 * built from, see InvestorProfile.defaultPayoutDestination's schema
 * comment, it never touches a batch item that already exists.
 *
 * Deliberately still instant, unlike requestPayoutDetailsChange above:
 * this only toggles between an account already on file and the wallet,
 * it never introduces a new, unverified account, so it doesn't carry the
 * same risk a bank account change does. Confirmed directly with the
 * person who asked for the approval requirement, Module 41.
 */
export async function updatePayoutDestination(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.investor) return { error: "Only investor accounts have a payout destination." };

  const destinationInput = String(formData.get("payoutDestination") ?? "");
  if (!(VALID_PAYOUT_DESTINATIONS as readonly string[]).includes(destinationInput)) {
    return { error: "Choose either your bank account or your wallet." };
  }

  await prisma.investorProfile.update({
    where: { id: user.investor.id },
    data: { defaultPayoutDestination: destinationInput as (typeof VALID_PAYOUT_DESTINATIONS)[number] },
  });

  revalidatePath("/investor/payout-details");
  return {};
}

const VALID_DEPOSIT_INTENTS = ["WALLET_TOPUP", "VEHICLE_PURCHASE"] as const;

/**
 * Module 41: lets an investor set their own standing answer to "what is a
 * deposit into your account for", shown alongside their deposit account
 * number on /investor/wallet. WALLET_TOPUP is the default, free wallet
 * balance. VEHICLE_PURCHASE additionally records which vehicle type they
 * have in mind, so a deposit lands flagged for staff to act on quickly at
 * /admin/wallet/funding, direct feedback: "ask investor if he wants to
 * fund his wallet or he wants to purchase the vehicle straight away".
 * This is a standing preference, not a one-off choice, InvestorProfile
 * .depositIntent stays whatever it was last set to until changed again;
 * WalletTransaction.depositIntent snapshots it at the moment each deposit
 * is actually processed (see handleInvestorDeposit in
 * lib/payments/webhook-handler.ts), so changing it here never rewrites
 * what an already-processed deposit was for. Choosing VEHICLE_PURCHASE
 * never creates a contract by itself, a staff member still always
 * decides that, same principle as fundVehicleFromWallet in
 * lib/actions/wallet.ts.
 */
export async function updateDepositIntent(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.investor) return { error: "Only investor accounts have a deposit account." };

  const intentInput = String(formData.get("depositIntent") ?? "");
  if (!(VALID_DEPOSIT_INTENTS as readonly string[]).includes(intentInput)) {
    return { error: "Choose either wallet top-up or a vehicle purchase." };
  }

  const vehicleType = String(formData.get("vehicleType") ?? "").trim();
  if (intentInput === "VEHICLE_PURCHASE" && !["KEKE", "CAR", "BIKE"].includes(vehicleType)) {
    return { error: "Choose which vehicle type you're depositing toward." };
  }

  await prisma.investorProfile.update({
    where: { id: user.investor.id },
    data: {
      depositIntent: intentInput as (typeof VALID_DEPOSIT_INTENTS)[number],
      depositIntentVehicleType: intentInput === "VEHICLE_PURCHASE" ? (vehicleType as "KEKE" | "CAR" | "BIKE") : null,
    },
  });

  revalidatePath("/investor/wallet");
  return {};
}
