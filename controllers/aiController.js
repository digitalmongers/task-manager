/**
 * AI Controller
 * Handles AI-only endpoints (NLP, insights, planning, similarity)
 */

import AIService from '../services/ai/aiService.js';
import ChatbotService from '../services/ai/chatbotService.js';
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

    if (parsedTask && parsedTask.error) {
      throw ApiError.serviceUnavailable(parsedTask.error);
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

    if (insights && insights.error) {
      throw ApiError.serviceUnavailable(insights.error);
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

    if (weeklyPlan && weeklyPlan.error) {
      throw ApiError.serviceUnavailable(weeklyPlan.error);
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

    if (similarTasks && similarTasks.error) {
      throw ApiError.serviceUnavailable(similarTasks.error);
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

  /**
   * Chat with AI assistant
   * POST /api/ai/chat
   */
  async chat(req, res) {
    const { message, conversationHistory } = req.body;

    if (!message || typeof message !== 'string') {
      throw ApiError.badRequest('Message is required');
    }

    if (!ChatbotService) {
      throw ApiError.serviceUnavailable('Chatbot service is not configured');
    }

    const result = await ChatbotService.chat(
      req.user._id,
      message,
      conversationHistory || []
    );

    if (result && result.error) {
      throw ApiError.serviceUnavailable(result.error);
    }

    Logger.logActivity('AI_CHAT', req.user._id, {
      messageLength: message.length,
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Chat response generated',
      result
    );
  }

  /**
   * Get quick suggestions
   * POST /api/ai/quick-suggestions
   */
  async getQuickSuggestions(req, res) {
    const { query } = req.body;

    if (!query) {
      throw ApiError.badRequest('Query is required');
    }

    const suggestions = await ChatbotService.getQuickSuggestions(
      req.user._id,
      query
    );

    if (suggestions && suggestions.error) {
      throw ApiError.serviceUnavailable(suggestions.error);
    }

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Quick suggestions generated',
      { suggestions }
    );
  }

  /**
   * Analyze user intent
   * POST /api/ai/analyze-intent
   */
  async analyzeIntent(req, res) {
    const { message } = req.body;

    if (!message) {
      throw ApiError.badRequest('Message is required');
    }

    const intent = await ChatbotService.analyzeIntent(message);

    if (intent && intent.error) {
      throw ApiError.serviceUnavailable(intent.error);
    }

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Intent analyzed',
      { intent }
    );
  }

  /**
   * Test AI connection
   * GET /api/ai/test
   */
  async testAIConnection(req, res) {
    try {
      // Check if AI is enabled
      if (!AIService.isEnabled()) {
        return ApiResponse.success(
          res,
          HTTP_STATUS.OK,
          'AI Test Results',
          {
            status: 'disabled',
            message: 'OpenAI API key not configured',
            config: {
              hasApiKey: false,
              model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            }
          }
        );
      }

      // Try a simple API call
      const testResult = await AIService.callOpenAI(
        'You are a helpful assistant.',
        'Reply with just "OK" if you can read this.'
      );

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'AI connection successful',
        {
          status: 'connected',
          message: 'OpenAI API is working correctly',
          testResponse: testResult,
          config: {
            hasApiKey: true,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          }
        }
      );
    } catch (error) {
      Logger.error('AI connection test failed', {
        error: error.message,
        status: error.status,
        code: error.code,
      });

      return ApiResponse.success(
        res,
        HTTP_STATUS.OK,
        'AI connection test failed',
        {
          status: 'error',
          message: error.message,
          errorType: error.constructor.name,
          statusCode: error.status || error.statusCode,
          errorCode: error.code,
          config: {
            hasApiKey: !!process.env.OPENAI_API_KEY,
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          }
        }
      );
    }
  }
}

export default new AIController();
