const test = require('node:test');
const assert = require('node:assert/strict');
const { FlutterwaveV3Adapter } = require('../dist/payments/flutterwave-v3.adapter');

test('Flutterwave webhook secret hash uses constant-time equality and rejects mismatch', async () => {
  const adapter = new FlutterwaveV3Adapter('test-secret', 'a-strong-webhook-secret-hash');
  assert.equal(await adapter.verifyWebhook(Buffer.from('{}'), 'a-strong-webhook-secret-hash'), true);
  assert.equal(await adapter.verifyWebhook(Buffer.from('{}'), 'wrong-secret-hash'), false);
});

test('Flutterwave rejects unsupported currency exponents before checkout API call', async () => {
  const adapter = new FlutterwaveV3Adapter('test-secret', 'a-strong-webhook-secret-hash');
  await assert.rejects(() => adapter.createDepositIntent({
    merchantReference: 'velt_dep_test123', amountMinor: 1000, currency: 'UGX',
    returnUrl: 'https://example.test/return', customerEmail: 'player@example.test',
  }), /minor-unit mapping/);
});

test('Flutterwave rejects invalid beneficiary references before payout API call', async () => {
  const adapter = new FlutterwaveV3Adapter('test-secret', 'a-strong-webhook-secret-hash');
  await assert.rejects(() => adapter.requestPayout({
    merchantReference: 'velt_wd_test123', amountMinor: 1000, currency: 'ZAR', beneficiaryReference: 'not-a-provider-id',
  }), /beneficiary ID/);
});
