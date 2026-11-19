import { Router, raw } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { createKycSession, requestAmlRecheck, receiveSumsubWebhook } from '../compliance/sumsub.controller';

const router = Router();
router.post('/webhooks/sumsub', raw({ type: 'application/json', limit: '256kb' }), receiveSumsubWebhook);
router.post('/kyc/session', authenticateToken, createKycSession);
router.post('/aml/:userId/recheck', authenticateToken, requireAdmin, requestAmlRecheck);
export default router;
