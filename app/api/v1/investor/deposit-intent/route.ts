import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";

const VALID_DEPOSIT_INTENTS = ["WALLET_TOPUP", "VEHICLE_PURCHASE"] as const;
const VALID_VEHICLE_TYPES = ["KEKE", "CAR", "BIKE"] as const;

/**
 * Module 41: the mobile counterpart to updateDepositIntent
 * (lib/actions/investor-profile.ts), same sibling-implementation pattern
 * as the rest of this module's mobile routes. See that action's own doc
 * comment for what this standing preference actually controls.
 */
export async function POST(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  const body = await request.json().catch(() => null);
  const depositIntent = typeof body?.depositIntent === "string" ? body.depositIntent : "";
  const vehicleType = typeof body?.vehicleType === "string" ? body.vehicleType.trim() : "";

  if (!(VALID_DEPOSIT_INTENTS as readonly string[]).includes(depositIntent)) {
    return apiError(400, "Choose either wallet top-up or a vehicle purchase.");
  }
  if (depositIntent === "VEHICLE_PURCHASE" && !(VALID_VEHICLE_TYPES as readonly string[]).includes(vehicleType)) {
    return apiError(400, "Choose which vehicle type you're depositing toward.");
  }

  await prisma.investorProfile.update({
    where: { id: user.investor.id },
    data: {
      depositIntent: depositIntent as (typeof VALID_DEPOSIT_INTENTS)[number],
      depositIntentVehicleType:
        depositIntent === "VEHICLE_PURCHASE" ? (vehicleType as (typeof VALID_VEHICLE_TYPES)[number]) : null,
    },
  });

  return Response.json({ ok: true });
}
