import mongoose from 'mongoose';
import LedgerAccount, { LedgerAccountType } from '../models/LedgerAccount';
import LedgerJournal from '../models/LedgerJournal';

export class LedgerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export function validateBalancedLines(lines: Array<{ direction: 'debit' | 'credit'; amountMinor: number }>) {
  if (lines.length < 2 || lines.some(line => !Number.isSafeInteger(line.amountMinor) || line.amountMinor <= 0)) {
    throw new LedgerError('A journal requires at least two positive integer lines', 'INVALID_JOURNAL');
  }
  const debits = lines.filter(line => line.direction === 'debit').reduce((sum, line) => sum + line.amountMinor, 0);
  const credits = lines.filter(line => line.direction === 'credit').reduce((sum, line) => sum + line.amountMinor, 0);
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits) || debits !== credits) {
    throw new LedgerError('Journal debits and credits must balance exactly', 'UNBALANCED_JOURNAL');
  }
  return true;
}

export async function getOrCreateLedgerAccount(input: {
  ownerType: 'user' | 'system';
  ownerId: string;
  accountType: LedgerAccountType;
  currency: string;
}) {
  const currency = input.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new LedgerError('Currency must be an ISO-style 3-letter code', 'INVALID_CURRENCY');

  try {
    return await LedgerAccount.findOneAndUpdate(
      { ...input, currency },
      { $setOnInsert: { balanceMinor: 0, status: 'open' } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      const existing = await LedgerAccount.findOne({ ...input, currency });
      if (existing) return existing;
    }
    throw error;
  }
}

/**
 * Atomic, balanced transfer between two ledger accounts.
 * All amounts are integer minor units; callers must never pass floating-point currency.
 * Requires MongoDB replica-set/transaction support. No provider or browser may call
 * this directly; settlement/game services must authenticate their own source events.
 */
export async function postLedgerTransfer(input: {
  debitAccountId: string;
  creditAccountId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  reference: string;
  description: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new LedgerError('Amount must be a positive integer in minor units', 'INVALID_AMOUNT');
  }
  if (!input.idempotencyKey || input.idempotencyKey.length > 160) {
    throw new LedgerError('A bounded idempotency key is required', 'INVALID_IDEMPOTENCY_KEY');
  }
  if (input.debitAccountId === input.creditAccountId) {
    throw new LedgerError('A transfer must use two different accounts', 'INVALID_ACCOUNTS');
  }

  const currency = input.currency.toUpperCase();
  const expectedLines = [\n    { direction: 'debit' as const, amountMinor: input.amountMinor },\n    { direction: 'credit' as const, amountMinor: input.amountMinor },\n  ];\n  validateBalancedLines(expectedLines);\n  const matchesRequest = (entry: any) => entry.currency === currency && entry.reference === input.reference &&\n    entry.lines.length === 2 &&\n    entry.lines.some((line: any) => line.accountId.toString() === input.debitAccountId && line.direction === 'debit' && line.amountMinor === input.amountMinor) &&\n    entry.lines.some((line: any) => line.accountId.toString() === input.creditAccountId && line.direction === 'credit' && line.amountMinor === input.amountMinor);\n  const existing = await LedgerJournal.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (!matchesRequest(existing)) throw new LedgerError('Idempotency key was already used for a different transfer', 'IDEMPOTENCY_CONFLICT');
    return existing;
  }

  const session = await mongoose.startSession();
  let journal: any;
  try {
    await session.withTransaction(async () => {
      const [debit, credit] = await Promise.all([
        LedgerAccount.findById(input.debitAccountId).session(session),
        LedgerAccount.findById(input.creditAccountId).session(session),
      ]);
      if (!debit || !credit) throw new LedgerError('Ledger account not found', 'ACCOUNT_NOT_FOUND');
      if (debit.currency !== currency || credit.currency !== currency) throw new LedgerError('Ledger account currency mismatch', 'CURRENCY_MISMATCH');
      if (debit.status !== 'open' || credit.status !== 'open') throw new LedgerError('Ledger account is not open', 'ACCOUNT_NOT_OPEN');

      const debitResult = await LedgerAccount.updateOne(
        { _id: debit._id, status: 'open', balanceMinor: { $gte: input.amountMinor } },
        { $inc: { balanceMinor: -input.amountMinor } },
        { session }
      );
      if (debitResult.modifiedCount !== 1) throw new LedgerError('Insufficient funds or debit account changed', 'INSUFFICIENT_FUNDS');

      const creditResult = await LedgerAccount.updateOne(
        { _id: credit._id, status: 'open' },
        { $inc: { balanceMinor: input.amountMinor } },
        { session }
      );
      if (creditResult.modifiedCount !== 1) throw new LedgerError('Credit account could not be updated', 'CREDIT_FAILED');

      [journal] = await LedgerJournal.create([{
        idempotencyKey: input.idempotencyKey,
        reference: input.reference,
        currency,
        description: input.description,
        lines: [
          { accountId: debit._id, direction: 'debit', amountMinor: input.amountMinor },
          { accountId: credit._id, direction: 'credit', amountMinor: input.amountMinor },
        ],
        state: 'posted',
        metadata: input.metadata,
      }], { session });
    });
    return journal;
  } catch (error: any) {
    if (error?.code === 11000) {
      const raced = await LedgerJournal.findOne({ idempotencyKey: input.idempotencyKey });
      if (raced && matchesRequest(raced)) return raced;
      if (raced) throw new LedgerError('Idempotency key was already used for a different transfer', 'IDEMPOTENCY_CONFLICT');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
