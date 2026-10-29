import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getWalletFundingCandidates } from "@/lib/data/wallet";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

export default async function WalletFundingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.WALLET_FUNDING_MANAGE)) redirect("/admin/wallet");

  const candidates = await getWalletFundingCandidates();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Fund a vehicle from wallet</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every investor currently holding a wallet balance, highest first. Converting a balance into a new
          vehicle&apos;s contract is always a decision you make here, it never happens on its own no matter how large
          a balance grows.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="overflow-hidden p-0">
          {candidates.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-text-soft">
              No investor is currently holding a wallet balance.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Investor</TableHead>
                  <TableHead>Active contracts</TableHead>
                  <TableHead>Wallet balance</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidates.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">
                      {c.fullName}
                      <div className="mt-0.5 text-[12px] font-medium text-text-faint">{c.email}</div>
                      {c.wantsVehicleType ? (
                        <Badge variant="accent" className="mt-1.5 w-fit">
                          Wants a {VEHICLE_TYPE_LABELS[c.wantsVehicleType]}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-text-soft">{c.activeContracts}</TableCell>
                    <TableCell className="font-bold text-accent-dark">{formatNaira(c.walletBalance)}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/wallet/funding/${c.id}`}>Fund a vehicle</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
