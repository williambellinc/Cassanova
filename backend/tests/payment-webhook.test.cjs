const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { CanonicalHmacPaymentAdapter } = require('../dist/payments/canonical-hmac.adapter');

const secret = 'a'.repeat(64);
const adapter = new CanonicalHmacPaymentAdapter(secret, 'test-gateway');
const sign = (body, timestamp) => createHmac('sha256', secret).update(timestamp).update('.').update(body).digest('hex');

test('accepts a correctly signed, recent raw webhook body', async () => {
  const body = Buffer.from(JSON.stringify({
    id: 'evt_001', type: 'payment.settled',
    data: { paymentId: 'pay_001', reference: 'dep_001', amountMinor: 12500, currency: 'ZAR' },
  }));
  const timestamp = String(Math.floor(Date.now() / 1000));
  assert.equal(await adapter.verifyWebhook(body, sign(body, timestamp), timestamp), true);
  const parsed = await adapter.parseWebhook(body);
  assert.equal(parsed.providerEventId, 'evt_001');
  assert.equal(parsed.status, 'settled');
  assert.equal(parsed.amountMinor, 12500);
});

test('rejects stale timestamps and invalid signatures', async () => {
  const body = Buffer.from('{}');
  const stale = String(Math.floor(Date.now() / 1000) - 600);
  assert.equal(await adapter.verifyWebhook(body, sign(body, stale), stale), false);
  const recent = String(Math.floor(Date.now() / 1000));
  assert.equal(await adapter.verifyWebhook(body, '0'.repeat(64), recent), false);
});

test('rejects malformed or non-canonical payment events', async () => {
  await assert.rejects(() => adapter.parseWebhook(Buffer.from('{bad json')));
  await assert.rejects(() => adapter.parseWebhook(Buffer.from(JSON.stringify({ id: 'x', type: 'payment.settled', data: {} }))));
});
