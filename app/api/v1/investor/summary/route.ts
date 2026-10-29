import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getInvestorDashboardData } from "@/lib/data/investor";

/**
 * Module 37: the first `/api/v1` route that returns anything beyond "who
 * is this." Reuses `getInvestorDashboardData`, the exact same function
 * `app/investor/dashboard/page.tsx` calls, so this is not a second copy
 * of the investor dashboard's business logic, only a thin route that
 * authenticates, checks for an investor profile, and returns the same
 * data as JSON instead of rendering it. Investor-only on purpose, an
 * investor's dashboard is the only screen the mobile app has real data
 * for so far, see docs/architecture/CURRENT_STATE.md's "Mobile /
 * external API" section for what still needs its own route the same way
 * (a staff/agent/driver equivalent, most of all).
 *
 * No separate permission check beyond "does this account have an
 * investor profile": the web dashboard page itself does not call
 * `hasPermission` either, an investor can only ever see their own data,
 * there is nothing more granular to check.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.investor) {
    return apiError(403, "This account isn't set up as an investor.");
  }

  const data = await getInvestorDashboardData(user.investor);
  return Response.json(data);
}
