import express from 'express';
import SuggestionController from '../controllers/suggestionController.js';
import { suggestionValidation } from '../validators/suggestionValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for suggestions (prevent spam)
const suggestionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // Max 10000 suggestions per 5 minutes per user
  message: {
    success: false,
    message: 'Too many suggestions submitted. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All routes require authentication
router.use(protect);
router.use(timezoneMiddleware);

// Submit new suggestion
router.post(
  '/',
  suggestionLimiter,
  validate(suggestionValidation.submitSuggestion),
  asyncHandler(SuggestionController.submitSuggestion.bind(SuggestionController))
);

// Get user's suggestions
router.get(
  '/my-suggestions',
  validate(suggestionValidation.getUserSuggestions),
  asyncHandler(SuggestionController.getUserSuggestions.bind(SuggestionController))
);

// Get single suggestion
router.get(
  '/:id',
  validate(suggestionValidation.getSuggestion),
  asyncHandler(SuggestionController.getSuggestion.bind(SuggestionController))
);

export default router;