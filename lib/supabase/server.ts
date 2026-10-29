import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client for use in Server Components, Route Handlers, and Server
 * Actions. Reads the session from cookies, still uses the anon key (the
 * user's own session), not the service role key.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that cannot set cookies.
            // Safe to ignore when middleware is refreshing the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role client. This bypasses Row Level Security entirely, so it
 * must only ever be used from trusted server code (Route Handlers, Server
 * Actions, webhook handlers) that has already run its own authorization
 * check. Never import this into anything that ships to the browser.
 */
export function createSupabaseServiceRoleClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Module 26: an anon-key client, same public key the browser uses, that
 * never touches the request's cookies (`persistSession: false`). Only
 * ever used for one thing: changePassword in lib/actions/auth.ts calling
 * signInWithPassword with it purely to check whether a supplied "current
 * password" is actually correct, treating whatever comes back as a plain
 * yes/no rather than a real session. createSupabaseServerClient (above)
 * is cookie-bound to the live signed-in session, calling
 * signInWithPassword on that one instead would overwrite the real
 * session's cookies with the verification attempt's result, exactly the
 * kind of side effect a password check should never have.
 */
export function createSupabaseAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
}
