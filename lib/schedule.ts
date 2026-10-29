export type Frequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

/**
 * The full list of due dates for a contract's term, one per installment.
 * Weekly and biweekly step in fixed day increments, monthly steps by
 * calendar month so it lands on the same day-of-month each time (falling
 * back to month-end where the start day doesn't exist, e.g. day 31).
 *
 * Lives in its own plain module rather than lib/actions/contracts.ts
 * (where it used to live) because that file starts with "use server":
 * every top level export from a "use server" file is treated as a
 * callable Server Action, and Next.js's Turbopack build rejects a
 * synchronous one outright ("Server Actions must be async functions").
 * This is a pure helper, never called from the client, `createInvestmentContract`
 * in lib/actions/contracts.ts and `fundVehicleFromWallet` in
 * lib/actions/wallet.ts both import it from here so a normally-funded
 * contract and a wallet-funded one lay out installments identically.
 */
export function generateScheduleDates(startDate: Date, frequency: Frequency, termMonths: number): Date[] {
  const dates: Date[] = [];

  if (frequency === "MONTHLY") {
    for (let i = 0; i < termMonths; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      dates.push(d);
    }
    return dates;
  }

  const intervalDays = frequency === "BIWEEKLY" ? 14 : 7;
  const perMonth = frequency === "BIWEEKLY" ? 26 / 12 : 52 / 12;
  const count = Math.round(termMonths * perMonth);

  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i * intervalDays);
    dates.push(d);
  }
  return dates;
}
