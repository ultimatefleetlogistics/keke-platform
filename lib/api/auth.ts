import { prisma } from "@/lib/prisma";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { getUserPermissions } from "@/lib/rbac/check-permission";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Module 34: the start of a real API surface for a client outside this
 * Next.js app, first and foremost the mobile app, to call. Everything in
 * this app until now, every page and every Server Action, only works from
 * inside this app's own browser session: a Server Component reads the
 * signed-in user from cookies (getCurrentUser, lib/auth/current-user.ts),
 * and a Server Action is only reachable from a form or a client call
 * already running on one of this app's own pages. Neither of those exists
 * for a React Native app on someone's phone, it has no cookies to send and
 * cannot call a Server Action directly, it needs real HTTP endpoints under
 * app/api that take a normal Authorization header.
 *
 * The mobile app authenticates directly against the same Supabase project
 * this web app already uses (same NEXT_PUBLIC_SUPABASE_URL, same anon
 * key, exposed to Expo as EXPO_PUBLIC_* variables, see the mobile setup
 * notes in docs/architecture/CURRENT_STATE.md), using Supabase's own
 * client SDK the same way this app's sign-in pages do. That gets it a
 * Supabase access token. Every request to an app/api/v1 route then sends
 * that token as `Authorization: Bearer <token>`, and authenticateApiRequest
 * below is what every route calls first to resolve it, mirroring
 * getCurrentUser's own shape (same User row, same investor/staff/agent/
 * driver profile, same permission Set) so route handlers can reuse the
 * same lib/data and lib/rbac functions every page already calls, nothing
 * about the business logic needs to be duplicated or rewritten for
 * mobile.
 *
 * This is deliberately its own function, not a second mode bolted onto
 * getCurrentUser itself: that one is wrapped in React's cache() and reads
 * from next/headers' cookies(), neither of which makes sense for a bearer
 * token read from a plain Request, forcing both shapes into one function
 * would make the common, cookie-based path harder to read for a
 * marginal gain.
 */
export async function authenticateApiRequest(request: Request): Promise<CurrentUser | null> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;

  const token = authHeader.slice(authHeader.indexOf(" ") + 1).trim();
  if (!token) return null;

  // The anon-key client, not the service-role one: this is validating
  // whichever token the mobile app is holding, exactly the same trust
  // level as a browser holding a session cookie, never a reason to
  // bypass Row Level Security. auth.getUser(token) checks this specific
  // token against Supabase directly, it does not read from any client
  // side session storage, which is what makes this safe to call with a
  // fresh client per request.
  const supabase = createSupabaseAnonClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !authUser) return null;

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: { investor: true, staff: true, agent: true, driver: true },
  });
  if (!user) return null;

  const permissions = await getUserPermissions(user.id);
  return { ...user, permissions };
}

/**
 * Consistent JSON error shape across every app/api/v1 route. `code` is
 * optional and only meant for a client that needs to branch on a
 * specific, known error rather than parsing `message` text, added
 * alongside the staff/admin mobile block (GET /api/v1/me) so
 * keke-mobile's auth context can tell "you're staff, get out" apart from
 * every other failure (offline, an expired token, a 500) without
 * matching on English sentences.
 */
export function apiError(status: number, message: string, code?: string): Response {
  return Response.json(code ? { error: message, code } : { error: message }, { status });
}
