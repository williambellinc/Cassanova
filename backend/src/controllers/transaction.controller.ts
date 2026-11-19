import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Transaction from '../models/Transaction';
import User from '../models/User';

export const getUserTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { type, status } = req.query;
    const filter: Record<string, unknown> = { userId: req.userId };

    if (type) filter.type = type;
    if (status) filter.status = status;

    const transactions = await Transaction.find(filter).sort({ createdAt: -1 }).limit(50);
    res.json(transactions);
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

/**
 * Creates a pending deposit request only.
 *
 * A request is not evidence that a payment settled. The user's spendable balance
 * must only be credited by a future, authenticated provider-settlement handler
 * after signature verification, idempotency checks and reconciliation.
 */
export const createDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const { amount, paymentMethod } = req.body ?? {};

    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid deposit amount' });
    }

    if (typeof paymentMethod !== 'string' || paymentMethod.trim().length === 0 || paymentMethod.length > 64) {
      return res.status(400).json({ message: 'A valid payment method is required' });
    }

    const user = await User.findById(req.userId).select('_id balance');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentBalance = user.balance;
    const transaction = await Transaction.create({
      userId: req.userId,
      type: 'deposit',
      amount,
      status: 'pending',
      paymentMethod: paymentMethod.trim(),
      balanceBefore: currentBalance,
      balanceAfter: currentBalance,
      description: 'Deposit request created; awaiting verified payment settlement',
    });

    return res.status(202).json({
      message: 'Deposit request recorded. No funds have been credited.',
      transaction,
      newBalance: currentBalance,
    });
  } catch (error) {
    console.error('Deposit request error:', error);
    return res.status(500).json({ message: 'Unable to create deposit request' });
  }
};

/**
 * Withdrawals remain fail-closed until payout execution, reservation,
 * settlement callbacks and reversal/reconciliation handling are implemented.
 */
export const createWithdrawal = async (_req: AuthRequest, res: Response) => {
  return res.status(503).json({
    message: 'Withdrawals are temporarily unavailable while secure payout processing is being implemented.',
    code: 'PAYOUTS_NOT_CONFIGURED',
  });
};
