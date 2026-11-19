const test = require('node:test');
const assert = require('node:assert/strict');
const { minesMultiplier, plinkoExpectedReturn, crashPoint } = require('../dist/games/originals.math');

test('Mines multiplier is inverse safe-pick probability with 1% house edge', () => {
  const mines = 3, picks = 4;
  let probability = 1;
  for (let i = 0; i < picks; i++) probability *= (25 - mines - i) / (25 - i);
  assert.ok(Math.abs(minesMultiplier(mines, picks) * probability - 0.99) < 0.0001);
});

test('Plinko eight-row binomial table has approximately 99.0625% theoretical return', () => {
  assert.ok(Math.abs(plinkoExpectedReturn() - 0.990625) < 1e-10);
});

test('Crash generator returns a bounded multiplier of at least 1.00x', () => {
  for (let i = 0; i < 1000; i++) {
    const point = crashPoint();
    assert.ok(point >= 1 && point <= 1000);
    assert.equal(Math.round(point * 100), point * 100);
  }
});
