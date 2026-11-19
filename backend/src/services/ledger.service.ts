import mongoose from 'mongoose';
import LedgerAccount, { LedgerAccountType } from '../models/LedgerAccount';
import LedgerJournal from '../models/LedgerJournal';

export class LedgerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export type LedgerLineInput = { accountId: string; direction: 'debit' | 'credit'; amountMinor: number };

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

/** Debit-normal asset accounts increase on debit; credit-normal liability/equity/revenue accounts increase on credit. */
export function normalBalanceForAccount(type: LedgerAccountType): 'debit' | 'credit' {
  return type === 'payment_clearing' || type === 'migration_clearing' || type === 'payout_clearing' ? 'debit' : 'credit';
}

export async function getOrCreateLedgerAccount(input: {
  ownerType: 'user' | 'system'; ownerId: string; accountType: LedgerAccountType; currency: string;
}) {
  const currency = input.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new LedgerError('Currency must be a 3-letter code', 'INVALID_CURRENCY');
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

const canonicalLines = (lines: LedgerLineInput[]) => lines
  .map(line => ({ accountId: String(line.accountId), direction: line.direction, amountMinor: line.amountMinor }))
  .sort((a, b) => a.accountId.localeCompare(b.accountId) || a.direction.localeCompare(b.direction) || a.amountMinor - b.amountMinor);

export async function postLedgerEntry(input: {
  lines: LedgerLineInput[]; currency: string; idempotencyKey: string; reference: string;
  description: string; metadata?: Record<string, unknown>;
}) {
  validateBalancedLines(input.lines);
  const currency = input.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new LedgerError('Invalid currency', 'INVALID_CURRENCY');
  if (!input.idempotencyKey || input.idempotencyKey.length > 160) throw new LedgerError('A bounded idempotency key is required', 'INVALID_IDEMPOTENCY_KEY');
  if (new Set(input.lines.map(line => line.accountId)).size !== input.lines.length) {
    throw new LedgerError('Each journal line must reference a distinct account', 'DUPLICATE_ACCOUNT_LINE');
  }
  const expected = JSON.stringify(canonicalLines(input.lines));
  const existing = await LedgerJournal.findOne({ idempotencyKey: input.idempotencyKey });
  if (existing) {
    if (existing.currency !== currency || JSON.stringify(canonicalLines(existing.lines.map((line: any) => ({
      accountId: line.accountId.toString(), direction: line.direction, amountMinor: line.amountMinor,
    }))) !== expected) {
      throw new LedgerError('Idempotency key was already used for a different journal', 'IDEMPOTENCY_CONFLICT');
    }
    return existing;
  }

  const session = await mongoose.startSession();
  try {
    let journal: any;
    await session.withTransaction(async () => {
      const ids = input.lines.map(line => new mongoose.Types.ObjectId(line.accountId));
      const accounts = await LedgerAccount.find({ _id: { $in: ids } }).session(session);
      if (accounts.length !== input.lines.length) throw new LedgerError('One or more ledger accounts do not exist', 'ACCOUNT_NOT_FOUND');
      const byId = new Map<string, typeof accounts[number]>();
      for (const account of accounts) byId.set(account._id.toString(), account);
      for (const line of input.lines) {
        const account = byId.get(line.accountId);
        if (!account) throw new LedgerError('Ledger account not found', 'ACCOUNT_NOT_FOUND');
        if (account.currency !== currency) throw new LedgerError('Ledger account currency mismatch', 'CURRENCY_MISMATCH');
        if (account.status !== 'open') throw new LedgerError('Ledger account is not open', 'ACCOUNT_NOT_OPEN');
        const increases = line.direction === normalBalanceForAccount(account.accountType);
        const delta = increases ? line.amountMinor : -line.amountMinor;
        if (!Number.isSafeInteger(account.balanceMinor + delta) || account.balanceMinor + delta < 0) {
          throw new LedgerError('Entry would create a negative or unsafe account balance', 'INSUFFICIENT_FUNDS');
        }
        const filter: any = { _id: account._id, status: 'open' };
        if (delta < 0) filter.balanceMinor = { $gte: -delta };
        const result = await LedgerAccount.updateOne(filter, { $inc: { balanceMinor: delta } }, { session });
        if (result.modifiedCount !== 1) throw new LedgerError('Ledger account changed during posting', 'ACCOUNT_UPDATE_CONFLICT');
      }
      [journal] = await LedgerJournal.create([{
        idempotencyKey: input.idempotencyKey, reference: input.reference, currency,
        description: input.description,
        lines: input.lines.map(line => ({
          accountId: new mongoose.Types.ObjectId(line.accountId),
          direction: line.direction, amountMinor: line.amountMinor,
        })),
        state: 'posted', metadata: input.metadata,
      }], { session });
    });
    return journal;
  } catch (error: any) {
    if (error?.code === 11000) {
      const raced = await LedgerJournal.findOne({ idempotencyKey: input.idempotencyKey });
      if (raced && raced.currency === currency && JSON.stringify(canonicalLines(raced.lines.map((line: any) => ({
        accountId: line.accountId.toString(), direction: line.direction, amountMinor: line.amountMinor,
      }))) === expected) return raced;
      if (raced) throw new LedgerError('Idempotency key was already used for a different journal', 'IDEMPOTENCY_CONFLICT');
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function postLedgerTransfer(input: {
  debitAccountId: string; creditAccountId: string; amountMinor: number; currency: string;
  idempotencyKey: string; reference: string; description: string; metadata?: Record<string, unknown>;
}) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new LedgerError('Amount must be a positive integer in minor units', 'INVALID_AMOUNT');
  }
  if (input.debitAccountId === input.creditAccountId) throw new LedgerError('A transfer must use two different accounts', 'INVALID_ACCOUNTS');
  return postLedgerEntry({
    lines: [
      { accountId: input.debitAccountId, direction: 'debit', amountMinor: input.amountMinor },
      { accountId: input.creditAccountId, direction: 'credit', amountMinor: input.amountMinor },
    ],
    currency: input.currency, idempotencyKey: input.idempotencyKey, reference: input.reference,
    description: input.description, metadata: input.metadata,
  });
}


export async function getUserLedgerWalletBalances(userId: string, currency: string) {
  const normalizedCurrency = currency.toUpperCase();
  const [wallet, bonus] = await Promise.all([
    LedgerAccount.findOne({ ownerType: 'user', ownerId: userId, accountType: 'player_wallet', currency: normalizedCurrency }),
    LedgerAccount.findOne({ ownerType: 'user', ownerId: userId, accountType: 'bonus_liability', currency: normalizedCurrency }),
  ]);
  return {
    currency: normalizedCurrency,
    balanceMinor: wallet?.balanceMinor ?? 0,
    bonusBalanceMinor: bonus?.balanceMinor ?? 0,
    walletAccountFound: Boolean(wallet),
    bonusAccountFound: Boolean(bonus),
  };
}
