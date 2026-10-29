"use client";

import { Button } from "@/components/ui/button";

/**
 * Triggers the browser's own print dialog, "Save as PDF" is a standard
 * option there in every major browser, so this doubles as the PDF export
 * path for a partner statement (Module 33) without pulling in a PDF
 * generation library. `print:hidden` (on this button, the ReportsTabs
 * strip, and the filter form around it) keeps everything except the
 * statement itself out of the printed/saved output, see app-shell.tsx
 * and app/globals.css for the rest of what print mode hides.
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
