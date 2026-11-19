const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBalancedLines, normalBalanceForAccount, LedgerError } = require('../dist/services/ledger.service');

test('accepts exactly balanced integer debit and credit lines', () => {
  assert.equal(validateBalancedLines([
    { direction: 'debit', amountMinor: 1250 },
    { direction: 'credit', amountMinor: 1250 },
  ]), true);
});

test('rejects unbalanced journals', () => {
  assert.throws(
    () => validateBalancedLines([
      { direction: 'debit', amountMinor: 1250 },
      { direction: 'credit', amountMinor: 1249 },
    ]),
    (error) => error instanceof LedgerError && error.code === 'UNBALANCED_JOURNAL'
  );
});

test('rejects fractional or zero minor-unit amounts', () => {
  assert.throws(
    () => validateBalancedLines([
      { direction: 'debit', amountMinor: 10.5 },
      { direction: 'credit', amountMinor: 10.5 },
    ]),
    (error) => error instanceof LedgerError && error.code === 'INVALID_JOURNAL'
  );
  assert.throws(
    () => validateBalancedLines([
      { direction: 'debit', amountMinor: 0 },
      { direction: 'credit', amountMinor: 0 },
    ]),
    (error) => error instanceof LedgerError && error.code === 'INVALID_JOURNAL'
  );
});

test('rejects journals with only one side', () => {
  assert.throws(
    () => validateBalancedLines([{ direction: 'debit', amountMinor: 100 }]),
    (error) => error instanceof LedgerError && error.code === 'INVALID_JOURNAL'
  );
});

test('uses accounting normal balances for assets and player liabilities', () => {
  assert.equal(normalBalanceForAccount('payment_clearing'), 'debit');
  assert.equal(normalBalanceForAccount('migration_clearing'), 'debit');
  assert.equal(normalBalanceForAccount('player_wallet'), 'credit');
  assert.equal(normalBalanceForAccount('bonus_liability'), 'credit');
  assert.equal(normalBalanceForAccount('operator_revenue'), 'credit');
});
