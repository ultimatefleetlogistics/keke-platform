import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-[13.5px]", className)} {...props} />
    </div>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-background text-[11px] font-bold uppercase tracking-wide text-text-faint",
        className
      )}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn(className)} {...props} />;
}

function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      // Module 50: direct feedback, make the app feel more premium. Was a
      // flat gray tint (bg-background/60) on hover, same as any generic
      // UI kit's table row. Swapped for the brand-tinted accent-soft
      // already used for hover elsewhere (the dashboard's "View full
      // reports" link, for one), so a table row hovering feels like this
      // app's own interaction language instead of a default browser-y
      // gray, everywhere a Table renders across every portal at once.
      className={cn("border-t border-border transition-colors hover:bg-accent-soft/50", className)}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-5 py-3 text-left align-middle", className)} {...props} />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-5 py-3.5 align-middle", className)} {...props} />
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
