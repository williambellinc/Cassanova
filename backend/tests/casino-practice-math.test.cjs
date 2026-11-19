const test = require('node:test');
const assert = require('node:assert/strict');
const { SLOT_THEORETICAL_RTP, ROULETTE_THEORETICAL_RTP } = require('../dist/controllers/casino-practice.controller');

test('single-zero European roulette theoretical RTP is within 1-3% house edge', () => {
  assert.ok(Math.abs(ROULETTE_THEORETICAL_RTP - 36/37) < 1e-12);
  assert.ok(ROULETTE_THEORETICAL_RTP >= 0.97 && ROULETTE_THEORETICAL_RTP <= 0.99);
});

test('three-reel weighted VELT slot paytable is within 1-3% theoretical house edge', () => {
  assert.ok(Math.abs(SLOT_THEORETICAL_RTP - 0.9700740740740741) < 1e-12);
  assert.ok(SLOT_THEORETICAL_RTP >= 0.97 && SLOT_THEORETICAL_RTP <= 0.99);
});
