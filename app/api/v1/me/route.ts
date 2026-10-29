import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { isAgentDriverPortalEnabled, AGENT_DRIVER_PORTAL_DISABLED_MESSAGE } from "@/lib/config/portal-access";

/**
 * Module 34: the first real app/api/v1 route, and deliberately the first
 * one built. Whatever screen a mobile client shows first, it needs to
 * know two things before it can show anything else: is this token
 * actually still valid, and which portal does this account belong to
 * (investor, agent, driver, or staff/admin) so it knows which home
 * screen to render. This mirrors exactly what /sign-in's own
 * verifyAdminAccess/resolvePortalDestination (lib/actions/auth.ts)
 * work out for the web app right after a password sign-in (round nine:
 * that function now also covers the investor case, same priority order
 * this route already used), returned here as one plain payload instead
 * of a redirect, a mobile client picks its own screen locally rather
 * than following a server-issued URL.
 *
 * `portal` is deliberately a single computed field rather than making
 * every caller re-derive it from which of investor/staff/agent/driver is
 * present, same reasoning resolvePortalDestination already
 * documents: a real deployment could technically have more than one
 * profile on the same User row, staff takes priority as the most
 * privileged, then agent, then driver, then investor.
 */
export async function GET(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  const portal = user.staff
    ? "staff"
    : user.agent
      ? "agent"
      : user.driver
        ? "driver"
        : user.investor
          ? "investor"
          : null;

  if (!portal) {
    return apiError(403, "This account isn't set up as staff, an agent, a driver, or an investor yet.");
  }

  // Direct product decision: staff and admin accounts use the web app
  // only, not keke-mobile, nothing about their work is mobile-first the
  // way an investor/agent/driver's is, and every extra place a
  // privileged, permission-bearing session can live is extra attack
  // surface worth not having. Every other app/api/v1 route already only
  // returns data for whichever of investor/agent/driver the caller
  // actually has (403 otherwise), so a staff-only account already gets
  // nothing real from any of them, this is what closes the one route
  // that still would: GET /api/v1/me itself, which otherwise hands back
  // a staff account's full name, email, phone, and complete RBAC
  // permission list to anyone holding a valid bearer token for it. `code`
  // lets keke-mobile's auth context tell this apart from a generic
  // failure and react to it specifically (force a client-side sign-out,
  // show "use the web app" rather than silently falling back to a
  // generic signed-in view), see AuthProvider's loadProfile.
  if (portal === "staff") {
    return apiError(403, "Staff and admin accounts sign in at the Ultimate web app, not the mobile app.", "STAFF_PORTAL_NOT_SUPPORTED");
  }

  // Module 58: agent/driver platform access is a single flag
  // (`lib/config/portal-access.ts`), currently ON (matching this app's
  // behavior before this flag existed) per the client's own decision to
  // keep it available rather than build from scratch later if they
  // change their mind, see that file's doc comment. `code` lets
  // keke-mobile's AuthProvider react to this specifically, the same
  // pattern the staff block above already uses.
  if ((portal === "agent" || portal === "driver") && !isAgentDriverPortalEnabled()) {
    return apiError(403, AGENT_DRIVER_PORTAL_DISABLED_MESSAGE, "AGENT_DRIVER_PORTAL_DISABLED");
  }

  return Response.json({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    portal,
    mustChangePassword: user.mustChangePassword,
    permissions: Array.from(user.permissions),
  });
}
