import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { PaymentProviderAdapter, VerifiedPaymentEvent } from './payment-provider.contract';

type CanonicalEvent = {
  id: string;
  type: 'payment.settled' | 'payment.failed' | 'payment.refunded' | 'payment.reversed';
  data: {
    paymentId: string;
    reference: string;
    amountMinor: number;
    currency: string;
    occurredAt?: string;
  };
};

/**
 * VELT's canonical HMAC webhook adapter for a gateway that explicitly agrees
 * to this wire format. This is NOT a plug-and-play adapter for any named PSP:
 * each real provider needs its documented signature/parser implementation.
 */
export class CanonicalHmacPaymentAdapter implements PaymentProviderAdapter {
  readonly providerId: string;
  constructor(private readonly secret: string, providerId: string, private readonly toleranceSeconds = 300) {
    if (!secret || secret.length < 32) throw new Error('Webhook secret must contain at least 32 characters');
    this.providerId = providerId;
  }

  async verifyWebhook(rawBody: Buffer, signature: string, timestamp?: string): Promise<boolean> {
    if (!timestamp || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
    const seconds = Math.floor(Date.now() / 1000);
    const supplied = Number(timestamp);
    if (!Number.isSafeInteger(supplied) || Math.abs(seconds - supplied) > this.toleranceSeconds) return false;
    const expected = createHmac('sha256', this.secret).update(timestamp).update('.').update(rawBody).digest();
    const actual = Buffer.from(signature, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async parseWebhook(rawBody: Buffer): Promise<VerifiedPaymentEvent> {
    const event = JSON.parse(rawBody.toString('utf8')) as CanonicalEvent;
    if (!event || typeof event.id !== 'string' || !event.id || !event.data ||
        !['payment.settled', 'payment.failed', 'payment.refunded', 'payment.reversed'].includes(event.type)) {
      throw new Error('Invalid canonical payment event');
    }
    const { paymentId, reference, amountMinor, currency } = event.data;
    if (typeof paymentId !== 'string' || !paymentId || typeof reference !== 'string' || !reference ||
        !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || typeof currency !== 'string' || !/^[A-Z]{3}$/i.test(currency)) {
      throw new Error('Invalid canonical payment event fields');
    }
    const status = event.type === 'payment.settled' ? 'settled'
      : event.type === 'payment.failed' ? 'failed'
      : event.type === 'payment.refunded' ? 'refunded' : 'reversed';
    return {
      provider: this.providerId, providerEventId: event.id, providerPaymentId: paymentId,
      merchantReference: reference, amountMinor, currency: currency.toUpperCase(),
      status, occurredAt: event.data.occurredAt ? new Date(event.data.occurredAt) : new Date(),
      rawPayloadHash: createHash('sha256').update(rawBody).digest('hex'),
    };
  }

  async createDepositIntent(): Promise<never> {
    throw new Error('Canonical webhook adapter does not create provider payment intents; configure a provider API adapter.');
  }
  async requestPayout(): Promise<never> {
    throw new Error('Canonical webhook adapter does not execute payouts; configure a provider API adapter.');
  }
}

export const getConfiguredWebhookAdapter = () => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  const providerId = process.env.PAYMENT_PROVIDER_ID;
  if (!secret || !providerId) return null;
  return new CanonicalHmacPaymentAdapter(secret, providerId);
};
