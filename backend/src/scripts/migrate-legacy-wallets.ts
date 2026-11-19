import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { migrateLegacyWalletBalances } from './wallet-migration.service';

dotenv.config();

async function main() {
  const currency = process.env.LEGACY_BALANCE_CURRENCY;
  if (!currency) throw new Error('Set LEGACY_BALANCE_CURRENCY explicitly; legacy balances have no currency metadata.');
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(uri);
  try {
    const report = await migrateLegacyWalletBalances({ currency, apply });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!apply) process.stdout.write('Dry run only. Re-run with --apply after reviewing the report and taking a database backup.\n');
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  process.stderr.write(String(error?.stack || error) + '\n');
  process.exitCode = 1;
});
