import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import { createSubscription, checkPaymentStatus, handleWebhook, cancelCheckout, stopSubscription, syncPaymentStatus, getInvoice, getPaymentHistory } from '../controllers/paymentController.js';

const router = express.Router();

// Rate limit for sync endpoint to prevent spam/abuse (5 requests per 15 minutes)
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many sync attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public webhook route (Signature is verified inside controller)
router.post('/webhook', handleWebhook);

// Protected routes (apply middleware globally for these routes)
router.use(protect);
router.use(timezoneMiddleware);

router.post('/create-subscription', createSubscription);
router.post('/status', checkPaymentStatus);
router.post('/checkout/cancel', cancelCheckout);
router.post('/subscription/stop', stopSubscription);
router.post('/sync', syncLimiter, syncPaymentStatus);
router.get('/invoice/:paymentId', getInvoice);
router.get('/history', getPaymentHistory);

export default router;
