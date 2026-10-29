import { prisma } from "@/lib/prisma";
import { koboToNaira } from "./paystack-client";
import { applyTransferOutcome, applyWalletWithdrawalTransferOutcome } from "./batch-processor";
import { sendNotification, sendUntrackedSms } from "@/lib/notifications/send-notification";
import { buildAlertSms, shortRef, type AlertDetails } from "@/lib/notifications/templates";
import { formatNaira } from "@/lib/utils";
import { isAgentDriverRemittanceAlertEnabled } from "@/lib/config/portal-access";
import type { Prisma } from "@prisma/client";

type PaystackEventData = Record<string, unknown>;

interface PaystackWebhookPayload {
  event: string;
  data: PaystackEventData;
}

/**
 * Stores the raw webhook payload before anything else happens. The unique
 * constraint on providerRef is the idempotency guarantee: if Paystack
 * retries a delivery (which it does, by design, until it gets a 200), the
 * second insert throws P2002 and the caller treats it as an already-seen
 * event rather than double-processing a payment.
 */
export async function recordProviderTransaction(payload: PaystackWebhookPayload) {
  const providerRef = String(payload.data.reference ?? payload.data.id);

  try {
    return await prisma.providerTransaction.create({
      data: {
        provider: "paystack",
        providerRef,
        eventType: payload.event,
        rawPayload: payload as unknown as Prisma.InputJsonValue,
        status: "RECEIVED",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null; // already recorded, this is a duplicate delivery
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Interprets a stored ProviderTransaction. Only ever called after
 * recordProviderTransaction has successfully inserted the row, so this
 * never runs twice for the same Paystack event.
 */
export async function processPaystackEvent(providerTransactionId: string, payload: PaystackWebhookPayload) {
  switch (payload.event) {
    case "charge.success":
      await handleChargeSuccess(providerTransactionId, payload.data);
      break;
    case "transfer.success":
    case "transfer.failed":
    case "transfer.reversed":
      await handleTransferUpdate(providerTransactionId, payload.event, payload.data);
      break;
    default:
      await prisma.providerTransaction.update({
        where: { id: providerTransactionId },
        data: { status: "PROCESSED", processedAt: new Date() },
      });
  }
}

/**
 * A charge.success against one of our Dedicated Virtual Accounts is a
 * remittance from an agent or driver. We identify who paid by the Paystack
 * customer code on the charge, then apply the amount against that
 * collector's vehicle's earliest unpaid schedule entry. Staff can re-allocate
 * from the admin console afterward if this default guess is wrong, this
 * is a starting allocation, not a final, unchangeable one.
 */
async function handleChargeSuccess(providerTransactionId: string, data: PaystackEventData) {
  const customer = data.customer as { customer_code?: string } | undefined;
  const customerCode = customer?.customer_code;
  const amountNaira = koboToNaira(data.amount as number);

  if (!customerCode) {
    await markUnmatched(providerTransactionId);
    return;
  }

  const agent = await prisma.agent.findUnique({ where: { paystackCustomerCode: customerCode } });
  const driver = agent ? null : await prisma.driver.findUnique({ where: { paystackCustomerCode: customerCode } });
  // Module 41: an investor's own Dedicated Virtual Account only ever
  // receives self-service deposits, never a remittance, only checked once
  // neither an agent nor a driver matches, same customer-code namespace,
  // never both at once.
  const investor =
    agent || driver ? null : await prisma.investorProfile.findUnique({ where: { paystackCustomerCode: customerCode } });

  if (investor) {
    await handleInvestorDeposit(providerTransactionId, investor, amountNaira);
    return;
  }

  if (!agent && !driver) {
    await markUnmatched(providerTransactionId);
    return;
  }

  const vehicleId = driver
    ? (await prisma.driver.findUnique({ where: { id: driver.id }, select: { currentVehicle: { select: { id: true } } } }))
        ?.currentVehicle?.id
    : undefined;

  const scheduleEntry = vehicleId ? await findEarliestUnpaidScheduleEntry(vehicleId) : null;

  // Captured inside the transaction below so the notification built after
  // it can reference this exact PaymentTransaction (shortRef below), the
  // same id already shown to staff in the admin console's own ledger view.
  let paymentTransactionId = "";

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const paymentTransaction = await tx.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "AGENT_REMITTANCE",
        amount: amountNaira,
        status: scheduleEntry ? "ALLOCATED" : "RECORDED",
        providerTransactionId,
        agentId: agent?.id,
        driverId: driver?.id,
      },
    });
    paymentTransactionId = paymentTransaction.id;

    if (scheduleEntry) {
      await tx.paymentAllocation.create({
        data: {
          paymentTransactionId: paymentTransaction.id,
          scheduleEntryId: scheduleEntry.id,
          amount: amountNaira,
        },
      });

      const newAmountPaid = Number(scheduleEntry.amountPaid) + amountNaira;
      await tx.paymentScheduleEntry.update({
        where: { id: scheduleEntry.id },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid >= Number(scheduleEntry.expectedAmount) ? "PAID" : "PARTIALLY_PAID",
        },
      });

      await tx.investmentContract.update({
        where: { id: scheduleEntry.contractId },
        data: { totalPaidToInvestor: { increment: amountNaira } },
      });
    }

    await tx.providerTransaction.update({
      where: { id: providerTransactionId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  });

  // Deliberately outside the transaction above, same reasoning as
  // batch-processor.ts's own payout notifications: a $transaction
  // callback must never do I/O that isn't the database itself, and
  // sendNotification/sendUntrackedSms never throw, a failed alert must
  // never make an otherwise-successfully-processed remittance look
  // unprocessed. An agent always has a User (Agent.userId is required),
  // so sendNotification always has somewhere to send this. A driver
  // might not (Driver.userId is optional, most drivers never get app
  // access), sendUntrackedSms is the fallback for that case, see its own
  // doc comment for why that send cannot be tracked as a Notification
  // row the way every other one in this app is.
  const depositMessage = `${formatNaira(amountNaira)} was received into your collection account.`;
  // Module 53: no running balance to report here — an agent/driver's
  // dedicated virtual account is swept by Paystack, not a ledger balance
  // this app tracks, so `balance` is left out entirely rather than guessed.
  const alert: AlertDetails = {
    kind: "CREDIT",
    amount: amountNaira,
    reference: shortRef(paymentTransactionId, "RMT-"),
    desc: "Collection account remittance",
  };
  if (isAgentDriverRemittanceAlertEnabled()) {
    if (agent) {
      await sendNotification({
        userId: agent.userId,
        type: "remittance_received",
        title: "Remittance received",
        body: depositMessage,
        channels: ["EMAIL", "SMS"],
        alert,
      });
    } else if (driver) {
      if (driver.userId) {
        await sendNotification({
          userId: driver.userId,
          type: "remittance_received",
          title: "Remittance received",
          body: depositMessage,
          channels: ["SMS"],
          alert,
        });
      } else if (driver.phone) {
        await sendUntrackedSms(driver.phone, buildAlertSms(alert));
      }
    }
  }
}

/**
 * A charge.success against an investor's own Dedicated Virtual Account
 * (Module 41) is a self-service deposit, not a remittance, there is no
 * schedule entry to allocate against the way agent/driver remittances
 * settle a contract, this credits their wallet directly instead. Safe to
 * do without a staff approval gate for the same reason PAYOUT_HELD
 * already is, see WalletTransactionSource.DEPOSIT's schema comment:
 * Paystack has already confirmed real money moved, this only records
 * that, it is not the system deciding to move anything on its own.
 * depositIntent/depositIntentVehicleType are snapshotted from the
 * investor's current standing preference (InvestorProfile.depositIntent)
 * at the moment this webhook fires, so a later change to that preference
 * never rewrites what an already-processed deposit was actually for.
 * Choosing VEHICLE_PURCHASE never creates a contract by itself, it only
 * flags the deposit so /admin/wallet/funding surfaces it for a staff
 * member to act on quickly, see getWalletFundingCandidates in
 * lib/data/wallet.ts, the same manual "fund a vehicle from wallet"
 * decision staff already make today for any wallet balance.
 */
async function handleInvestorDeposit(
  providerTransactionId: string,
  investor: NonNullable<Awaited<ReturnType<typeof prisma.investorProfile.findUnique>>>,
  amountNaira: number
) {
  const newBalance = Number(investor.walletBalance) + amountNaira;
  let paymentTransactionId = "";

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const paymentTransaction = await tx.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "INVESTOR_FUNDING",
        amount: amountNaira,
        status: "RECORDED",
        providerTransactionId,
        investorId: investor.id,
      },
    });
    paymentTransactionId = paymentTransaction.id;

    await tx.investorProfile.update({
      where: { id: investor.id },
      data: { walletBalance: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        investorId: investor.id,
        type: "CREDIT",
        source: "DEPOSIT",
        amount: amountNaira,
        balanceAfter: newBalance,
        paymentTransactionId: paymentTransaction.id,
        depositIntent: investor.depositIntent,
        depositIntentVehicleType: investor.depositIntent === "VEHICLE_PURCHASE" ? investor.depositIntentVehicleType : null,
      },
    });

    await tx.providerTransaction.update({
      where: { id: providerTransactionId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
  });

  // Deliberately outside the transaction above, same reasoning as
  // handleChargeSuccess's own agent/driver notification: a $transaction
  // callback must never do I/O that isn't the database itself, and a
  // failed alert must never make an otherwise-successfully-processed
  // deposit look unprocessed. An investor always has a User
  // (InvestorProfile.userId is required), so there is always somewhere to
  // send this.
  const intentNote =
    investor.depositIntent === "VEHICLE_PURCHASE"
      ? " You flagged this toward a new vehicle purchase, our team will be in touch to set it up."
      : "";
  await sendNotification({
    userId: investor.userId,
    type: "investor_deposit_received",
    title: "Deposit received",
    body: `${formatNaira(amountNaira)} was received into your wallet.${intentNote}`,
    channels: ["EMAIL", "SMS"],
    alert: {
      kind: "CREDIT",
      amount: amountNaira,
      reference: shortRef(paymentTransactionId, "DEP-"),
      desc: investor.depositIntent === "VEHICLE_PURCHASE" ? "Wallet deposit — vehicle purchase" : "Wallet deposit",
      balance: newBalance,
      balanceLabel: "Wallet balance now",
    },
  });
}

