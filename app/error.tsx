"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

import { KekeIcon } from "@/components/design-system/keke-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Catches any error thrown while rendering below the root layout, which is
 * almost every error in this app (a Server Component that throws, a
 * Client Component render error, anything not already caught and turned
 * into a returned {error} value the way most Server Actions here do).
 * Reports to Sentry itself, this is the one place an unhandled render
 * error is guaranteed to pass through, whether or not the code path that
 * threw it already had its own captureException call. See
 * app/global-error.tsx for the rarer case of the root layout itself
 * throwing, where this file never even mounts.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft">
        <KekeIcon className="h-6 w-6" color="var(--accent-dark)" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="text-lg font-extrabold text-text">Something went wrong</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          This has already been reported. Try again, and if it keeps happening, let the team know what you were
          doing when it broke.
        </div>
      </div>
      <Card className="w-full max-w-sm p-4 text-left">
        <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Error reference</div>
        <div className="mt-1 truncate text-[12.5px] text-text-soft">{error.digest ?? error.message}</div>
      </Card>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
