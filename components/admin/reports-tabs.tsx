import Link from "next/link";

/**
 * The tab strip shared by every /admin/reports page (Module 33). Plain
 * links, not client-side tab state, matching how every filter form in
 * this app works, a real navigation the browser back button understands,
 * not a client component pretending to be one. `print:hidden` keeps this
 * off the partner statement page's printed output, see PrintButton.
 */
const TABS = [
  { href: "/admin/reports", label: "Money flow" },
  { href: "/admin/reports/portfolio", label: "Portfolio" },
  { href: "/admin/reports/arrears", label: "Arrears" },
  { href: "/admin/reports/fleet", label: "Fleet" },
  { href: "/admin/reports/kyc", label: "KYC" },
] as const;

export function ReportsTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <div className="print:hidden flex flex-wrap gap-1.5 border-b border-border px-8 pt-3.5">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rounded-t-lg px-3.5 py-2 text-[13px] font-bold transition-colors ${
            tab.href === active
              ? "border-b-2 border-accent text-accent-dark"
              : "border-b-2 border-transparent text-text-soft hover:text-text"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
