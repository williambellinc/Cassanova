import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import PaymentEvent from '../models/PaymentEvent';
import PaymentIntent from '../models/PaymentIntent';
import LedgerAccount from '../models/LedgerAccount';

export const getPaymentReconciliation = async (_req: AuthRequest, res: Response) => {
  try {
    const [unprocessedEvents, openIntents, clearingAccounts] = await Promise.all([
      PaymentEvent.find({ processingStatus: { $ne: 'processed' } }).sort({ receivedAt: 1 }).limit(100).lean(),
      PaymentIntent.find({ status: { $in: ['pending', 'review'] } }).sort({ createdAt: 1 }).limit(100).lean(),
      LedgerAccount.find({ ownerType: 'system', accountType: 'payment_clearing' }).select('ownerId currency balanceMinor status').lean(),
    ]);
    return res.json({
      generatedAt: new Date().toISOString(),
      unprocessedEventCount: unprocessedEvents.length,
      openIntentCount: openIntents.length,
      unprocessedEvents,
      openIntents,
      providerClearingBalances: clearingAccounts,
      note: 'This is an operational exception report. Reconcile provider statements and bank settlement files independently.',
    });
  } catch (error) {
    console.error('Payment reconciliation report failed:', error);
    return res.status(500).json({ message: 'Unable to generate payment reconciliation report' });
  }
};
