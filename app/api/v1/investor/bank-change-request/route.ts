import * as Sentry from "@sentry/nextjs";

import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { getLatestBankChangeRequest } from "@/lib/data/onboarding";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Module 41: the mobile counterpart to requestPayoutDetailsChange
 * (lib/actions/investor-profile.ts), same sibling-implementation pattern
 * as change-password/update-phone, mirrored field for field and step for
 * step rather than shared code, since a Server Action can't be called
 * from a Route Handler. GET returns the signed-in investor's latest
 * request (or null), reusing getLatestBankChangeRequest directly, that
 * one is a plain read function, not a Server Action, nothing stops it
 * being reused the same way GET /api/v1/investor/summary reuses
 * getInvestorDashboardData. It also returns the account currently on
 * file, read straight off `user.investor`, the same Prisma row
 * authenticateApiRequest already loaded, no extra query needed, since
 * the mobile bank-account screen needs both the current account and the
 * latest request in one call, the two things the web payout-details page
 * reads separately in its own Server Component. Resolving
 * currentBankCode to a readable bank name is left to the mobile client,
 * which already loads the same bank list from GET /api/v1/banks for its
 * bank picker, so this route doesn't need its own Paystack round trip.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  const latest = await getLatestBankChangeRequest(user.investor.id);
  return Response.json({
    request: latest,
    currentBankAccountNumber: user.investor.bankAccountNumber,
    currentBankAccountName: user.investor.bankAccountName,
    currentBankCode: user.investor.bankCode,
  });
}

export async function POST(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  const body = await request.json().catch(() => null);
  const bankCode = typeof body?.bankCode === "string" ? body.bankCode.trim() : "";
  const accountNumber = typeof body?.accountNumber === "string" ? body.accountNumber.trim() : "";

  if (!bankCode || !accountNumber) {
    return apiError(400, "Choose a bank and enter an account number.");
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    return apiError(400, "Nigerian account numbers are 10 digits.");
  }

  const existingOpenRequest = await prisma.investorBankChangeRequest.findFirst({
    where: { investorId: user.investor.id, status: "PENDING_APPROVAL" },
  });
  if (existingOpenRequest) {
    return apiError(409, "You already have a bank change request pending review, wait for it to be decided before requesting another.");
  }

  const provider = await getPaymentProvider();
  let accountName: string;
  try {
    const resolved = await provider.resolveBankAccount({ accountNumber, bankCode });
    accountName = resolved.accountName;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify this account.";
    return apiError(422, `Could not verify this account with the bank: ${message}`);
  }

  let bankName = bankCode;
  try {
    const banks = await provider.listBanks();
    bankName = banks.find((bank) => bank.code === bankCode)?.name ?? bankCode;
  } catch {
    // Not fatal, same fallback the web request action uses: the raw code
    // is still better than nothing, the account itself already resolved.
  }

  try {
    const created = await prisma.investorBankChangeRequest.create({
      data: { investorId: user.investor.id, bankCode, bankName, accountNumber, accountName },
    });

    await sendNotification({
      userId: user.id,
      type: "bank_change_requested",
      title: "Bank change request submitted",
      body: `Your request to change your payout account to ${accountName} (${accountNumber}) is pending staff review.`,
      channels: ["EMAIL"],
    });

    return Response.json({ ok: true, request: created });
  } catch (err) {
    Sentry.captureException(err, { contexts: { bankChangeRequest: { investorId: user.investor.id } } });
    return apiError(500, "Could not submit your bank change request. Try again.");
  }
}
