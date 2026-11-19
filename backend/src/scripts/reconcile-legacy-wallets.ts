import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import WalletMigrationSnapshot from '../models/WalletMigrationSnapshot';
import LedgerAccount from '../models/LedgerAccount';

dotenv.config();
const minor = (value: unknown) => {
  const n = Number(value ?? 0), m = Math.round(n * 100);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(m) || Math.abs(n - m / 100) > 0.0000001) throw new Error('Invalid legacy wallet amount encountered');
  return m;
};

async function main() {
  const currency = process.env.LEGACY_BALANCE_CURRENCY?.toUpperCase();
  const batchKey = process.env.WALLET_MIGRATION_BATCH_KEY || (currency ? 'legacy-wallet-v1-' + currency : '');
  if (!currency || !batchKey) throw new Error('LEGACY_BALANCE_CURRENCY is required');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    let users = 0, missingSnapshots = 0, snapshotMismatches = 0, ledgerMismatches = 0;
    let legacyCash = 0, legacyBonus = 0, ledgerCash = 0, ledgerBonus = 0;
    const cursor = User.find({}).select('_id balance bonusBalance').lean().cursor();
    for await (const user of cursor) {
      users++;
      const cash = minor(user.balance), bonus = minor(user.bonusBalance);
      legacyCash += cash; legacyBonus += bonus;
      const snapshot = await WalletMigrationSnapshot.findOne({ batchKey, userId: user._id }).lean();
      if (cash + bonus > 0 && !snapshot) { missingSnapshots++; continue; }
      if (snapshot && (snapshot.currency !== currency || snapshot.legacyBalanceMinor !== cash || snapshot.legacyBonusMinor !== bonus)) snapshotMismatches++;
      const [wallet, bonusAccount] = await Promise.all([
        LedgerAccount.findOne({ ownerType:'user', ownerId:String(user._id), accountType:'player_wallet', currency }).lean(),
        LedgerAccount.findOne({ ownerType:'user', ownerId:String(user._id), accountType:'bonus_liability', currency }).lean(),
      ]);
      const walletMinor = wallet?.balanceMinor || 0, bonusMinor = bonusAccount?.balanceMinor || 0;
      ledgerCash += walletMinor; ledgerBonus += bonusMinor;
      if (snapshot && (walletMinor !== cash || bonusMinor !== bonus)) ledgerMismatches++;
    }
    const report = {
      generatedAt: new Date().toISOString(), batchKey, currency, users,
      legacyCashMinor: legacyCash, legacyBonusMinor: legacyBonus,
      ledgerCashMinor: ledgerCash, ledgerBonusMinor: ledgerBonus,
      missingSnapshots, snapshotMismatches, ledgerMismatches,
      balanced: missingSnapshots === 0 && snapshotMismatches === 0 && ledgerMismatches === 0 && legacyCash === ledgerCash && legacyBonus === ledgerBonus,
      walletLedgerReadsMustRemainDisabledUntilFinanceSignoff: true,
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!report.balanced) process.exitCode = 2;
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { process.stderr.write(String(error?.stack || error) + '\n'); process.exitCode = 1; });
