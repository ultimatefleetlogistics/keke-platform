import { apiError } from "@/lib/api/auth";
import { checkMagicLinkBlocked } from "@/lib/actions/auth";

/**
 * The one API route that deliberately does not call authenticateApiRequest
 * first, there is no signed-in user yet at this point, that is exactly why
 * it exists. The web sign-in page's own magic-link button already calls
 * checkMagicLinkBlocked (lib/actions/auth.ts) as a Server Action before
 * ever calling supabase.auth.signInWithOtp, so an account with two-factor
 * authentication turned on never gets a magic link that would skip its
 * second factor. keke-mobile has no way to call a Server Action directly
 * (see lib/api/auth.ts's own doc comment on why app/api/v1 exists at
 * all), so this route is that same check, reachable over plain HTTP, one
 * more of the "known gap" items from CURRENT_STATE.md: "the mobile
 * sign-in screen cannot safely offer magic-link sign-in until
 * checkMagicLinkBlocked is reachable as an /api/v1 route." Takes an email
 * straight from the request body rather than a bearer token, and calls
 * the exact same function the web page does, so the two surfaces can
 * never disagree about which accounts are allowed to use a magic link.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "Expected a JSON body with an email field.");
  }

  const email = typeof body === "object" && body !== null && "email" in body ? (body as { email: unknown }).email : null;
  if (typeof email !== "string" || !email.trim()) {
    return apiError(400, "An email address is required.");
  }

  const result = await checkMagicLinkBlocked(email);
  return Response.json(result);
}
