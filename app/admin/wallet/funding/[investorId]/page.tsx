import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getWalletFundingInvestor } from "@/lib/data/wallet";
import { getAvailableVehicleOptions, getEffectiveVehicleTypeDefaults } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { FundVehicleForm } from "./fund-vehicle-form";

export default async function FundVehicleFromWalletPage({ params }: { params: Promise<{ investorId: string }> }) {
  const { investorId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.WALLET_FUNDING_MANAGE)) redirect("/admin/wallet");

  const [investor, vehicles, defaultTermsByType] = await Promise.all([
    getWalletFundingInvestor(investorId),
    getAvailableVehicleOptions(),
    getEffectiveVehicleTypeDefaults(),
  ]);

  if (!investor) notFound();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Fund a vehicle for {investor.fullName}</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Current wallet balance <span className="font-bold text-accent-dark">{formatNaira(investor.walletBalance)}</span>.
          Whatever amount you convert below is debited from that balance the moment this contract is created.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          {investor.walletBalance <= 0 ? (
            <div className="text-[13px] text-text-soft">This investor has no wallet balance to convert right now.</div>
          ) : vehicles.length === 0 ? (
            <div className="text-[13px] text-text-soft">
              No vehicle is currently available to assign, see{" "}
              <Link href="/admin/fleet" className="font-semibold text-accent-dark">
                Fleet
              </Link>
              .
            </div>
          ) : (
            <FundVehicleForm
              investorId={investor.id}
              walletBalance={investor.walletBalance}
              vehicles={vehicles}
              defaultTermsByType={defaultTermsByType}
            />
          )}
        </Card>
      </div>
    </>
  );
}
