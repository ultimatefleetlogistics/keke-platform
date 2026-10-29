/**
 * Every Paystack-specific detail is behind this interface. Domain code
 * (contract logic, batch payouts, remittance handling) talks to
 * PaymentProvider, never to Paystack's API shapes directly. This is what
 * lets a second rail (a bank's own API, for example) be added later
 * without touching anything upstream of getPaymentProvider().
 */
export interface CollectionAccount {
  paystackCustomerCode: string;
  accountNumber: string;
  bankName: string;
}

export interface TransferRecipient {
  recipientCode: string;
}

export interface TransferResult {
  transferCode: string;
  reference: string;
  status: "success" | "pending" | "failed";
}

export interface PaymentProvider {
  /** Creates a dedicated virtual account for an agent or driver to collect remittances into. */
  createCollectionAccount(params: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<CollectionAccount>;

  /** Registers an investor's bank account so they can receive payouts. */
  createTransferRecipient(params: {
    accountName: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<TransferRecipient>;

  /** Initiates a single payout from the manager's balance to an investor. */
  initiateTransfer(params: {
    amountNaira: number;
    recipientCode: string;
    reason: string;
    reference: string;
  }): Promise<TransferResult>;

  /** The manager's current Paystack balance, checked before running a batch. */
  getBalance(): Promise<{ balanceNaira: number; currency: string }>;

  /** Every bank Paystack supports payouts to, for the investor payout details dropdown. */
  listBanks(): Promise<Array<{ name: string; code: string }>>;

  /** Confirms an account number actually belongs to the named bank and returns the account name on file, so an investor can't typo their payout details into an account that doesn't exist (or isn't theirs) without it being caught before the first payout attempt. */
  resolveBankAccount(params: { accountNumber: string; bankCode: string }): Promise<{ accountName: string }>;
}

let cachedProvider: PaymentProvider | null = null;

export async function getPaymentProvider(): Promise<PaymentProvider> {
  if (!cachedProvider) {
    const { PaystackProvider } = await import("./paystack-provider");
    cachedProvider = new PaystackProvider();
  }
  return cachedProvider;
}
