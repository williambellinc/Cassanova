import { Router } from 'express';
import {
  playRoulettePractice, playSlotsPractice, playBaccaratPractice,
  startBlackjackPractice, hitBlackjackPractice, standBlackjackPractice,
} from '../controllers/casino-practice.controller';

const router = Router();
// Non-monetary practice games only. These endpoints cannot debit or credit wallets.
router.post('/roulette/play', playRoulettePractice);
router.post('/slots/spin', playSlotsPractice);
router.post('/baccarat/deal', playBaccaratPractice);
router.post('/blackjack/start', startBlackjackPractice);
router.post('/blackjack/:roundReference/hit', hitBlackjackPractice);
router.post('/blackjack/:roundReference/stand', standBlackjackPractice);
export default router;
