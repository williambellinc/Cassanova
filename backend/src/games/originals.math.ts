import { randomBytes } from 'crypto';

export const PLINKO_MULTIPLIERS = [3.82, 2.5, 1.25, 0.9, 0.5, 0.9, 1.25, 2.5, 3.82] as const;

export function minesMultiplier(mineCount: number, safePicks: number) {
  if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24 ||
      !Number.isInteger(safePicks) || safePicks < 0 || safePicks > 25 - mineCount) {
    throw new Error('Invalid Mines probability inputs');
  }
  let probability = 1;
  for (let i = 0; i < safePicks; i++) probability *= (25 - mineCount - i) / (25 - i);
  return Number((0.99 / probability).toFixed(4));
}

export function plinkoExpectedReturn() {
  const choose = (n: number, k: number): number => {
    let result = 1;
    for (let i = 1; i <= k; i++) result = result * (n - i + 1) / i;
    return result;
  };
  return PLINKO_MULTIPLIERS.reduce((sum, multiplier, slot) => sum + choose(8, slot) / 256 * multiplier, 0);
}

export function crashPoint() {
  const bytes = randomBytes(6);
  const value = bytes.readUIntBE(0, 6) / 2 ** 48;
  return Math.max(1, Math.min(1000, Math.floor((0.99 / (1 - value)) * 100) / 100));
}


export function calculateDiceOutcome(rollHundredths: number, targetHundredths: number, direction: 'over' | 'under') {
  if (!Number.isInteger(rollHundredths) || rollHundredths < 0 || rollHundredths > 9999 ||
      !Number.isInteger(targetHundredths) || targetHundredths < 1 || targetHundredths > 9999 ||
      !['over', 'under'].includes(direction)) {
    throw new Error('Invalid Dice outcome inputs');
  }
  const winningOutcomes = direction === 'over' ? 10000 - targetHundredths : targetHundredths + 1;
  const winProbability = winningOutcomes / 10000;
  const won = direction === 'over' ? rollHundredths >= targetHundredths : rollHundredths <= targetHundredths;
  return {
    roll: rollHundredths / 100,
    target: targetHundredths / 100,
    direction,
    result: won ? 'win' : 'loss',
    winProbability,
    multiplier: Number((0.99 / winProbability).toFixed(4)),
  };
}
