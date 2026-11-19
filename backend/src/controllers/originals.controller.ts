import { Request, Response } from 'express';
import { randomBytes, randomInt, randomUUID } from 'crypto';
import GameRound from '../models/GameRound';

/**
 * All VELT Originals endpoints in this module are PRACTICE-ONLY.
 * Outcomes are generated on the server with Node's cryptographic RNG.
 * No stake, wallet mutation, prize, or real-money settlement is possible.
 */
export const playDiceDemo = async (_req: Request, res: Response) => {
  try {
    const diceValue = randomInt(1, 7);
    const round = await GameRound.create({
      roundReference: randomUUID(), gameCode: 'velt-dice', mode: 'demo',
      outcome: { diceValue, result: diceValue % 2 === 0 ? 'even' : 'odd' },
      algorithmVersion: 'node-crypto-randomInt-v1',
    });
    return res.status(201).json({
      roundReference: round.roundReference, gameCode: round.gameCode, mode: round.mode,
      outcome: round.outcome, createdAt: round.createdAt,
      notice: 'Practice only. No stake or prize.',
    });
  } catch (error) {
    console.error('Dice demo error:', error);
    return res.status(500).json({ message: 'Unable to generate a practice round' });
  }
};

const shuffle = (values: number[]) => {
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
};

const minesMultiplier = (mineCount: number, safePicks: number) => {
  let probability = 1;
  for (let i = 0; i < safePicks; i++) probability *= (25 - mineCount - i) / (25 - i);
  return Number((0.99 / probability).toFixed(4));
};

export const startMinesDemo = async (req: Request, res: Response) => {
  try {
    const mineCount = Number(req.body?.mineCount ?? 3);
    if (!Number.isInteger(mineCount) || mineCount < 1 || mineCount > 24) {
      return res.status(400).json({ message: 'mineCount must be an integer from 1 to 24' });
    }
    const minePositions = shuffle(Array.from({ length: 25 }, (_, i) => i)).slice(0, mineCount).sort((a, b) => a - b);
    const round = await GameRound.create({
      roundReference: randomUUID(), gameCode: 'velt-mines', mode: 'demo',
      outcome: { status: 'active' },
      state: { mineCount, minePositions, revealed: [], status: 'active', multiplier: 1 },
      algorithmVersion: 'velt-mines-5x5-v1',
    });
    return res.status(201).json({
      roundReference: round.roundReference, gameCode: round.gameCode, mode: 'demo',
      boardSize: 25, mineCount, revealed: [], status: 'active', multiplier: 1,
      notice: 'Practice only. Mine positions are held server-side.',
    });
  } catch (error) {
    console.error('Mines start error:', error);
    return res.status(500).json({ message: 'Unable to start Mines practice round' });
  }
};

export const pickMinesDemo = async (req: Request, res: Response) => {
  try {
    const { roundReference } = req.params;
    const position = Number(req.body?.position);
    if (!Number.isInteger(position) || position < 0 || position > 24) {
      return res.status(400).json({ message: 'position must be an integer from 0 to 24' });
    }
    const round = await GameRound.findOne({ roundReference, gameCode: 'velt-mines', mode: 'demo' });
    if (!round || !round.state) return res.status(404).json({ message: 'Practice round not found' });
    const state = round.state as any;
    if (state.status !== 'active') return res.status(409).json({ message: 'Round is no longer active' });
    if (state.revealed.includes(position)) return res.status(409).json({ message: 'Tile already revealed' });

    if (state.minePositions.includes(position)) {
      state.status = 'lost';
      state.revealed.push(position);
      round.outcome = { status: 'lost', mineHit: position, minePositions: state.minePositions, revealed: state.revealed };
    } else {
      state.revealed.push(position);
      state.multiplier = minesMultiplier(state.mineCount, state.revealed.length);
      round.outcome = { status: 'active', revealed: state.revealed, safePicks: state.revealed.length, multiplier: state.multiplier };
    }
    round.markModified('state');
    round.markModified('outcome');
    await round.save();
    return res.json({
      roundReference, status: state.status, revealed: state.revealed,
      ...(state.status === 'lost' ? { mineHit: position, minePositions: state.minePositions } : { multiplier: state.multiplier }),
      notice: 'Practice only. Multiplier is informational and has no cash value.',
    });
  } catch (error) {
    console.error('Mines pick error:', error);
    return res.status(500).json({ message: 'Unable to process Mines practice pick' });
  }
};

