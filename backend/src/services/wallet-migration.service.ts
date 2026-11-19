import mongoose from 'mongoose';
import User from '../models/User';
import WalletMigrationSnapshot from '../models/WalletMigrationSnapshot';
import { getOrCreateLedgerAccount, postLedgerEntry } from './ledger.service';

const toMinorUnits = (value: unknown, field: string): number => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid legacy ${field}`);
  const minor = Math.round(amount * 100);
  if (!Number.isSafeInteger(minor) || Math.abs(amount - minor / 100) > 0.0000001) {
    throw new Error(`Legacy ${field} has more than two decimal places or exceeds safe integer range`);
  }
  return minor;
};

export async function migrateLegacyWalletBalances(input: { currency: string; apply: boolean; batchKey?: string }) {
  const currency = input.currency.toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('LEGACY_BALANCE_CURRENCY must be a three-letter currency code');
  const batchKey = input.batchKey || `legacy-wallet-v1-${currency}`;
  const migrationClearing = await getOrCreateLedgerAccount({
    ownerType: 'system', ownerId: batchKey, accountType: 'migration_clearing', currency,
  });

  let scanned = 0, alreadyMigrated = 0, eligible = 0, migrated = 0;
  let cashTotalMinor = 0, bonusTotalMinor = 0;
  const cursor = User.find({}).select('_id balance bonusBalance').lean().cursor();

  for await (const user of cursor) {
    scanned++;
    const legacyBalanceMinor = toMinorUnits(user.balance, 'balance');
    const legacyBonusMinor = toMinorUnits(user.bonusBalance, 'bonusBalance');
    cashTotalMinor += legacyBalanceMinor;
    bonusTotalMinor += legacyBonusMinor;
    if (!Number.isSafeInteger(cashTotalMinor + bonusTotalMinor)) throw new Error('Aggregate wallet migration total exceeds safe integer range');
    if (legacyBalanceMinor + legacyBonusMinor === 0) continue;
    eligible++;

    const existing = await WalletMigrationSnapshot.findOne({ batchKey, userId: user._id });
    if (existing) {
      alreadyMigrated++;
      if (existing.currency !== currency || existing.legacyBalanceMinor !== legacyBalanceMinor || existing.legacyBonusMinor !== legacyBonusMinor) {
        throw new Error(`Legacy balance changed after migration for user ${user._id}; manual reconciliation required`);
      }
      continue;
    }
    if (!input.apply) continue;

    const wallet = await getOrCreateLedgerAccount({
      ownerType: 'user', ownerId: String(user._id), accountType: 'player_wallet', currency,
    });
    const bonus = await getOrCreateLedgerAccount({
      ownerType: 'user', ownerId: String(user._id), accountType: 'bonus_liability', currency,
    });
    const lines: Array<{ accountId: string; direction: 'debit' | 'credit'; amountMinor: number }> = [];
    const total = legacyBalanceMinor + legacyBonusMinor;
    if (total > 0) lines.push({ accountId: String(migrationClearing._id), direction: 'debit', amountMinor: total });
    if (legacyBalanceMinor > 0) lines.push({ accountId: String(wallet._id), direction: 'credit', amountMinor: legacyBalanceMinor });
    if (legacyBonusMinor > 0) lines.push({ accountId: String(bonus._id), direction: 'credit', amountMinor: legacyBonusMinor });

    const journalReference = `legacy-wallet-migration:${batchKey}:${user._id}`;
    await postLedgerEntry({
      lines, currency, idempotencyKey: journalReference, reference: journalReference,
      description: 'Opening balance migration from legacy wallet',
      metadata: {
        migrationBatch: batchKey, source: 'User.balance + User.bonusBalance',
        legacyUserId: String(user._id), cashMinor: legacyBalanceMinor, bonusMinor: legacyBonusMinor,
      },
    });
    try {
      await WalletMigrationSnapshot.create({
        batchKey, userId: user._id, currency, legacyBalanceMinor, legacyBonusMinor, journalReference,
      });
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
    }
    migrated++;
  }

  return {
    mode: input.apply ? 'applied' : 'dry-run',
    batchKey, currency, scanned, eligible, alreadyMigrated, migrated,
    legacyCashTotalMinor: cashTotalMinor, legacyBonusTotalMinor: bonusTotalMinor,
    totalMinor: cashTotalMinor + bonusTotalMinor,
    reconciliationRequired: true,
    note: 'Migration creates auditable opening entries against a migration-clearing asset. Reconcile this asset to safeguarded bank/payment balances before enabling withdrawals or wagering.',
  };
}
