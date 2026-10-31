/**
 * Module 58: a single on/off switch for agent and driver *platform
 * access* — whether an agent or driver account can sign into a portal
 * at all, web or mobile — kept separate from everything else in this
 * app (RBAC, `PERMISSIONS`, KYC status, ...) because this isn't about
 * what a signed-in agent/driver can do, it's about whether that
 * sign-in happens in the first place.
 *
 * Why this exists: the client confirmed agents and drivers will not
 * have self-service platform access for now, their remittances and
 * deposits are managed entirely by staff through the admin console and
 * per-account Paystack dedicated virtual accounts (see
 * `client-decisions-log.md` decision #1). That is a real, current
 * product decision. It is deliberately NOT implemented by deleting or
 * disabling the agent/driver portals (`app/agent/`, `app/driver/`,
 * `GET /api/v1/agent/*`, `GET /api/v1/driver/*`, and their full
 * `keke-mobile` counterparts) — all of that stays built and working, so
 * that if the client changes their mind later, turning it back on is
 * flipping one environment variable, not rebuilding two portals across
 * two codebases from scratch.
 *
 * `AGENT_DRIVER_PORTAL_ENABLED` in the deployment's environment
 * variables is the switch: set it to the literal string `"false"` to
 * turn agent/driver sign-in off (both apps, see `resolvePortalDestination`
 * in `lib/actions/auth.ts`, `app/agent/layout.tsx`, `app/driver/layout.tsx`,
 * and `GET /api/v1/me` below, which is what `keke-mobile`'s own sign-in
 * gates on), unset or anything else to leave it on. Defaults to
 * **enabled** when unset: this flag did not exist before Module 58,
 * agent/driver access was unconditionally on, so a deployment that
 * never sets this variable must keep behaving exactly as it always
 * has — this ships as a no-op today, not a silent lockout. Flip it to
 * `"false"` (and redeploy, an ordinary env-var change, not a code
 * change) only once the client actually asks for agent/driver access
 * to be switched off for real; nothing else in this codebase currently
 * asks for that.
 *
 * Investor access is never affected by this flag; it only ever checks
 * an agent or a driver profile.
 */
export function isAgentDriverPortalEnabled(): boolean {
  return process.env.AGENT_DRIVER_PORTAL_ENABLED !== "false";
}

/**
 * Shared copy for every place that has to explain why an agent/driver
 * sign-in didn't go through when the flag above is off: the web
 * sign-in page (`resolvePortalDestination`'s `{ error }` result) and
 * `GET /api/v1/me`'s `403` (which `keke-mobile`'s `AuthProvider` turns
 * into the same message on `blockedMessage`, see that file's own
 * `AGENT_DRIVER_PORTAL_DISABLED_MESSAGE`).
 */
export const AGENT_DRIVER_PORTAL_DISABLED_MESSAGE =
  "Agent and driver accounts don't sign in directly right now. Contact UFLogistics staff for help with your remittances or deposits.";

/**
 * A separate on/off switch for the agent/driver remittance SMS/email
 * alert (`handleChargeSuccess` in `lib/payments/webhook-handler.ts`, and
 * `recordManualPayment` in `lib/actions/manual-payments.ts`) — NOT the
 * same thing as `isAgentDriverPortalEnabled` above. That flag controls
 * whether an agent or driver can sign into a portal at all; this one
 * controls a one-way notification that was deliberately kept even with
 * the portal switched off, since it needs no sign-in and was, until now,
 * the only feedback an agent or driver ever got confirming a remittance
 * was recorded (see missing-features-agent-driver-restructure.md item 7).
 *
 * The client asked specifically for this alert turned off for now, a
 * separate request from the portal-access decision above, while keeping
 * the sending code itself in place, so restoring it later is a one-line
 * env change, not rebuilding anything. Defaults to enabled when unset,
 * same reasoning as the flag above: this did not exist before, so a
 * deployment that never sets it keeps behaving exactly as it always has.
 */
export function isAgentDriverRemittanceAlertEnabled(): boolean {
  return process.env.AGENT_DRIVER_REMITTANCE_ALERTS_ENABLED !== "false";
}
