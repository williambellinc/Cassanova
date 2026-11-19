import { Router } from 'express';
import { 
  register, 
  login, 
  verifyEmail, 
  resendVerification, 
  forgotPassword, 
  resetPassword,
  setup2FA,
  verify2FA,
  disable2FA,
  get2FAStatus
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/security.middleware';

const router = Router();

// Per-process protection for credential and account-recovery endpoints.
// Replace with a shared store before running multiple API instances.
router.use(createRateLimiter({ windowMs: 15 * 60 * 1000, max: 40, message: 'Too many authentication requests. Try again in 15 minutes.' }));

router.post('/register', register);
router.post('/login', login);
router.get('/verify/:token', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// 2FA routes (require authentication)
router.post('/2fa/setup', authenticateToken, setup2FA);
router.post('/2fa/verify', authenticateToken, verify2FA);
router.post('/2fa/disable', authenticateToken, disable2FA);
router.get('/2fa/status', authenticateToken, get2FAStatus);

export default router;
