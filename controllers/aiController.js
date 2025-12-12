/**
 * AI Controller
 * Handles AI-only endpoints (NLP, insights, planning, similarity)
 */

import AIService from '../services/ai/aiService.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { HTTP_STATUS } from '../config/constants.js';
import Logger from '../config/logger.js';

class AIController {
  /**
   * Parse natural language input to task
   * POST /api/ai/parse-nlp
   */
  async parseNLP(req, res) {
    const { input } = req.body;

    if (!input || typeof input !== 'string') {
      throw ApiError.badRequest('Input text is required');
    }

    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const parsedTask = await AIService.parseNaturalLanguage(
      input,
      req.user._id
    );

    if (parsedTask.error) {
      throw ApiError.internalServerError(parsedTask.error);
    }

    Logger.logActivity('AI_NLP_PARSE', req.user._id, {
      input: input.substring(0, 50),
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task parsed successfully',
      { parsedTask }
    );
  }

  /**
   * Get task insights
   * GET /api/ai/insights
   */
  async getInsights(req, res) {
    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const insights = await AIService.getTaskInsights(req.user._id);

    if (insights.error) {
      throw ApiError.internalServerError(insights.error);
    }

    Logger.logActivity('AI_INSIGHTS_GENERATED', req.user._id, {
      insightCount: insights.insights?.length || 0,
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Insights generated successfully',
      { insights }
    );
  }

  /**
   * Generate weekly plan
   * POST /api/ai/weekly-plan
   */
  async generateWeeklyPlan(req, res) {
    const preferences = req.body || {};

    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const weeklyPlan = await AIService.generateWeeklyPlan(
      req.user._id,
      preferences
    );

    if (weeklyPlan.error) {
      throw ApiError.internalServerError(weeklyPlan.error);
    }

    Logger.logActivity('AI_WEEKLY_PLAN_GENERATED', req.user._id, {
      preferences,
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Weekly plan generated successfully',
      { weeklyPlan }
    );
  }

  /**
   * Find similar tasks
   * GET /api/ai/similar/:taskId
   */
  async findSimilarTasks(req, res) {
    const { taskId } = req.params;

    if (!taskId) {
      throw ApiError.badRequest('Task ID is required');
    }

    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const similarTasks = await AIService.findSimilarTasks(
      taskId,
      req.user._id
    );

    if (similarTasks.error) {
      throw ApiError.internalServerError(similarTasks.error);
    }

    Logger.logActivity('AI_SIMILAR_TASKS_FOUND', req.user._id, {
      taskId,
      similarCount: similarTasks.similarTasks?.length || 0,
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Similar tasks found',
      { similarTasks }
    );
  }
}

export default new AIController();
