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
import VitalTask from '../../models/VitalTask.js';
import AIPlan from '../../models/AIPlan.js';
import EmailService from '../emailService.js';
import User from '../../models/User.js';
import AIUsage from '../../models/AIUsage.js';
import { PLAN_LIMITS, AI_CONSTANTS } from '../../config/aiConfig.js';
import { countTokens, compressPrompt } from '../../utils/aiTokenUtils.js';
import ApiError from '../../utils/ApiError.js';
import cacheService from '../cacheService.js';
class AIService {
  constructor() {
    this.openai = openai;
  }

  /**
   * Check if AI service is properly configured
   */
  isEnabled() {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Centralized method to run AI features with plan-based limits
   */
  async run({ userId, feature, input, prompt, messages, systemPrompt = SYSTEM_PROMPTS.TASK_ASSISTANT }) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    // 1. Plan Enforcement: Check if AI usage is blocked
    if (user.aiUsageBlocked) {
      throw ApiError.forbidden('AI usage limit reached for your plan. Upgrade for more boosts.');
    }

    const plan = PLAN_LIMITS[user.plan];
    
    // 2. Feature Access Enforcement: Check if user has access to this specific feature
    if (!plan.aiFeatures.includes(feature) && !plan.aiFeatures.includes('ALL')) {
      throw ApiError.forbidden(`The ${feature} feature is not available on your current plan. Please upgrade to access this.`);
    }

    // 3. Token Safety & Compression (BEFORE AI CALL)
    // Support 'messages' (for chatbot) or 'input'/'prompt'
    let finalPrompt;
    let inputTokens;

    if (messages && Array.isArray(messages)) {
      // For messages, we count tokens for the whole array
      finalPrompt = JSON.stringify(messages);
      inputTokens = countTokens(finalPrompt);
    } else {
      const rawInput = input || prompt;
      finalPrompt = typeof rawInput === 'string' ? rawInput : JSON.stringify(rawInput);
      inputTokens = countTokens(finalPrompt);
    }

    // Hard Cap: Input Limit
    if (inputTokens > AI_CONSTANTS.MAX_INPUT_TOKENS) {
      throw ApiError.badRequest('Input is too long. Please shorten your request.');
    }

    // Soft Cap: Prompt Compression
    if (inputTokens > AI_CONSTANTS.COMPRESS_THRESHOLD_TOKENS) {
      finalPrompt = compressPrompt(finalPrompt);
      const originalTokens = inputTokens;
      inputTokens = countTokens(finalPrompt); // Re-count after compression
      Logger.info('Prompt compressed', { userId, originalTokens, compressedTokens: inputTokens });
    }

    // 4. Boost Calculation (Pre-flight check)
    const potentialBoosts = Math.ceil((inputTokens + plan.maxOutputTokens) / AI_CONSTANTS.BOOST_TOKEN_VALUE);
    
    if (user.usedBoosts + potentialBoosts > user.totalBoosts) {
      user.aiUsageBlocked = true;
      await user.save();
      
      // EMAIL NOTIFICATION: Notify user about boost exhaustion
      try {
        await EmailService.sendBoostExhaustionEmail(user);
      } catch (error) {
        Logger.error('Failed to send boost exhaustion email', { error: error.message, userId });
      }

      throw ApiError.forbidden('You have exhausted your AI boosts. Upgrade your plan to get more.');
    }

    // Does user have boosts remaining?
    if (user.usedBoosts >= user.totalBoosts) {
      throw new Error('You have reached your monthly AI boost limit. Please upgrade or wait for the next billing cycle.');
    }

    // Check maxBoostsPerRequest (Potential boosts)
    if (potentialBoosts > plan.maxBoostsPerRequest) {
      throw new Error(`This request might exceed your plan's boost limit per request. Please shorten your input.`);
    }

    try {
      const config = getConfig();
      
      // 5. OpenAI Call (HARD CAP)
      const openaiMessages = messages && Array.isArray(messages) ? messages : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalPrompt },
      ];

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Forced as per instructions
        messages: openaiMessages,
        max_tokens: Math.max(plan.maxOutputTokens, config.maxTokens || 0), // Use plan limit or env override, whichever is higher
        temperature: config.temperature || 0.7,
      });

      const choice = response.choices[0];
      const content = choice.message.content;
      const usage = response.usage;

      // Handle truncation error
      if (choice.finish_reason === 'length') {
        Logger.error('AI response truncated due to token limit', {
          userId,
          finishReason: choice.finish_reason,
          maxTokens: Math.max(plan.maxOutputTokens, config.maxTokens || 0)
        });
        throw new Error('AI response was too long and got truncated. Please try a shorter request or upgrade your plan.');
      }

      // 6. Boost Calculation (AFTER AI RESPONSE)
      const totalTokens = usage.total_tokens;
      const completionTokens = usage.completion_tokens;
      const promptsTokensUsed = usage.prompt_tokens;

      const boostsUsed = Math.ceil(totalTokens / AI_CONSTANTS.BOOST_TOKEN_VALUE);

      // 6. ABSOLUTE FAILSAFE
      if (totalTokens > AI_CONSTANTS.ABSOLUTE_FAILSAFE_TOKENS) {
        user.aiUsageBlocked = true;
        await user.save();
        Logger.error('ABSOLUTE FAILSAFE TRIGGERED', { userId, totalTokens });
        throw new Error('System safety limit reached. Account marked for review.');
      }


      // 7. Deduct boosts and Log
      user.usedBoosts += boostsUsed;
      await user.save();

      // Invalidate user cache to reflect new boost count immediately
      await cacheService.deletePattern(`user:${userId}:*`);

      await AIUsage.create({
        user: userId,
        plan: user.plan,
        feature,
        promptTokens: promptsTokensUsed,
        completionTokens: completionTokens,
        totalTokens: totalTokens,
        boostsUsed,
      });

      return content;
    } catch (error) {
      if (error.message.includes('safety limit')) throw error;
      
      Logger.error('AI Service Run failed', {
        userId,
        feature,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * @deprecated Use run() instead
   */
  async callOpenAI(systemPrompt, userPrompt) {
    // Redirect to run for backward compatibility where possible
    // This is risky as it lacks 'feature' and 'userId' context
    return this.run({ 
      userId: null, // This will fail if not provided
      feature: 'LEGACY_CALL',
      prompt: userPrompt,
      systemPrompt 
    });
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
      const response = await this.run({
        userId,
        feature: 'TASK_SUGGESTION',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

      // Parse response (now expecting an array)
      const suggestionsArray = parseJSONResponse(response);

      // Validate array structure
      if (!Array.isArray(suggestionsArray) || suggestionsArray.length === 0) {
        throw new Error('AI did not return a valid suggestions array');
      }

      // Validate each suggestion
      const validSuggestions = suggestionsArray.filter(s => validateSuggestions(s, 'task'));
      
      if (validSuggestions.length === 0) {
        throw new Error('No valid suggestions in response');
      }

      Logger.info('Task suggestions generated', {
        userId,
        title: sanitizedTitle,
        count: validSuggestions.length
      });

      // Return structured response for frontend
      return {
        suggestions: validSuggestions.slice(0, 5), // Ensure max 5
        count: validSuggestions.length
      };
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

      const response = await this.run({
        userId,
        feature: 'TASK_SUGGESTION',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.CATEGORY_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'TASK_SUGGESTION',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.PRIORITY_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'TASK_SUGGESTION',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.STATUS_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'VOICE_TASK',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'AI_INSIGHTS',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'AI_PLANNER',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

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

      const response = await this.run({
        userId,
        feature: 'TASK_SUGGESTION',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

      const similarTasks = parseJSONResponse(response);

      Logger.info('Similar tasks found', { userId, taskId });

      return similarTasks;
    } catch (error) {
      return handleAIError(error, 'findSimilarTasks');
    }
  }

  /**
   * Get the latest strategic plan for a user
   */
  async getLatestStrategicPlan(userId) {
    try {
      const plan = await AIPlan.findOne({ user: userId })
        .sort({ createdAt: -1 })
        .lean();

      if (!plan) return null;

      const isExpired = new Date() > new Date(plan.expiresAt);
      return { plan, isExpired };
    } catch (error) {
      Logger.error('Failed to fetch latest strategic plan', { userId, error: error.message });
      return null;
    }
  }

  /**
   * Generate an autonomous strategic plan based on existing tasks
   */
  async generateStrategicPlan(userId) {
    try {
      // 1. Fetch Context: Vital Tasks (All pending)
      const vitalTasks = await VitalTask.find({
        user: userId,
        isCompleted: false,
        isDeleted: false
      })
      .select('title description dueDate priority status steps')
      .lean();

      // 2. Fetch Context: High Priority Normal Tasks
      const normalTasks = await Task.find({
        user: userId,
        isCompleted: false,
        isDeleted: false,
        $or: [
          { priority: { $exists: true, $ne: null } },
          { dueDate: { $exists: true, $ne: null } }
        ]
      })
      .populate('priority', 'name')
      .select('title description dueDate priority status')
      .limit(10)
      .lean();

      // Filter to only high/urgent normal tasks if priority is populated
      const filteredNormal = normalTasks.filter(t => 
        !t.priority || ['high', 'urgent', 'High', 'Urgent'].includes(t.priority.name)
      );

      if (vitalTasks.length === 0 && filteredNormal.length === 0) {
        return { error: 'No active Vital or High-Priority tasks found to plan against.' };
      }

      // 3. Call AI
      const prompt = INSIGHTS_PROMPTS.STRATEGIC_PLAN(vitalTasks, filteredNormal);
      const response = await this.run({
        userId,
        feature: 'AI_PLANNER',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

      const planData = parseJSONResponse(response);
      if (!planData || planData.error) throw new Error('AI failed to generate a valid strategy');

      // 4. Persistence
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Valid for 24h

      const newPlan = await AIPlan.create({
        user: userId,
        planType: 'strategic',
        content: JSON.stringify(planData),
        focusSummary: planData.focusArea,
        sourceTasks: [
          ...vitalTasks.map(t => ({ taskId: t._id, taskModel: 'VitalTask', title: t.title })),
          ...filteredNormal.map(t => ({ taskId: t._id, taskModel: 'Task', title: t.title }))
        ],
        expiresAt
      });

      Logger.info('Autonomous Strategic Plan generated and persisted', { userId, planId: newPlan._id });

      return newPlan;
    } catch (error) {
      return handleAIError(error, 'generateStrategicPlan');
    }
  }
}

export default new AIService();
