import { Router, raw } from 'express';
import { receivePaymentWebhook } from '../controllers/payment-webhook.controller';

const router = Router();
router.post('/:provider', raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  if (!['flutterwave', 'paystack'].includes(req.params.provider)) return res.status(404).json({ message: 'Unknown payment provider' });
  return receivePaymentWebhook(req, res);
});

export default router;
