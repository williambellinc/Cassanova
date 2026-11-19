import { Router } from 'express';
import { createDepositIntent } from '../controllers/payment.controller';
import { authenticateToken, denyRealMoneyUntilAuthorised } from '../middleware/auth.middleware';

const router = Router();
router.post('/intents', authenticateToken, denyRealMoneyUntilAuthorised, createDepositIntent);
export default router;
