import { Router } from 'express';
import { createDepositIntent } from '../controllers/payment.controller';
import { getPaymentReconciliation } from '../controllers/payment-reconciliation.controller';
import { requestWithdrawal, approveAndSubmitWithdrawal } from '../controllers/withdrawal.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { requireCasinoEligibility } from '../middleware/real-money-eligibility.middleware';

const router = Router();
router.get('/reconciliation', authenticateToken, requireAdmin, getPaymentReconciliation);
router.post('/intents', authenticateToken, requireCasinoEligibility, createDepositIntent);
router.post('/withdrawals', authenticateToken, requireCasinoEligibility, requestWithdrawal);
router.post('/withdrawals/:withdrawalId/approve-submit', authenticateToken, requireAdmin, approveAndSubmitWithdrawal);
export default router;
