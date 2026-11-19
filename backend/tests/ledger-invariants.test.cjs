const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBalancedLines, LedgerError } = require('../dist/services/ledger.service');

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
