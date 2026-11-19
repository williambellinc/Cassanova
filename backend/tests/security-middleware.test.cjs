const test = require('node:test');
const assert = require('node:assert/strict');
const { createRateLimiter, securityHeaders } = require('../dist/middleware/security.middleware');

const response = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('rate limiter permits requests up to configured maximum', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
  const req = { ip: 'test-client' };
  const first = response();
  const second = response();
  let nextCalls = 0;
  limiter(req, first, () => nextCalls++);
  limiter(req, second, () => nextCalls++);
  assert.equal(nextCalls, 2);
  assert.equal(second.headers['RateLimit-Remaining'], '0');
});

test('rate limiter blocks requests beyond configured maximum', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
  const req = { ip: 'blocked-client' };
  limiter(req, response(), () => {});
  const blocked = response();
  limiter(req, blocked, () => assert.fail('blocked request must not continue'));
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.body.code, 'RATE_LIMITED');
  assert.ok(Number(blocked.headers['Retry-After']) >= 1);
});

test('security headers are applied to API responses', () => {
  const res = response();
  let continued = false;
  securityHeaders({}, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['Cache-Control'], 'no-store');
});
