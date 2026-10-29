import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getDriverDashboardData } from "@/lib/data/driver";

/**
 * The driver portal's equivalent of `GET /api/v1/investor/summary` and
 * `GET /api/v1/agent/summary`, closing the last of the three "no
 * equivalent endpoint" gaps CURRENT_STATE.md's Known gaps section listed
 * (investor, then agent, now driver). Mirrors those two exactly: check
 * for a driver profile, return `getDriverDashboardData` (the same
 * function `app/driver/dashboard/page.tsx` already calls) as JSON, no
 * business logic duplicated.
 *
 * No permission check beyond "does this account have a driver profile,"
 * same reasoning as the investor/agent routes: a driver can only ever
 * see their own collection account, their own current vehicle, and
 * their own deposit history, there is nothing more granular to check.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.driver) {
    return apiError(403, "This account isn't set up as a driver.");
  }

  const data = await getDriverDashboardData(user.driver);
  return Response.json(data);
}
