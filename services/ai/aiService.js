/**
 * AI Service
 * Main service for all AI-powered features
 */

import openai, { getConfig } from '../../config/openai.js';
import {
  SYSTEM_PROMPTS,
  TASK_PROMPTS,
  CATEGORY_PROMPTS,
  PRIORITY_PROMPTS,
  STATUS_PROMPTS,
  INSIGHTS_PROMPTS,
  SIMILARITY_PROMPTS,
} from './aiPrompts.js';
import {
  parseJSONResponse,
  sanitizeInput,
  formatUserContext,
  validateSuggestions,
  handleAIError,
  extractKeywords,
  calculateSimilarity,
} from './aiHelpers.js';
import Logger from '../../config/logger.js';
import Category from '../../models/Category.js';
import TaskPriority from '../../models/TaskPriority.js';
import TaskStatus from '../../models/TaskStatus.js';
import Task from '../../models/Task.js';

class AIService {
  /**
   * Check if AI is enabled
   */
  isEnabled() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(systemPrompt, userPrompt) {
    if (!this.isEnabled()) {
      throw new Error('AI service not configured');
    }

    try {
      const config = getConfig();
      
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      return response.choices[0].message.content;
    } catch (error) {
      Logger.error('OpenAI API call failed', {
        error: error.message,
        errorType: error.constructor.name,
        statusCode: error.status || error.statusCode,
        errorCode: error.code,
        model: getConfig().model,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get user's existing data for context
   */
  async getUserContext(userId) {
    try {
      const [categories, priorities, statuses] = await Promise.all([
        Category.find({ user: userId }).select('title').lean(),
        TaskPriority.find({ user: userId }).select('name').lean(),
        TaskStatus.find({ user: userId }).select('name').lean(),
      ]);

      return formatUserContext(categories, priorities, statuses);
    } catch (error) {
      Logger.error('Failed to get user context', { error: error.message });
      return { categories: [], priorities: [], statuses: [] };
    }
  }

  /**
   * Generate task suggestions
   */
  async generateTaskSuggestions(data) {
    try {
      const { title, description, userId } = data;
      
      // Sanitize inputs
      const sanitizedTitle = sanitizeInput(title);
      const sanitizedDescription = sanitizeInput(description);

      // Get user context
      const userContext = await this.getUserContext(userId);

      // Build prompt
      const prompt = TASK_PROMPTS.SUGGESTIONS({
        title: sanitizedTitle,
        description: sanitizedDescription,
        userCategories: userContext.categories,
        userPriorities: userContext.priorities,
        userStatuses: userContext.statuses,
      });

      // Call AI
      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.TASK_ASSISTANT,
        prompt
      );

      // Parse response
      const suggestions = parseJSONResponse(response);

      // Validate
      if (!validateSuggestions(suggestions, 'task')) {
        throw new Error('Invalid suggestions format');
      }

      Logger.info('Task suggestions generated', {
        userId,
        title: sanitizedTitle,
      });

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'generateTaskSuggestions');
    }
  }

  /**
   * Generate vital task suggestions (same as task but force high priority)
   */
  async generateVitalTaskSuggestions(data) {
    try {
      const suggestions = await this.generateTaskSuggestions(data);
      
      // Force high priority for vital tasks
      if (suggestions && !suggestions.error) {
        suggestions.suggestedPriority = 'urgent';
        suggestions.isVital = true;
      }

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'generateVitalTaskSuggestions');
    }
  }

  /**
   * Generate category suggestions
   */
  async generateCategorySuggestions(data) {
    try {
      const { title, userId } = data;
      
      const sanitizedTitle = sanitizeInput(title);

      // Get existing categories
      const existingCategories = await Category.find({ user: userId })
        .select('title')
        .lean();

      const prompt = CATEGORY_PROMPTS.SUGGESTIONS({
        title: sanitizedTitle,
        existingCategories: existingCategories.map(c => c.title),
      });

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.CATEGORY_ASSISTANT,
        prompt
      );

      const suggestions = parseJSONResponse(response);

      if (!validateSuggestions(suggestions, 'category')) {
        throw new Error('Invalid suggestions format');
      }

      Logger.info('Category suggestions generated', {
        userId,
        title: sanitizedTitle,
      });

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'generateCategorySuggestions');
    }
  }

  /**
   * Generate priority suggestions
   */
  async generatePrioritySuggestions(data) {
    try {
      const { name, userId } = data;
      
      const sanitizedName = sanitizeInput(name);

      // Get existing priorities
      const existingPriorities = await TaskPriority.find({ user: userId })
        .select('name')
        .lean();

      const prompt = PRIORITY_PROMPTS.SUGGESTIONS({
        name: sanitizedName,
        existingPriorities: existingPriorities.map(p => p.name),
      });

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.PRIORITY_ASSISTANT,
        prompt
      );

      const suggestions = parseJSONResponse(response);

      if (!validateSuggestions(suggestions, 'priority')) {
        throw new Error('Invalid suggestions format');
      }

      Logger.info('Priority suggestions generated', {
        userId,
        name: sanitizedName,
      });

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'generatePrioritySuggestions');
    }
  }

  /**
   * Generate status suggestions
   */
  async generateStatusSuggestions(data) {
    try {
      const { name, userId } = data;
      
      const sanitizedName = sanitizeInput(name);

      // Get existing statuses
      const existingStatuses = await TaskStatus.find({ user: userId })
        .select('name')
        .lean();

      const prompt = STATUS_PROMPTS.SUGGESTIONS({
        name: sanitizedName,
        existingStatuses: existingStatuses.map(s => s.name),
      });

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.STATUS_ASSISTANT,
        prompt
      );

      const suggestions = parseJSONResponse(response);

      if (!validateSuggestions(suggestions, 'status')) {
        throw new Error('Invalid suggestions format');
      }

      Logger.info('Status suggestions generated', {
        userId,
        name: sanitizedName,
      });

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'generateStatusSuggestions');
    }
  }

  /**
   * Parse natural language input to task
   */
  async parseNaturalLanguage(input, userId) {
    try {
      const sanitizedInput = sanitizeInput(input);

      const prompt = TASK_PROMPTS.NLP_PARSE(sanitizedInput);

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.TASK_ASSISTANT,
        prompt
      );

      const parsedTask = parseJSONResponse(response);

      Logger.info('NLP task parsed', {
        userId,
        input: sanitizedInput.substring(0, 50),
      });

      return parsedTask;
    } catch (error) {
      return handleAIError(error, 'parseNaturalLanguage');
    }
  }

  /**
   * Get task insights
   */
  async getTaskInsights(userId) {
    try {
      // Get user's tasks
      const tasks = await Task.find({ user: userId, isDeleted: false })
        .select('title description isCompleted dueDate priority status category createdAt completedAt')
        .populate('category', 'title')
        .populate('priority', 'name')
        .populate('status', 'name')
        .limit(50)
        .lean();

      if (tasks.length === 0) {
        return {
          insights: ['No tasks found. Create some tasks to get insights!'],
          recommendations: [],
          productivity: {},
        };
      }

      const prompt = INSIGHTS_PROMPTS.ANALYZE_TASKS(tasks);

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.TASK_ASSISTANT,
        prompt
      );

      const insights = parseJSONResponse(response);

      Logger.info('Task insights generated', { userId, taskCount: tasks.length });

      return insights;
    } catch (error) {
      return handleAIError(error, 'getTaskInsights');
    }
  }

  /**
   * Generate weekly plan
   */
  async generateWeeklyPlan(userId, preferences = {}) {
    try {
      // Get pending tasks
      const tasks = await Task.find({
        user: userId,
        isCompleted: false,
        isDeleted: false,
      })
        .select('title description dueDate priority status')
        .populate('priority', 'name')
        .populate('status', 'name')
        .lean();

      if (tasks.length === 0) {
        return {
          weekPlan: {},
          summary: 'No pending tasks to plan.',
        };
      }

      const prompt = INSIGHTS_PROMPTS.WEEKLY_PLAN(tasks, preferences);

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.TASK_ASSISTANT,
        prompt
      );

      const weeklyPlan = parseJSONResponse(response);

      Logger.info('Weekly plan generated', { userId, taskCount: tasks.length });

      return weeklyPlan;
    } catch (error) {
      return handleAIError(error, 'generateWeeklyPlan');
    }
  }

  /**
   * Find similar tasks
   */
  async findSimilarTasks(taskId, userId) {
    try {
      let targetTask = null;

      // Check if first argument is an ID (string) or draft object
      if (typeof taskId === 'string' && taskId.match(/^[0-9a-fA-F]{24}$/)) {
        // It's an ID, fetch from DB
        targetTask = await Task.findOne({ _id: taskId, user: userId })
          .select('title description category priority')
          .lean();
          
        if (!targetTask) {
          throw new Error('Task not found');
        }
      } else if (typeof taskId === 'object' && taskId !== null) {
         // It's a draft object { title, description }
         targetTask = taskId;
      } else {
         throw new Error('Invalid task identifier or draft data');
      }

      // Get all user tasks
      const allTasks = await Task.find({
        user: userId,
        _id: { $ne: targetTask._id }, // Exclude itself if it exists (for drafts _id might be undefined, which is fine)
        isDeleted: false,
      })
        .select('title description category priority')
        .limit(20)
        .lean();

      const prompt = SIMILARITY_PROMPTS.FIND_SIMILAR(targetTask, allTasks);

      const response = await this.callOpenAI(
        SYSTEM_PROMPTS.TASK_ASSISTANT,
        prompt
      );

      const similarTasks = parseJSONResponse(response);

      Logger.info('Similar tasks found', { userId, taskId });

      return similarTasks;
    } catch (error) {
      return handleAIError(error, 'findSimilarTasks');
    }
  }
}

export default new AIService();
