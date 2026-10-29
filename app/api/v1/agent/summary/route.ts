import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getAgentDashboardData } from "@/lib/data/agent";

/**
 * The agent portal's equivalent of GET /api/v1/investor/summary (Module
 * 37). Reuses getAgentDashboardData, the exact same function
 * app/agent/dashboard/page.tsx calls, so this is not a second copy of the
 * agent dashboard's business logic, only a thin route that authenticates,
 * checks for an agent profile, and returns the same data as JSON instead
 * of rendering it, the identical pattern the investor route already
 * established. This is the first of the "staff, agent, and driver portals
 * still have no equivalent endpoint" gaps (CURRENT_STATE.md's "Known
 * gaps") to actually get one, closing it for the agent portal
 * specifically; staff and driver still need their own the same way.
 *
 * No separate permission check beyond "does this account have an agent
 * profile": the web dashboard page itself does not call hasPermission
 * either, an agent can only ever see their own assigned vehicles and
 * remittances, there is nothing more granular to check.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.agent) {
    return apiError(403, "This account isn't set up as an agent.");
  }

  const data = await getAgentDashboardData(user.agent);
  return Response.json(data);
}
