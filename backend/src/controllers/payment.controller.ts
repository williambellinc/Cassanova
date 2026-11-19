import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AuthRequest } from '../middleware/auth.middleware';
import PaymentIntent from '../models/PaymentIntent';
import User from '../models/User';
import { paymentProviders } from '../payments/payment-provider.contract';

export const createDepositIntent = async (req: AuthRequest, res: Response) => {
  if (!req.userId) return res.status(401).json({ message: 'Authentication required' });
  const providerId = String(req.body?.provider || process.env.PAYMENT_PROVIDER_ID || '');
  const adapter = providerId ? paymentProviders.get(providerId) : undefined;
  if (!providerId || !adapter) return res.status(503).json({ message: 'No contracted payment provider API adapter is configured' });

  const amountMinor = Number(req.body?.amountMinor);
  const currency = String(req.body?.currency || '').toUpperCase();
  const returnUrl = process.env.PAYMENT_RETURN_URL;
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) return res.status(400).json({ message: 'amountMinor must be a positive integer' });
  if (!/^[A-Z]{3}$/.test(currency)) return res.status(400).json({ message: 'A valid currency is required' });
  if (!returnUrl || (process.env.NODE_ENV === 'production' && !returnUrl.startsWith('https://'))) {
    return res.status(503).json({ message: 'A secure payment return URL is not configured' });
  }

  const customer = await User.findById(req.userId).select('email isVerified').lean();
  if (!customer?.email || !customer.isVerified) return res.status(400).json({ message: 'A verified customer email is required for checkout' });

  const merchantReference = `velt_dep_${randomUUID()}`;
  const intent = await PaymentIntent.create({
    userId: req.userId, provider: providerId, merchantReference, amountMinor, currency, status: 'pending',
  });
  try {
    const providerIntent = await adapter.createDepositIntent({ merchantReference, amountMinor, currency, returnUrl, customerEmail: customer.email });
    intent.providerPaymentId = providerIntent.providerPaymentId;
    await intent.save();
    return res.status(201).json({
      merchantReference, providerPaymentId: providerIntent.providerPaymentId,
      redirectUrl: providerIntent.redirectUrl, amountMinor, currency, status: intent.status,
    });
  } catch (error) {
    intent.status = 'failed';
    await intent.save();
    console.error('Payment intent creation failed:', error);
    return res.status(502).json({ message: 'Payment provider could not create a deposit intent' });
  }
};
