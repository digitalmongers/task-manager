import express from 'express';
import { createOrder, checkPaymentStatus, handleWebhook, cancelPayment, syncPaymentStatus, getInvoice } from '../controllers/paymentController.js';
import { protect } from '../middlewares/authMiddleware.js';

const router = express.Router();

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
router.post('/sync', protect, syncPaymentStatus);
router.get('/invoice/:paymentId', protect, getInvoice);

export default router;
