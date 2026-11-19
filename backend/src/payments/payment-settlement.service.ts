import PaymentIntent from '../models/PaymentIntent';
import PaymentEvent from '../models/PaymentEvent';
import { getOrCreateLedgerAccount, postLedgerEntry } from '../services/ledger.service';
import { VerifiedPaymentEvent } from './payment-provider.contract';

export async function processVerifiedPaymentEvent(event: VerifiedPaymentEvent) {
  let stored = await PaymentEvent.findOne({ provider: event.provider, providerEventId: event.providerEventId });
  if (stored?.processingStatus === 'processed') return { duplicate: true, processed: true };

  if (!stored) {
    try {
      stored = await PaymentEvent.create({
        provider: event.provider, providerEventId: event.providerEventId,
        providerPaymentId: event.providerPaymentId, merchantReference: event.merchantReference,
        amountMinor: event.amountMinor, currency: event.currency, eventStatus: event.status,
        payloadHash: event.rawPayloadHash, verificationStatus: 'verified', processingStatus: 'received',
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      stored = await PaymentEvent.findOne({ provider: event.provider, providerEventId: event.providerEventId });
      if (stored?.processingStatus === 'processed') return { duplicate: true, processed: true };
    }
  } else {
    if (stored.payloadHash !== event.rawPayloadHash || stored.merchantReference !== event.merchantReference) {
      stored.verificationStatus = 'rejected';
      stored.processingStatus = 'failed';
      await stored.save();
      throw new Error('Provider event ID was reused with different content');
    }
  }
  if (!stored) throw new Error('Unable to persist provider event');

  const intent = await PaymentIntent.findOne({ merchantReference: event.merchantReference, provider: event.provider });
  if (!intent) throw new Error('Payment intent not found; event held for reconciliation');
  if (intent.currency !== event.currency ||
      (event.status === 'settled' && intent.amountMinor !== event.amountMinor) ||
      (event.status === 'failed' && intent.amountMinor !== event.amountMinor) ||
      ((event.status === 'refunded' || event.status === 'reversed') &&
        (event.amountMinor > intent.amountMinor - (intent.refundedMinor || 0) || event.amountMinor <= 0))) {
    intent.status = 'review';
    await intent.save();
    stored.processingStatus = 'failed';
    await stored.save();
    throw new Error('Payment event amount or currency does not match the remaining intent balance');
  }
  if (event.providerPaymentId && intent.providerPaymentId && intent.providerPaymentId !== event.providerPaymentId) {
    stored.processingStatus = 'failed';
    await stored.save();
    throw new Error('Provider payment reference mismatch');
  }

  if (event.status === 'settled') {
    if (intent.status === 'settled') {
      stored.processingStatus = 'processed'; await stored.save();
      return { duplicate: true, processed: true };
    }
    if (intent.status !== 'pending') throw new Error(`Cannot settle intent in state ${intent.status}`);
    const wallet = await getOrCreateLedgerAccount({
      ownerType: 'user', ownerId: String(intent.userId), accountType: 'player_wallet', currency: intent.currency,
    });
    const clearing = await getOrCreateLedgerAccount({
      ownerType: 'system', ownerId: event.provider, accountType: 'payment_clearing', currency: intent.currency,
    });
    await postLedgerEntry({
      lines: [
        { accountId: String(clearing._id), direction: 'debit', amountMinor: event.amountMinor },
        { accountId: String(wallet._id), direction: 'credit', amountMinor: event.amountMinor },
      ],
      currency: intent.currency, idempotencyKey: `payment:${event.provider}:${event.providerEventId}`,
      reference: event.merchantReference, description: 'Verified payment settlement',
      metadata: { provider: event.provider, providerEventId: event.providerEventId, providerPaymentId: event.providerPaymentId },
    });
    intent.providerPaymentId = event.providerPaymentId;
    intent.status = 'settled';
    await intent.save();
  } else if (event.status === 'refunded' || event.status === 'reversed') {
    if (intent.status !== 'settled') throw new Error(`Cannot refund or reverse intent in state ${intent.status}`);
    const wallet = await getOrCreateLedgerAccount({
      ownerType: 'user', ownerId: String(intent.userId), accountType: 'player_wallet', currency: intent.currency,
    });
    const clearing = await getOrCreateLedgerAccount({
      ownerType: 'system', ownerId: event.provider, accountType: 'payment_clearing', currency: intent.currency,
    });
    await postLedgerEntry({
      lines: [
        { accountId: String(wallet._id), direction: 'debit', amountMinor: event.amountMinor },
        { accountId: String(clearing._id), direction: 'credit', amountMinor: event.amountMinor },
      ],
      currency: intent.currency, idempotencyKey: `payment:${event.provider}:${event.providerEventId}`,
      reference: event.merchantReference, description: event.status === 'refunded' ? 'Verified payment refund' : 'Verified payment reversal',
      metadata: { provider: event.provider, providerEventId: event.providerEventId, providerPaymentId: event.providerPaymentId },
    });
    intent.refundedMinor = (intent.refundedMinor || 0) + event.amountMinor;
    intent.status = intent.refundedMinor >= intent.amountMinor ? 'refunded' : 'settled';
    await intent.save();
  } else if (event.status === 'failed') {
    if (intent.status === 'pending') intent.status = 'failed';
    await intent.save();
  }

  stored.processingStatus = 'processed';
  await stored.save();
  return { duplicate: false, processed: true };
}
