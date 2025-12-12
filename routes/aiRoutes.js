/**
 * AI Routes
 * Routes for AI-powered features
 */

import express from 'express';
import asyncHandler from 'express-async-handler';
import aiController from '../controllers/aiController.js';
import { protect } from '../middlewares/authMiddleware.js';
import aiRateLimit from '../middlewares/aiRateLimit.js';

const router = express.Router();

/**
 * @route   POST /api/ai/parse-nlp
 * @desc    Parse natural language input to structured task
 * @access  Private
 */
router.post(
  '/parse-nlp',
  protect,
  aiRateLimit,
  asyncHandler(aiController.parseNLP.bind(aiController))
);

/**
 * @route   GET /api/ai/insights
 * @desc    Get AI-powered task insights
 * @access  Private
 */
router.get(
  '/insights',
  protect,
  aiRateLimit,
  asyncHandler(aiController.getInsights.bind(aiController))
);

/**
 * @route   POST /api/ai/weekly-plan
 * @desc    Generate AI-powered weekly plan
 * @access  Private
 */
router.post(
  '/weekly-plan',
  protect,
  aiRateLimit,
  asyncHandler(aiController.generateWeeklyPlan.bind(aiController))
);

/**
 * @route   GET /api/ai/similar/:taskId
 * @desc    Find similar tasks using AI
 * @access  Private
 */
router.get(
  '/similar/:taskId',
  protect,
  aiRateLimit,
  asyncHandler(aiController.findSimilarTasks.bind(aiController))
);

/**
 * @route   POST /api/ai/chat
 * @desc    Chat with AI assistant
 * @access  Private
 */
router.post(
  '/chat',
  protect,
  aiRateLimit,
  asyncHandler(aiController.chat.bind(aiController))
);

/**
 * @route   POST /api/ai/quick-suggestions
 * @desc    Get quick action suggestions
 * @access  Private
 */
router.post(
  '/quick-suggestions',
  protect,
  aiRateLimit,
  asyncHandler(aiController.getQuickSuggestions.bind(aiController))
);

/**
 * @route   POST /api/ai/analyze-intent
 * @desc    Analyze user intent from message
 * @access  Private
 */
router.post(
  '/analyze-intent',
  protect,
  aiRateLimit,
  asyncHandler(aiController.analyzeIntent.bind(aiController))
);

/**
 * @route   GET /api/ai/test
 * @desc    Test OpenAI connection and configuration
 * @access  Private
 */
router.get(
  '/test',
  protect,
  asyncHandler(aiController.testAIConnection.bind(aiController))
);

export default router;
