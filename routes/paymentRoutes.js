import express from 'express';
import { createSubscription, checkPaymentStatus, handleWebhook, cancelCheckout, stopSubscription, syncPaymentStatus, getInvoice, getPaymentHistory } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';
import rateLimit from 'express-rate-limit';

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

// Protected routes
router.post('/create-subscription', protect, createSubscription);
router.post('/status', protect, checkPaymentStatus);
router.post('/checkout/cancel', protect, cancelCheckout);
router.post('/subscription/stop', protect, stopSubscription);
router.post('/sync', protect, syncLimiter, syncPaymentStatus);
router.get('/invoice/:paymentId', protect, getInvoice);
router.get('/history', protect, getPaymentHistory);

export default router;