export const cashoutMinesDemo = async (req: Request, res: Response) => {
  try {
    const round = await GameRound.findOne({ roundReference: req.params.roundReference, gameCode: 'velt-mines', mode: 'demo' });
    if (!round || !round.state) return res.status(404).json({ message: 'Practice round not found' });
    const state = round.state as any;
    if (state.status !== 'active' || state.revealed.length === 0) {
      return res.status(409).json({ message: 'Round cannot be cashed out' });
    }
    state.status = 'cashed_out';
    round.outcome = {
      status: 'cashed_out', revealed: state.revealed, safePicks: state.revealed.length,
      multiplier: state.multiplier, minePositions: state.minePositions,
    };
    round.markModified('state');
    round.markModified('outcome');
    await round.save();
    return res.json({ roundReference: round.roundReference, status: state.status, multiplier: state.multiplier, notice: 'Practice result only; no prize or wallet credit.' });
  } catch (error) {
    console.error('Mines cashout error:', error);
    return res.status(500).json({ message: 'Unable to cash out Mines practice round' });
  }
};

const PLINKO_MULTIPLIERS = [5.8, 2.5, 1.25, 0.9, 0.5, 0.9, 1.25, 2.5, 5.8] as const;
// Eight-row binomial distribution; weighted expected return is approximately 99.06%.
export const playPlinkoDemo = async (req: Request, res: Response) => {
  try {
    const rows = Number(req.body?.rows ?? 8);
    if (rows !== 8) return res.status(400).json({ message: 'This Plinko build currently supports 8 rows' });
    const path = Array.from({ length: rows }, () => randomInt(0, 2));
    const slot = path.reduce((sum, direction) => sum + direction, 0);
    const multiplier = PLINKO_MULTIPLIERS[slot];
    const round = await GameRound.create({
      roundReference: randomUUID(), gameCode: 'velt-plinko', mode: 'demo',
      outcome: { rows, path, slot, multiplier },
      algorithmVersion: 'velt-plinko-8row-99.06-v1',
    });
    return res.status(201).json({
      roundReference: round.roundReference, gameCode: round.gameCode, mode: 'demo',
      outcome: { rows, path, slot, multiplier },
      expectedReturn: 0.990625,
      notice: 'Practice only. No stake or prize.',
    });
  } catch (error) {
    console.error('Plinko demo error:', error);
    return res.status(500).json({ message: 'Unable to generate Plinko practice round' });
  }
};

const crashPoint = () => {
  const bytes = randomBytes(6);
  const value = bytes.readUIntBE(0, 6) / 2 ** 48;
  return Math.max(1, Math.min(1000, Math.floor((0.99 / (1 - value)) * 100) / 100));
};

export const playCrashDemo = async (req: Request, res: Response) => {
  try {
    const cashoutAt = Number(req.body?.cashoutAt ?? 2);
    if (!Number.isFinite(cashoutAt) || cashoutAt < 1.01 || cashoutAt > 1000) {
      return res.status(400).json({ message: 'cashoutAt must be between 1.01x and 1000x' });
    }
    const crashAt = crashPoint();
    const cashedOut = cashoutAt <= crashAt;
    const round = await GameRound.create({
      roundReference: randomUUID(), gameCode: 'velt-crash', mode: 'demo',
      outcome: { crashAt, cashoutAt: cashedOut ? cashoutAt : null, result: cashedOut ? 'cashed_out' : 'bust' },
      algorithmVersion: 'velt-crash-99pct-v1',
    });
    return res.status(201).json({
      roundReference: round.roundReference, gameCode: round.gameCode, mode: 'demo',
      outcome: { crashAt, cashoutAt: cashedOut ? cashoutAt : null, result: cashedOut ? 'cashed_out' : 'bust' },
      theoreticalReturn: 0.99,
      notice: 'Practice only. No stake, prize or wallet credit.',
    });
  } catch (error) {
    console.error('Crash demo error:', error);
    return res.status(500).json({ message: 'Unable to generate Crash practice round' });
  }
};

export const getOriginalsHistory = async (req: Request, res: Response) => {
  try {
    const gameCode = typeof req.query.game === 'string' ? req.query.game : undefined;
    const filter: Record<string, unknown> = { mode: 'demo' };
    if (gameCode && ['velt-dice', 'velt-mines', 'velt-plinko', 'velt-crash'].includes(gameCode)) filter.gameCode = gameCode;
    const rounds = await GameRound.find(filter).sort({ createdAt: -1 }).limit(50).select('-state.minePositions');
    return res.json({ rounds, limit: 50, notice: 'Practice history only.' });
  } catch (error) {
    console.error('Originals history error:', error);
    return res.status(500).json({ message: 'Unable to fetch practice history' });
  }
};
