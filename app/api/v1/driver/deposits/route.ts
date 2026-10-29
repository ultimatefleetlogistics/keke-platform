import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getDriverDeposits } from "@/lib/data/driver";

/**
 * The driver portal's equivalent of `GET /api/v1/agent/remittances`: the
 * uncapped deposit list behind `app/driver/deposits/page.tsx` on the web
 * side, `GET /api/v1/driver/summary` only ever returns a capped 5-entry
 * `recentDeposits` preview. Same reasoning as the agent remittances
 * route for skipping date-range params: a single driver's own deposit
 * volume is naturally small (one collection account, whatever passengers
 * pay by transfer instead of cash), the web page itself shows the whole
 * list on one screen with no filter, this mirrors that.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.driver) {
    return apiError(403, "This account isn't set up as a driver.");
  }

  const deposits = await getDriverDeposits(user.driver.id);
  return Response.json({ deposits });
}
