import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getPaymentProvider } from "@/lib/payments/provider";

/**
 * Module 41: the bank picker the mobile app's bank-change-request screen
 * needs, the same list app/investor/payout-details/page.tsx already loads
 * directly from the payment provider on the web side. A plain read, no
 * lib/data wrapper needed, this mirrors the web page's own inline
 * `getPaymentProvider().listBanks()` call rather than introducing a new
 * layer just for one route. Gated on having an investor profile for now,
 * same reasoning as GET /api/v1/investor/summary: an investor account is
 * the only one this app has a real mobile feature for so far, nothing
 * about the bank list itself is investor-specific.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  try {
    const provider = await getPaymentProvider();
    const banks = await provider.listBanks();
    return Response.json({ banks });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the bank list.";
    return apiError(502, message);
  }
}
