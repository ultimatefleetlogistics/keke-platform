import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { getAgentRemittances } from "@/lib/data/agent";

/**
 * Round seven ("complete or finish up the agent"): the agent portal's
 * equivalent of `GET /api/v1/investor/payments`, the uncapped remittance
 * list behind `app/agent/remittances/page.tsx` on the web side.
 * `GET /api/v1/agent/summary` already returns a capped, per-vehicle
 * schedule preview for this week only (`assignedVehicles`); this route is
 * where "the rest of it" lives, mirroring every confirmed inbound
 * PaymentTransaction against the agent's own collection account, all
 * time, oldest-first ordering left to `getAgentRemittances` itself
 * (newest first).
 *
 * No date-range params like the investor payments route has: an agent's
 * own remittance volume is naturally much smaller than an investor's
 * multi-vehicle payment history (one collection account, one weekly
 * cadence), so the mobile screen just pages the full list client-side
 * the same way the web `/agent/remittances` page shows it all on one
 * screen, nothing here needed the added complexity of a server-side
 * filter yet. Same auth/403 shape as every other `/api/v1/agent/*`
 * route: no permission check beyond "does this account have an agent
 * profile," an agent can only ever see remittances into their own
 * collection account.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  if (!user.agent) {
    return apiError(403, "This account isn't set up as an agent.");
  }

  const remittances = await getAgentRemittances(user.agent);
  return Response.json({ remittances });
}
