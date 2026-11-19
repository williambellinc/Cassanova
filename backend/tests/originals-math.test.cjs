const test = require('node:test');
const assert = require('node:assert/strict');
const { minesMultiplier, plinkoExpectedReturn, crashPoint, calculateDiceOutcome } = require('../dist/games/originals.math');

test('Mines multiplier is inverse safe-pick probability with 1% house edge', () => {
  const mines = 3, picks = 4;
  let probability = 1;
  for (let i = 0; i < picks; i++) probability *= (25 - mines - i) / (25 - i);
  assert.ok(Math.abs(minesMultiplier(mines, picks) * probability - 0.99) < 0.0001);
});

test('Plinko eight-row binomial table has approximately 99% theoretical return', () => {
  assert.ok(Math.abs(plinkoExpectedReturn() - 0.99) < 1e-10);
});

test('Crash generator returns a bounded multiplier of at least 1.00x', () => {
  for (let i = 0; i < 1000; i++) {
    const point = crashPoint();
    assert.ok(point >= 1 && point <= 1000);
    assert.ok(Math.abs(point * 100 - Math.round(point * 100)) < 1e-8);
  }
});

test('Dice over/under pricing applies a 1% theoretical house edge', () => {
  for (const direction of ['over', 'under']) {
    const outcome = calculateDiceOutcome(5000, 5000, direction);
    assert.ok(Math.abs(outcome.winProbability * outcome.multiplier - 0.99) < 0.0001);
    assert.equal(outcome.result, direction === 'over' ? 'win' : 'loss');
  }
});
