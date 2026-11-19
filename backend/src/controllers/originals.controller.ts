import { Request, Response } from 'express';
import { randomInt, randomUUID } from 'crypto';
import GameRound from '../models/GameRound';

/**
 * VELT Originals Dice practice endpoint.
 * Server-generated outcome, no stake, no wallet access and no prize.
 * This is a practice mechanic only, not a certified real-money game.
 */
export const playDiceDemo = async (_req: Request, res: Response) => {
  try {
    const diceValue = randomInt(1, 7);
    const round = await GameRound.create({
      roundReference: randomUUID(),
      gameCode: 'velt-dice',
      mode: 'demo',
      outcome: {
        diceValue,
        result: diceValue % 2 === 0 ? 'even' : 'odd',
      },
      algorithmVersion: 'node-crypto-randomInt-v1',
    });

    return res.status(201).json({
      roundReference: round.roundReference,
      gameCode: round.gameCode,
      mode: round.mode,
      outcome: round.outcome,
      createdAt: round.createdAt,
      notice: 'Practice only. No stake was placed and no prize or wallet credit is available.',
    });
  } catch (error) {
    console.error('Dice demo error:', error);
    return res.status(500).json({ message: 'Unable to generate a practice round' });
  }
};
