import { Router, raw } from 'express';
import { receivePaymentWebhook } from '../controllers/payment-webhook.controller';

const router = Router();
router.post('/:provider', raw({ type: 'application/json', limit: '1mb' }), (req, res, next) => {
  const configured = process.env.PAYMENT_PROVIDER_ID;
  if (!configured || req.params.provider !== configured) return res.status(404).json({ message: 'Unknown payment provider' });
  return receivePaymentWebhook(req, res);
});

export default router;
