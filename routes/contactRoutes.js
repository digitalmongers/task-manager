import express from 'express';
import ContactController from '../controllers/contactController.js';
import { contactValidation } from '../validators/contactValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for contact form (prevent spam)
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 submissions per hour per IP
  message: {
    success: false,
    message: 'Too many contact requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Contact form submission
router.post(
  '/support',
  contactLimiter,
  validate(contactValidation.sendMessage),
  asyncHandler(ContactController.sendMessage.bind(ContactController))
);

export default router;