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
import { formatToLocal } from '../utils/dateUtils.js';

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
   * POST /api/ai/similar (for drafts)
   */
  async findSimilarTasks(req, res) {
    let taskIdOrDraft;
    
    if (req.method === 'GET') {
       taskIdOrDraft = req.params.taskId;
    } else {
       taskIdOrDraft = req.body; // { title, description }
    }

    if (!taskIdOrDraft) {
      throw ApiError.badRequest('Task ID or draft data is required');
    }

    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const similarTasks = await AIService.findSimilarTasks(
      taskIdOrDraft,
      req.user._id
    );

    if (similarTasks && similarTasks.error) {
      throw ApiError.serviceUnavailable(similarTasks.error);
    }

    Logger.logActivity('AI_SIMILAR_TASKS_FOUND', req.user._id, {
      source: req.method === 'GET' ? 'existing_task' : 'draft',
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
   * Suggest task details (Category, Priority, etc.)
   * POST /api/ai/suggest/task
   */
  async suggestTask(req, res) {
    const { title, description } = req.body;

    if (!title) {
       throw ApiError.badRequest('Title is required for suggestions');
    }

    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const suggestions = await AIService.generateTaskSuggestions({
      title,
      description,
      userId: req.user._id
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Task suggestions generated',
      { suggestions }
    );
  }

  /**
   * Suggest categories
   * POST /api/ai/suggest/category
   */
  async suggestCategory(req, res) {
    const { title } = req.body; 

    if (!title) {
       throw ApiError.badRequest('Title is required');
    }

    const suggestions = await AIService.generateCategorySuggestions({
      title,
      userId: req.user._id
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Category suggestions generated',
      { suggestions }
    );
  }

  /**
   * Suggest priority
   * POST /api/ai/suggest/priority
   */
  async suggestPriority(req, res) {
    const { name } = req.body; // Using 'name' as context like task title

    if (!name) {
       throw ApiError.badRequest('Task title/name is required');
    }

    const suggestions = await AIService.generatePrioritySuggestions({
      name,
      userId: req.user._id
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Priority suggestions generated',
      { suggestions }
    );
  }

  /**
   * Suggest status
   * POST /api/ai/suggest/status
   */
  async suggestStatus(req, res) {
    const { name } = req.body;

    if (!name) {
       throw ApiError.badRequest('Task title/name is required');
    }

    const suggestions = await AIService.generateStatusSuggestions({
      name,
      userId: req.user._id
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Status suggestions generated',
      { suggestions }
    );
  }

  /**
   * Chat with AI assistant
   * POST /api/ai/chat
   */
  /**
   * Chat with AI assistant
   * POST /api/ai/chat
   */
  async chat(req, res) {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string') {
      throw ApiError.badRequest('Message is required');
    }

    if (!ChatbotService) {
      throw ApiError.serviceUnavailable('Chatbot service is not configured');
    }

    // Pass conversationId (optional) to service
    const result = await ChatbotService.chat(
      req.user._id,
      message,
      conversationId
    );

    if (result && result.error) {
      throw ApiError.serviceUnavailable(result.error);
    }

    Logger.logActivity('AI_CHAT', req.user._id, {
      messageLength: message.length,
      conversationId: result.conversationId
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Chat response generated',
      result
    );
  }

  /**
   * Get chat history
   * GET /api/ai/chat/history
   * GET /api/ai/chat/history/:conversationId
   */
  async getChatHistory(req, res) {
    const { conversationId } = req.params;

    const history = await ChatbotService.getChatHistory(
      req.user._id,
      conversationId
    );

    // Localize timestamps for chatbot history
    const localizedHistory = history.map(msg => ({
      ...msg,
      timestampLocal: formatToLocal(msg.timestamp || msg.createdAt, req.timezone),
    }));

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Chat history retrieved',
      { history: localizedHistory }
    );
  }

  /**
   * Delete conversation
   * DELETE /api/ai/chat/history/:conversationId
   */
  async deleteConversation(req, res) {
    const { conversationId } = req.params;

    if (!conversationId) {
      throw ApiError.badRequest('Conversation ID is required');
    }

    await ChatbotService.deleteConversation(req.user._id, conversationId);

    Logger.logActivity('AI_CHAT_DELETE', req.user._id, {
      conversationId
    });

    return ApiResponse.success(
      res,
      HTTP_STATUS.OK,
      'Conversation deleted successfully'
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

    const intent = await ChatbotService.analyzeIntent(req.user._id, message);

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

      // Try a simple API call using run() to verify complete flow
      const testResult = await AIService.run({
        userId: req.user._id,
        feature: 'TASK_SUGGESTION', // Using a standard feature for test
        prompt: 'Reply with just "OK" if you can read this.',
        systemPrompt: 'You are a helpful assistant.'
      });

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
  /**
   * Get the persistent strategic plan (Enterprise Planner)
   * GET /api/ai/planner
   */
  async getPlannerStrategy(req, res) {
    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const result = await AIService.getLatestStrategicPlan(req.user._id);
    
    // If no plan exists, generate one pro-actively
    if (!result) {
      const newPlan = await AIService.generateStrategicPlan(req.user._id);
      
      if (newPlan && newPlan.error) {
        return ApiResponse.success(res, 200, 'No active tasks to plan', { plan: null });
      }

      return ApiResponse.success(res, 200, 'New strategic plan generated', { 
        plan: newPlan,
        isNew: true 
      });
    }

    return ApiResponse.success(res, 200, 'Strategic plan retrieved', {
      plan: result.plan,
      isExpired: result.isExpired
    });
  }

  /**
   * Force refresh the strategic plan
   * POST /api/ai/planner/refresh
   */
  async refreshPlannerStrategy(req, res) {
    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const newPlan = await AIService.generateStrategicPlan(req.user._id);

    if (newPlan && newPlan.error) {
      throw ApiError.badRequest(newPlan.error);
    }

    return ApiResponse.success(res, 200, 'Strategic plan refreshed successfully', {
      plan: newPlan
    });
  }

  /**
   * Get 3 CEO-level alternative strategies
   * POST /api/ai/planner/alternative
   */
  async getAlternativeStrategies(req, res) {
    if (!AIService.isEnabled()) {
      throw ApiError.serviceUnavailable('AI service is not configured');
    }

    const strategies = await AIService.generateAlternativeStrategies(req.user._id);

    if (strategies && strategies.error) {
      throw ApiError.badRequest(strategies.error);
    }

    return ApiResponse.success(res, 200, 'Alternative strategies generated successfully', {
      strategies
    });
  }
}

export default new AIController();
