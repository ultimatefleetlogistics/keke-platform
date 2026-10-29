import { prisma } from "@/lib/prisma";
import { getPaymentProvider } from "@/lib/payments/provider";
import { writeAuditLog } from "@/lib/audit";

export type ProvisionResult = { ok: true; alreadyExisted: boolean } | { ok: false; error: string };

/**
 * Creates a real Paystack Dedicated Virtual Account for an agent and
 * stores the result on their Agent row. Agents always have a User (see
 * the schema, `Agent.userId` is required), so there is always a real
 * email to hand Paystack, whose customer endpoint requires one.
 *
 * Idempotent: if this agent already has a paystackCustomerCode, this is a
 * no-op that reports alreadyExisted rather than creating a second
 * account, since Paystack's customer creation is otherwise not
 * idempotent (calling it twice for the same person creates two separate
 * customers and two DVAs). Never throws, callers (account creation, or a
 * manual "Create collection account" retry button) get back a plain
 * result they can show in the UI instead of catching an exception.
 */
export async function provisionAgentCollectionAccount(agentId: string, actorUserId: string): Promise<ProvisionResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } });
  if (!agent) return { ok: false, error: "Agent not found." };
  if (agent.paystackCustomerCode) return { ok: true, alreadyExisted: true };

  try {
    const provider = await getPaymentProvider();
    const [firstName, ...rest] = agent.user.fullName.trim().split(/\s+/);
    const account = await provider.createCollectionAccount({
      email: agent.user.email,
      firstName: firstName || agent.user.fullName,
      lastName: rest.join(" ") || firstName || agent.user.fullName,
      phone: agent.user.phone ?? undefined,
    });

    await prisma.agent.update({
      where: { id: agentId },
      data: {
        paystackCustomerCode: account.paystackCustomerCode,
        paystackDvaAccountNumber: account.accountNumber,
        paystackDvaBankName: account.bankName,
      },
    });

    await writeAuditLog({
      actorUserId,
      action: "agent.provision_collection_account",
      entityType: "Agent",
      entityId: agentId,
      afterState: { accountNumber: account.accountNumber, bankName: account.bankName },
    });

    return { ok: true, alreadyExisted: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error creating the collection account." };
  }
}

/**
 * Same as provisionAgentCollectionAccount, for a driver. Drivers are not
 * guaranteed a User row. Every driver created through
 * lib/actions/drivers.ts since Module 22 gets a real one (most will
 * never sign in, the account just sits ready), but `Driver.userId`
 * stays optional on the schema for whoever was created before that
 * change, or directly against the database (the seed script, for
 * instance). For that legacy case there is not always a real email on
 * file, and Paystack's customer endpoint requires one regardless, there
 * is no phone-only path, so a driver with no linked User gets a
 * placeholder address derived from their phone number,
 * `driver.<digits>@no-reply.keke-platform.internal`. This address is
 * never used to actually send mail, the driver's real channel is the SMS
 * this whole feature exists to send, it exists purely to satisfy a
 * required field on an API this app otherwise has no reason to email a
 * driver through. A phone number is required to create a driver for this
 * reason, and because a DVA with no way to tell the driver it was paid
 * into defeats the point of building one.
 */
export async function provisionDriverCollectionAccount(driverId: string, actorUserId: string): Promise<ProvisionResult> {
  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) return { ok: false, error: "Driver not found." };
  if (driver.paystackCustomerCode) return { ok: true, alreadyExisted: true };
  if (!driver.phone) {
    return { ok: false, error: "This driver has no phone number on file, add one first." };
  }

  try {
    const provider = await getPaymentProvider();
    const [firstName, ...rest] = driver.fullName.trim().split(/\s+/);
    const placeholderEmail = `driver.${driver.phone.replace(/\D/g, "")}@no-reply.keke-platform.internal`;
    const account = await provider.createCollectionAccount({
      email: driver.user?.email ?? placeholderEmail,
      firstName: firstName || driver.fullName,
      lastName: rest.join(" ") || firstName || driver.fullName,
      phone: driver.phone,
    });

    await prisma.driver.update({
      where: { id: driverId },
      data: {
        paystackCustomerCode: account.paystackCustomerCode,
        paystackDvaAccountNumber: account.accountNumber,
        paystackDvaBankName: account.bankName,
      },
    });

    await writeAuditLog({
      actorUserId,
      action: "driver.provision_collection_account",
      entityType: "Driver",
      entityId: driverId,
      afterState: { accountNumber: account.accountNumber, bankName: account.bankName },
    });

    return { ok: true, alreadyExisted: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error creating the collection account." };
  }
}

/**
 * Same as provisionAgentCollectionAccount, for an investor (Module 41).
 * Investors always have a User, same as agents (InvestorProfile.userId is
 * required, not optional like Driver.userId), so there is always a real
 * email to hand Paystack. This is a deposit account, the direction of
 * money is the opposite of an investor's payout bank details
 * (InvestorProfile.bankAccountNumber/bankCode/bankAccountName): those are
 * where an investor's money goes OUT to, this is where their own money
 * comes IN from when they choose to deposit. A charge.success webhook
 * against the paystackCustomerCode this stores is what credits the
 * investor's wallet, see handleChargeSuccess in
 * lib/payments/webhook-handler.ts.
 */
export async function provisionInvestorCollectionAccount(investorId: string, actorUserId: string): Promise<ProvisionResult> {
  const investor = await prisma.investorProfile.findUnique({ where: { id: investorId }, include: { user: true } });
  if (!investor) return { ok: false, error: "Investor not found." };
  if (investor.paystackCustomerCode) return { ok: true, alreadyExisted: true };

  try {
    const provider = await getPaymentProvider();
    const [firstName, ...rest] = investor.user.fullName.trim().split(/\s+/);
    const account = await provider.createCollectionAccount({
      email: investor.user.email,
      firstName: firstName || investor.user.fullName,
      lastName: rest.join(" ") || firstName || investor.user.fullName,
      phone: investor.user.phone ?? undefined,
    });

    await prisma.investorProfile.update({
      where: { id: investorId },
      data: {
        paystackCustomerCode: account.paystackCustomerCode,
        paystackDvaAccountNumber: account.accountNumber,
        paystackDvaBankName: account.bankName,
      },
    });

    await writeAuditLog({
      actorUserId,
      action: "investor.provision_collection_account",
      entityType: "InvestorProfile",
      entityId: investorId,
      afterState: { accountNumber: account.accountNumber, bankName: account.bankName },
    });

    return { ok: true, alreadyExisted: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown error creating the collection account." };
  }
}