/**
 * Exported so lib/actions/reconciliation.ts can apply the exact same
 * "which schedule entry does this payment land on" rule when staff
 * manually match an unmatched transaction to a vehicle, this is the one
 * place that rule is defined.
 */
export async function findEarliestUnpaidScheduleEntry(vehicleId: string) {
  const contract = await prisma.investmentContract.findFirst({
    where: { vehicleId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (!contract) return null;

  return prisma.paymentScheduleEntry.findFirst({
    where: { contractId: contract.id, status: { in: ["UPCOMING", "DUE", "PARTIALLY_PAID"] } },
    orderBy: { dueDate: "asc" },
  });
}

/**
 * A transfer event updates whichever record initiated it, identified by
 * the reference we generated when we called initiateTransfer (see
 * lib/payments/paystack-provider.ts): a PaymentBatchItem for a weekly
 * payout, or a WalletWithdrawal for a wallet withdrawal (see
 * approveWalletWithdrawal in lib/actions/wallet.ts, both call
 * initiateTransfer with reference: <that record's own id>). The actual
 * ledger write for a batch item goes through applyTransferOutcome; a
 * wallet withdrawal's ledger entry already happened synchronously at
 * approval time, applyWalletWithdrawalTransferOutcome only confirms the
 * transfer status. Both are idempotent, so a transfer that already
 * resolved synchronously is not double-processed when this webhook
 * arrives afterward.
 */
async function handleTransferUpdate(providerTransactionId: string, event: string, data: PaystackEventData) {
  const reference = data.reference as string;
  const outcome = {
    status: (event === "transfer.success" ? "SUCCESS" : "FAILED") as "SUCCESS" | "FAILED",
    transferCode: data.transfer_code as string | undefined,
    failureReason: event === "transfer.success" ? undefined : ((data.gateway_response as string | undefined) ?? event),
    providerTransactionId,
  };

  const batchItem = await prisma.paymentBatchItem.findFirst({ where: { id: reference } });
  if (batchItem) {
    await applyTransferOutcome(batchItem.id, outcome);
    await prisma.providerTransaction.update({
      where: { id: providerTransactionId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return;
  }

  const walletWithdrawal = await prisma.walletWithdrawal.findFirst({ where: { id: reference } });
  if (walletWithdrawal) {
    await applyWalletWithdrawalTransferOutcome(walletWithdrawal.id, outcome);
    await prisma.providerTransaction.update({
      where: { id: providerTransactionId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    return;
  }

  await markUnmatched(providerTransactionId);
}

async function markUnmatched(providerTransactionId: string) {
  await prisma.providerTransaction.update({
    where: { id: providerTransactionId },
    data: { status: "UNMATCHED" },
  });
}
