"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex items-center gap-2 rounded-[11px] px-2 py-1.5 text-left text-[12px] font-semibold text-text-faint transition-colors hover:bg-background hover:text-text disabled:opacity-50"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {isSigningOut ? "Signing out..." : "Sign out"}
    </button>
  );
}
