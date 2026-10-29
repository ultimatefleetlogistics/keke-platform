import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components. Only ever uses the public
 * anon key, safe to ship to the browser. Never import the service role key
 * anywhere under this file's usage path.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
