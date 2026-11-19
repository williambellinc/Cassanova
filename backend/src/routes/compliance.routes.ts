import { Router, raw } from 'express';
import { authenticateToken, requireAdmin, requireComplianceOfficer } from '../middleware/auth.middleware';
import { createKycSession, requestAmlRecheck, receiveSumsubWebhook, setAmlDisposition } from '../compliance/sumsub.controller';

const router = Router();
router.post('/webhooks/sumsub', raw({ type: 'application/json', limit: '256kb' }), receiveSumsubWebhook);
router.post('/kyc/session', authenticateToken, createKycSession);
router.post('/aml/:userId/recheck', authenticateToken, requireComplianceOfficer, requestAmlRecheck);
router.post('/aml/:userId/disposition', authenticateToken, requireComplianceOfficer, setAmlDisposition);
export default router;
