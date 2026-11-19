import { Router } from 'express';
import {
  playDiceDemo, startMinesDemo, pickMinesDemo, cashoutMinesDemo,
  playPlinkoDemo, playCrashDemo, getOriginalsHistory,
} from '../controllers/originals.controller';

const router = Router();

// Every route below is non-monetary practice mode only.
router.get('/history', getOriginalsHistory);
router.post('/dice/demo', playDiceDemo);
router.post('/mines/demo/start', startMinesDemo);
router.post('/mines/demo/:roundReference/pick', pickMinesDemo);
router.post('/mines/demo/:roundReference/cashout', cashoutMinesDemo);
router.post('/plinko/demo', playPlinkoDemo);
router.post('/crash/demo', playCrashDemo);

export default router;
