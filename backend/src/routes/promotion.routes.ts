import { Router } from 'express';
import { getAllPromotions, getPromotionBySlug, createPromotion } from '../controllers/promotion.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllPromotions);
router.get('/:slug', getPromotionBySlug);
router.post('/', authenticateToken, requireAdmin, createPromotion);

export default router;
