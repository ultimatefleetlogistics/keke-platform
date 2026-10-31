import { paystackRequest, nairaToKobo, koboToNaira } from "./paystack-client";
import type { PaymentProvider, CollectionAccount, TransferRecipient, TransferResult } from "./provider";

/**
 * Real Paystack implementation of PaymentProvider. Endpoint shapes here
 * follow Paystack's documented API (developers.paystack.co). Nothing in
 * this file is guessed, if a future Paystack feature is needed and its
 * exact request shape has not been confirmed against their docs, that is
 * a reason to stop and check, not to improvise a plausible-looking body.
 */
export class PaystackProvider implements PaymentProvider {
  async createCollectionAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<CollectionAccount> {
    const customer = await paystackRequest<{ customer_code: string }>("/customer", {
      method: "POST",
      body: {
        email: params.email,
        first_name: params.firstName,
        last_name: params.lastName,
        phone: params.phone,
      },
    });

    // "test-bank" is Paystack's documented preferred_bank value for test
    // mode. In live mode, drop preferred_bank and Paystack assigns from
    // whichever partner bank is available, or call /dedicated_account/available_providers
    // first if a specific bank needs to be offered to the customer.
    const account = await paystackRequest<{
      account_number: string;
      bank: { name: string };
    }>("/dedicated_account", {
      method: "POST",
      body: {
        customer: customer.customer_code,
        preferred_bank: process.env.PAYSTACK_DVA_PREFERRED_BANK ?? "test-bank",
      },
    });

    return {
      paystackCustomerCode: customer.customer_code,
      accountNumber: account.account_number,
      bankName: account.bank.name,
    };
  }

  async createTransferRecipient(params: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<TransferRecipient> {
    const recipient = await paystackRequest<{ recipient_code: string }>("/transferrecipient", {
      method: "POST",
      body: {
        type: "nuban",
        name: params.accountName,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: "NGN",
      },
    });

    return { recipientCode: recipient.recipient_code };
  }

  async initiateTransfer(params: {
    amountNaira: number;
    recipientCode: string;
    reason: string;
    reference: string;
  }): Promise<TransferResult> {
    const transfer = await paystackRequest<{
      transfer_code: string;
      reference: string;
      status: string;
    }>("/transfer", {
      method: "POST",
      body: {
        source: "balance",
        amount: nairaToKobo(params.amountNaira),
        recipient: params.recipientCode,
        reason: params.reason,
        reference: params.reference,
      },
    });

    const status =
      transfer.status === "success" ? "success" : transfer.status === "failed" ? "failed" : "pending";

    return { transferCode: transfer.transfer_code, reference: transfer.reference, status };
  }

  async getBalance(): Promise<{ balanceNaira: number; currency: string }> {
    const balances = await paystackRequest<Array<{ balance: number; currency: string }>>("/balance");
    const ngn = balances.find((b) => b.currency === "NGN") ?? balances[0];
    return { balanceNaira: koboToNaira(ngn.balance), currency: ngn.currency };
  }

  async listBanks(): Promise<Array<{ name: string; code: string }>> {
    const banks = await paystackRequest<Array<{ name: string; code: string }>>(
      "/bank?country=nigeria&currency=NGN&perPage=100"
    );
    // Paystack's real /bank list is known to repeat the same `code` across
    // more than one entry (different channels/products under one bank
    // sharing an NIP/CBN code). Every caller renders this list straight
    // into a <select>, keyed on `code`, so an un-deduped list produced
    // duplicate React keys and duplicate options a user could pick
    // between with no visible difference. Dedup once here, keeping the
    // first entry for a given code, so all callers get a clean list.
    const seen = new Set<string>();
    const deduped: Array<{ name: string; code: string }> = [];
    for (const b of banks) {
      if (seen.has(b.code)) continue;
      seen.add(b.code);
      deduped.push({ name: b.name, code: b.code });
    }
    return deduped;
  }

  async resolveBankAccount(params: { accountNumber: string; bankCode: string }): Promise<{ accountName: string }> {
    try {
      const result = await paystackRequest<{ account_name: string }>(
        `/bank/resolve?account_number=${encodeURIComponent(params.accountNumber)}&bank_code=${encodeURIComponent(params.bankCode)}`
      );
      return { accountName: result.account_name };
    } catch (error) {
      // 2026-10-31: paystackRequest's own thrown message includes the raw
      // request path and query string (e.g. "Paystack request failed
      // (/bank/resolve?account_number=...&bank_code=...): Could not
      // resolve account name..."), and every caller of this function
      // (createInvestor, updateInvestorBankDetails,
      // requestPayoutDetailsChange) passed that straight through into a
      // staff/investor-facing `{ error }` message. Surfaced directly to a
      // real admin during live testing, where it read like an exposed
      // debug/stack-trace line rather than a real product error — worth
      // fixing here once rather than at each of the three call sites,
      // since they all reuse this same function. The raw detail still
      // reaches Vercel's function logs for whoever's actually debugging a
      // real failure; everyone else sees one clean, actionable sentence.
      // Note (confirmed live, 2026-10-31): this call can also fail
      // transiently even for a perfectly real, valid account — a retry
      // with the exact same account number and bank resolved cleanly
      // seconds later — so this message says "try again" deliberately,
      // not "this account doesn't exist."
      console.error("resolveBankAccount failed:", error);
      throw new Error(
        "Could not verify that account number with the selected bank. Double-check the account number and bank, then try again — this step occasionally fails on a first attempt even for a valid account."
      );
    }
  }
}

/**
 * One-time setup helpers, not part of the PaymentProvider interface
 * because they are account-level configuration, not something the app
 * calls on every request. Run once from an admin action after confirming
 * with the account owner, see docs/architecture/paystack.md.
 */
export async function requestDisableTransferOtp() {
  return paystackRequest("/transfer/disable_otp", { method: "POST" });
}

export async function finalizeDisableTransferOtp(otp: string) {
  return paystackRequest("/transfer/disable_otp_finalize", { method: "POST", body: { otp } });
}
