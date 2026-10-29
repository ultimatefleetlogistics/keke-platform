import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Module 50: direct feedback, make the app feel more premium. Most empty
 * states in this app used to be a single line of plain text inside a
 * Card ("No investors yet, add one first.") with nothing else on the
 * page, the single most common tell of an unfinished app precisely
 * because an empty state is what a fresh admin, a brand-new KYC queue,
 * or a just-onboarded portal shows the very first time someone sees it.
 * This swaps that for an icon badge + title + optional description (and
 * an optional action, usually the same "add the first one" link the
 * plain text used to carry inline), using the same accent-soft/
 * accent-dark badge treatment the Settings hub's own section cards
 * already use, so it reads as this app's own idiom rather than a
 * generic "empty state" template. `animate-card-in` (globals.css) is
 * the same settle-in entrance every notification card and dashboard row
 * already gets, not a new animation invented just for this.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex animate-card-in flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-dark">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-[14px] font-extrabold text-text">{title}</div>
        {description ? <div className="max-w-xs text-[12.5px] text-text-soft">{description}</div> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
