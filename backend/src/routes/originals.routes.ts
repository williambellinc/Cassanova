import { Router } from 'express';
import { playDiceDemo } from '../controllers/originals.controller';

const router = Router();

// Practice mode only. This endpoint never accepts a wager or touches a wallet.
router.post('/dice/demo', playDiceDemo);

export default router;
