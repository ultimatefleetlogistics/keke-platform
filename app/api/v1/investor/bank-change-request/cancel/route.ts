import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";

/**
 * Module 41: the mobile counterpart to cancelBankChangeRequest
 * (lib/actions/investor-profile.ts), same sibling-implementation pattern
 * as the rest of this module's mobile routes.
 */
export async function POST(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");
  if (!user.investor) return apiError(403, "This account isn't set up as an investor.");

  const body = await request.json().catch(() => null);
  const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) return apiError(400, "Missing request.");

  const bankChangeRequest = await prisma.investorBankChangeRequest.findUnique({ where: { id: requestId } });
  if (!bankChangeRequest || bankChangeRequest.investorId !== user.investor.id) {
    return apiError(404, "This isn't your bank change request.");
  }
  if (bankChangeRequest.status !== "PENDING_APPROVAL") {
    return apiError(409, `This request is already ${bankChangeRequest.status.toLowerCase().replaceAll("_", " ")}, it can no longer be cancelled.`);
  }

  await prisma.investorBankChangeRequest.update({
    where: { id: requestId },
    data: { status: "CANCELLED" },
  });

  return Response.json({ ok: true });
}
