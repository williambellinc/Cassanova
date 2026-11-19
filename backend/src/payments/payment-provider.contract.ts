/**
 * Provider-neutral payment contract. No provider is enabled by this module.
 * Implementations must verify webhook signatures against the exact raw request
 * bytes, enforce timestamp/replay windows, and map provider events to immutable
 * provider references before any settlement service can post ledger entries.
 */
export type PaymentEventStatus = 'authorised' | 'captured' | 'settled' | 'failed' | 'refunded' | 'reversed';

export interface VerifiedPaymentEvent {
  provider: string;
  providerEventId: string;
  providerPaymentId: string;
  merchantReference: string;
  amountMinor: number;
  currency: string;
  status: PaymentEventStatus;
  occurredAt: Date;
  rawPayloadHash: string;
}

export interface PaymentProviderAdapter {
  readonly providerId: string;
  verifyWebhook(rawBody: Buffer, signature: string, timestamp?: string): Promise<boolean>;
  parseWebhook(rawBody: Buffer): Promise<VerifiedPaymentEvent>;
  createDepositIntent(input: {
    merchantReference: string;
    amountMinor: number;
    currency: string;
    returnUrl: string;
  }): Promise<{ providerPaymentId: string; redirectUrl?: string }>;
  requestPayout(input: {
    merchantReference: string;
    amountMinor: number;
    currency: string;
    beneficiaryReference: string;
  }): Promise<{ providerPayoutId: string }>;
}

/** Empty by design: configure only after contracting and testing a real provider. */
export const paymentProviders: ReadonlyMap<string, PaymentProviderAdapter> = new Map();
