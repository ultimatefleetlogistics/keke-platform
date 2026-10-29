import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getInvestorWalletData } from "@/lib/data/wallet";

/**
 * Module 41: the investor's own deposit account (a Paystack Dedicated
 * Virtual Account, see lib/payments/collection-account.ts) plus their
 * current wallet balance and standing deposit intent, for the mobile
 * app's deposit screen. Reuses getInvestorWalletData directly, the exact
 * same function app/investor/wallet/page.tsx calls on the web side, same
 * reasoning as every other GET route in this module: a plain read
 * function, not a Server Action, nothing about it needs duplicating.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  const wallet = await getInvestorWalletData(user.investor);
  return Response.json({
    walletBalance: wallet.balance,
    depositAccountNumber: wallet.depositAccountNumber,
    depositAccountBankName: wallet.depositAccountBankName,
    depositIntent: wallet.depositIntent,
    depositIntentVehicleType: wallet.depositIntentVehicleType,
  });
}
