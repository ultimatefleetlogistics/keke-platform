import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/rbac/check-permission";

/**
 * Resolves the signed in Supabase user to our own User row plus whichever
 * profile (investor, staff, agent, driver) belongs to them, and their full
 * permission set. Wrapped in React's cache() because every portal layout
 * AND every page underneath it calls this independently (the layout needs
 * it to redirect signed-out visitors, the page needs it to check specific
 * permissions and greet the user by name). Without caching, that is two
 * full round trips to Supabase Auth plus Postgres per navigation instead
 * of one, which is very noticeable given how far the database is from
 * Nigeria. cache() only dedupes within a single request, it is not a
 * cross-request cache, so a stale session or role change is still picked
 * up on the very next navigation.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const user = await prisma.user.findUnique({
    where: { authId: authUser.id },
    include: {
      investor: true,
      staff: true,
      agent: true,
      driver: true,
    },
  });

  if (!user) return null;

  const permissions = await getUserPermissions(user.id);

  return { ...user, permissions };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
