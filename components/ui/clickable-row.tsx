"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * A TableRow that navigates to `href` when clicked anywhere in the row,
 * not just wherever the row's own text Link happens to sit. Several list
 * tables in this app styled TableRow with `cursor-pointer` to signal the
 * whole row is clickable, but only a small Link inside one cell actually
 * was, so clicking the status badge, a blank cell, or anywhere else in
 * the row silently did nothing, reported directly as rows "not clickable"
 * on `/admin/payments/batches` and no obvious way to open a row on
 * `/admin/kyc`. The inner Link stays (kept for accessibility, middle
 * click, right click "open in new tab", and keyboard focus all still
 * need a real anchor), this only adds a convenience click target around
 * the rest of the row.
 */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <TableRow onClick={() => router.push(href)} className={cn("cursor-pointer", className)}>
      {children}
    </TableRow>
  );
}
