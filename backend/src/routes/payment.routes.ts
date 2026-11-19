import { Router } from 'express';
import { createDepositIntent } from '../controllers/payment.controller';
import { getPaymentReconciliation } from '../controllers/payment-reconciliation.controller';
import { requestWithdrawal, approveAndSubmitWithdrawal } from '../controllers/withdrawal.controller';
import { authenticateToken, denyRealMoneyUntilAuthorised, requireAdmin } from '../middleware/auth.middleware';

const router = Router();
router.get('/reconciliation', authenticateToken, requireAdmin, getPaymentReconciliation);
router.post('/intents', authenticateToken, denyRealMoneyUntilAuthorised, createDepositIntent);
router.post('/withdrawals', authenticateToken, denyRealMoneyUntilAuthorised, requestWithdrawal);
router.post('/withdrawals/:withdrawalId/approve-submit', authenticateToken, requireAdmin, denyRealMoneyUntilAuthorised, approveAndSubmitWithdrawal);
export default router;
