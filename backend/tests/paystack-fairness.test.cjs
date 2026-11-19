const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac, createHash } = require('node:crypto');
const { PaystackAdapter } = require('../dist/payments/paystack.adapter');
const { createFairRoundRandom } = require('../dist/games/fair-rng');

test('Paystack legacy webhook HMAC-SHA512 validates exact raw bytes', async () => {
  const raw = Buffer.from('{ "event":"charge.success", "data":{} }');
  const secret = 'sk_test_veltdummysecret';
  const signature = createHmac('sha512', secret).update(raw).digest('hex');
  const adapter = new PaystackAdapter(secret);
  assert.equal(await adapter.verifyWebhook(raw, signature), true);
  assert.equal(await adapter.verifyWebhook(Buffer.from(raw.toString() + ' '), signature), false);
  assert.equal(await adapter.verifyWebhook(raw, 'bad'), false);
});

test('Paystack timestamped signature rejects stale timestamps and accepts valid signature', async () => {
  const raw = Buffer.from('{"event":"charge.success"}');
  const secret = 'sk_test_veltdummysecret';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const digest = createHmac('sha512', secret).update(timestamp + '.').update(raw).digest('hex');
  const adapter = new PaystackAdapter(secret);
  assert.equal(await adapter.verifyWebhook(raw, 't=' + timestamp + ',v1=whk_test:' + digest), true);
  assert.equal(await adapter.verifyWebhook(raw, 't=1,v1=whk_test:' + digest), false);
});

test('VELT round entropy publishes a verifiable SHA-256 commitment and bounded integers', () => {
  const rng = createFairRoundRandom('test-client', 7);
  assert.equal(createHash('sha256').update(rng.fairness.serverSeed).digest('hex'), rng.fairness.serverSeedHash);
  for (let i = 0; i < 1000; i++) {
    const n = rng.integer(0, 37);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 37);
  }
  assert.equal(rng.fairness.algorithm, 'HMAC-SHA256-counter-v1');
});
