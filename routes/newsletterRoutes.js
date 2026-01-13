import express from 'express';
import { subscribe, handleWebhook, handleWebhookGet } from '../controllers/newsletterController.js';
import { rateLimit } from 'express-rate-limit'; // Using destructured import based on usage in other files likely

const router = express.Router();

// Specific rate limit for newsletter subscription to prevent spam
const newsletterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    message: 'Too many subscription attempts from this IP, please try again after an hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook routes (POST for events, GET for verification)
// Note: Webhooks might need to bypass standard rate limits if volume is high, but for now using standard
router.post('/webhook', handleWebhook);
router.get('/webhook', handleWebhookGet);

router.post('/subscribe', newsletterLimiter, subscribe);

export default router;
