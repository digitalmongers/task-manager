import express from 'express';
import { createOrder, checkPaymentStatus, handleWebhook, cancelPayment, syncPaymentStatus, getInvoice } from '../controllers/paymentController.js';
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
router.post('/webhook', express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}), handleWebhook);

// Protected routes
router.post('/create-order', protect, createOrder);
router.post('/status', protect, checkPaymentStatus);
router.post('/cancel', protect, cancelPayment);
router.post('/sync', protect, syncLimiter, syncPaymentStatus);
router.get('/invoice/:paymentId', protect, getInvoice);

export default router;
