import { createHash, timingSafeEqual } from 'crypto';
import { PaymentProviderAdapter, VerifiedPaymentEvent } from './payment-provider.contract';

/**
 * Flutterwave v3 Standard checkout adapter.
 * Checkout is created server-side and every webhook transaction is re-verified
 * against Flutterwave before the event is allowed into VELT's settlement ledger.
 */
export class FlutterwaveV3Adapter implements PaymentProviderAdapter {
  readonly providerId = 'flutterwave';
  private readonly baseUrl = 'https://api.flutterwave.com/v3';

  constructor(private readonly secretKey: string, private readonly webhookSecretHash: string) {
    if (!secretKey || !webhookSecretHash) throw new Error('Flutterwave secret key and webhook secret hash are required');
  }

  async verifyWebhook(_rawBody: Buffer, signature: string): Promise<boolean> {
    if (!signature || signature.length !== this.webhookSecretHash.length) return false;
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(this.webhookSecretHash);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  async createDepositIntent(input: {
    merchantReference: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
    customerEmail: string;
  }): Promise<{ providerPaymentId: string; redirectUrl?: string }> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Invalid amountMinor');
    // VELT stores supported two-decimal currencies in minor units. Currency
    // eligibility is separately constrained by the operator's Flutterwave account.
    const twoDecimalCurrencies = new Set(['ZAR', 'NGN', 'GHS', 'KES', 'TZS', 'USD', 'GBP', 'EUR']);
    if (!twoDecimalCurrencies.has(input.currency.toUpperCase())) throw new Error('Currency minor-unit mapping is not configured for this Flutterwave integration');
    const amount = input.amountMinor / 100;
    const response = await fetch(`${this.baseUrl}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx_ref: input.merchantReference,
        amount: amount.toFixed(2),
        currency: input.currency,
        redirect_url: input.returnUrl,
        customer: { email: input.customerEmail },
        customizations: { title: 'VELT Wallet', description: 'Wallet deposit' },
      }),
    });
    const payload = await response.json() as any;
    if (!response.ok || payload?.status !== 'success' || !payload?.data?.link) {
      throw new Error(payload?.message || 'Flutterwave could not initialize checkout');
    }
    return { redirectUrl: payload.data.link };
  }

  async parseWebhook(rawBody: Buffer): Promise<VerifiedPaymentEvent> {
    const event = JSON.parse(rawBody.toString('utf8')) as any;
    const data = event?.data;
    const transactionId = data?.id;
    if (!transactionId || !data?.tx_ref || !data?.currency || !Number.isFinite(Number(data?.amount))) {
      throw new Error('Flutterwave webhook is missing transaction details');
    }

    const verification = await fetch(`${this.baseUrl}/transactions/${encodeURIComponent(String(transactionId))}/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
    });
    const verified = await verification.json() as any;
    if (!verification.ok || verified?.status !== 'success' || !verified?.data) {
      throw new Error('Flutterwave transaction verification failed');
    }
    const transaction = verified.data;
    if (String(transaction.tx_ref) !== String(data.tx_ref) ||
        String(transaction.currency).toUpperCase() !== String(data.currency).toUpperCase() ||
        Number(transaction.amount) < Number(data.amount)) {
      throw new Error('Flutterwave verified transaction does not match webhook');
    }

    const successful = transaction.status === 'successful';
    const failed = transaction.status === 'failed';
    if (!successful && !failed) throw new Error(`Flutterwave transaction is not final: ${transaction.status}`);
    if (!new Set(['ZAR', 'NGN', 'GHS', 'KES', 'TZS', 'USD', 'GBP', 'EUR']).has(String(transaction.currency).toUpperCase())) throw new Error('Unsupported Flutterwave currency minor-unit mapping');
    const amountMinor = Math.round(Number(transaction.amount) * 100);
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Invalid Flutterwave transaction amount');

    return {
      provider: this.providerId,
      providerEventId: `flutterwave:${transactionId}:${transaction.status}`,
      providerPaymentId: String(transactionId),
      merchantReference: String(transaction.tx_ref),
      amountMinor,
      currency: String(transaction.currency).toUpperCase(),
      status: successful ? 'settled' : 'failed',
      occurredAt: transaction.created_at ? new Date(transaction.created_at) : new Date(),
      rawPayloadHash: createHash('sha256').update(rawBody).digest('hex'),
    };
  }

  async requestPayout(input: {
    merchantReference: string;
    amountMinor: number;
    currency: string;
    beneficiaryReference: string;
  }): Promise<{ providerPayoutId: string }> {
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error('Invalid payout amount');
    const twoDecimalCurrencies = new Set(['ZAR', 'NGN', 'GHS', 'KES', 'TZS', 'USD', 'GBP', 'EUR']);
    if (!twoDecimalCurrencies.has(input.currency.toUpperCase())) throw new Error('Currency minor-unit mapping is not configured for this Flutterwave integration');
    if (!/^\\d+$/.test(input.beneficiaryReference)) throw new Error('A Flutterwave beneficiary ID is required');
    const beneficiaryResponse = await fetch(`${this.baseUrl}/beneficiaries/${encodeURIComponent(input.beneficiaryReference)}`, {
      headers: { Authorization: `Bearer ${this.secretKey}` },
    });
    const beneficiaryPayload = await beneficiaryResponse.json() as any;
    const beneficiary = beneficiaryPayload?.data;
    if (!beneficiaryResponse.ok || beneficiaryPayload?.status !== 'success' || !beneficiary?.account_bank || !beneficiary?.account_number) {
      throw new Error('Flutterwave beneficiary lookup failed');
    }
    if (String(beneficiary.currency || '').toUpperCase() !== input.currency.toUpperCase()) {
      throw new Error('Payout currency does not match verified beneficiary currency');
    }
    const transferResponse = await fetch(`${this.baseUrl}/transfers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.secretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_bank: beneficiary.account_bank,
        account_number: beneficiary.account_number,
        beneficiary: Number(input.beneficiaryReference),
        beneficiary_name: beneficiary.beneficiary_name,
        amount: input.amountMinor / 100,
        currency: input.currency,
        reference: input.merchantReference,
        narration: 'VELT approved withdrawal',
      }),
    });
    const transferPayload = await transferResponse.json() as any;
    if (!transferResponse.ok || transferPayload?.status !== 'success' || !transferPayload?.data?.id) {
      throw new Error(transferPayload?.message || 'Flutterwave transfer request failed');
    }
    return { providerPayoutId: String(transferPayload.data.id) };
  }
}
