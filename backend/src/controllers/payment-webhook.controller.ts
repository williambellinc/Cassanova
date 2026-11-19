import { Request, Response } from 'express';
import { paymentProviders } from '../payments/payment-provider.contract';
import { processVerifiedPaymentEvent } from '../payments/payment-settlement.service';

export const receivePaymentWebhook = async (req: Request, res: Response) => {
  const providerId = req.params.provider;
  const adapter = providerId ? paymentProviders.get(providerId) : null;
  if (!adapter) return res.status(503).json({ message: 'No payment webhook provider is configured' });
  if (!Buffer.isBuffer(req.body)) return res.status(400).json({ message: 'Raw webhook body is required' });
  const signature = (providerId === 'flutterwave' ? req.header('verif-hash') : req.header('paystack-signature') || req.header('x-paystack-signature')) || '';
  const timestamp = req.header('x-velt-timestamp') || '';
  try {
    const verified = await adapter.verifyWebhook(req.body, signature, timestamp);
    if (!verified) return res.status(401).json({ message: 'Invalid webhook signature or timestamp' });
    const event = await adapter.parseWebhook(req.body);
    const result = await processVerifiedPaymentEvent(event);
    return res.status(200).json({ received: true, ...result });
  } catch (error) {
    console.error('Payment webhook processing error:', error);
    return res.status(202).json({ received: true, queuedForReconciliation: true });
  }
};
