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
import WebSocketService from '../../config/websocket.js';
import { formatToLocal, getLocalDayRange } from '../../utils/dateUtils.js';
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
  async run({ userId, feature, input, prompt, messages, systemPrompt = SYSTEM_PROMPTS.TASK_ASSISTANT, tools = null, tool_choice = null }) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    if (user.aiUsageBlocked) {
      throw ApiError.forbidden('AI usage limit reached for your plan. Upgrade for more boosts.');
    }

    const plan = PLAN_LIMITS[user.plan];

    // --- NEW: Trial & Monthly Reset Check ---
    const now = new Date();
    const createdAt = user.createdAt || now;
    const daysSinceCreation = (now - createdAt) / (1000 * 60 * 60 * 24);

    // 1. FREE PLAN TRIAL EXPIRATION (30 Days)
    if (user.plan === 'FREE' && daysSinceCreation > 30) {
      if (!user.aiUsageBlocked) {
        user.aiUsageBlocked = true;
        await user.save();
        Logger.info('Free trial expired (30 days reached)', { userId });
      }
      throw ApiError.forbidden('Your 30-day free trial for AI features has expired. Please upgrade to a paid plan to continue using AI.');
    }

    // 2. Monthly Reset Check (Paid Plans only for authorizations, etc.)
    const lastReset = user.lastMonthlyReset || createdAt;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    if (now - lastReset > thirtyDaysInMs) {
      user.monthlyUsedBoosts = 0;
      user.lastMonthlyReset = now;
      
      // NOTE: Removed AUTO-REFILL for FREE plan. 
      // FREE plan boosts are now one-time (100) and do not reset/refill.
      
      await user.save();
      Logger.info('Monthly boost usage reset', { userId });
    }
    // -------------------------------------
    
    // 2. Feature Access Enforcement: Check if user has access to this specific feature
    if (!plan.aiFeatures.includes(feature) && !plan.aiFeatures.includes('ALL')) {
      throw ApiError.forbidden(`The ${feature} feature is not available on your current plan. Please upgrade to access this.`);
    }

    // --- NEW: Timezone Awareness ---
    // Inject user's local time into system prompt
    const userTimezone = user.timezone || 'UTC';
    const localTimeStr = formatToLocal(new Date(), userTimezone, { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const timeContext = `\n\nUSER_CONTEXT: The user's current local time is ${localTimeStr}. Their timezone is ${userTimezone}. Use this for all date-related calculations and responses.`;
    const modifiedSystemPrompt = systemPrompt + timeContext;

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

    // 4. Boost Calculation (Pre-flight check with separate tracking)
    const potentialBoosts = Math.ceil((inputTokens + plan.maxOutputTokens) / AI_CONSTANTS.BOOST_TOKEN_VALUE);
    
    // Calculate available boosts from both sources
    const subscriptionAvailable = (user.subscriptionBoosts || 0) - (user.subscriptionBoostsUsed || 0);
    const topupAvailable = (user.topupBoosts || 0) - (user.topupBoostsUsed || 0);
    const totalAvailable = subscriptionAvailable + topupAvailable;
    
    // Check if user has enough total boosts
    if (totalAvailable < potentialBoosts) {
      user.aiUsageBlocked = true;
      await user.save();
      
      // EMAIL NOTIFICATION: Notify user about boost exhaustion
      try {
        await EmailService.sendBoostExhaustionEmail(user);
      } catch (error) {
        Logger.error('Failed to send boost exhaustion email', { error: error.message, userId });
      }

      throw ApiError.forbidden('You have exhausted your AI boosts. Upgrade your plan or purchase a top-up to get more.');
    }

    // For YEARLY plans: Check monthly limit (applies ONLY to subscription boosts)
    if (user.billingCycle === 'YEARLY') {
      const monthlyLimit = plan.monthlyBoosts;
      const monthlyRemaining = monthlyLimit - (user.monthlyUsedBoosts || 0);
      
      // Calculate how many subscription boosts we'll need
      const subscriptionBoostsNeeded = Math.min(potentialBoosts, subscriptionAvailable);
      
      // If trying to use more subscription boosts than monthly limit allows
      if (subscriptionBoostsNeeded > monthlyRemaining) {
        // Check if top-up boosts can cover the difference
        const deficit = subscriptionBoostsNeeded - monthlyRemaining;
        if (deficit > topupAvailable) {
          throw ApiError.forbidden(
            `Monthly limit reached. You have ${monthlyRemaining} subscription boosts remaining this month ` +
            `and ${topupAvailable} top-up boosts. This request needs ${potentialBoosts} boosts total.`
          );
        }
      }
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

      // Call OpenAI with modified system prompt
      const response = await this.openai.chat.completions.create({
        model: AI_CONSTANTS.MODEL,
        messages: [
          { role: 'system', content: modifiedSystemPrompt },
          ...(messages || [{ role: 'user', content: finalPrompt }])
        ],
        max_tokens: plan.maxOutputTokens,
        temperature: 0.7,
        tools: tools,
        tool_choice: tool_choice
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


      // 7. Deduct boosts (subscription first, then top-up)
      let remaining = boostsUsed;
      
      // Recalculate available boosts
      const subAvailable = (user.subscriptionBoosts || 0) - (user.subscriptionBoostsUsed || 0);
      const topAvailable = (user.topupBoosts || 0) - (user.topupBoostsUsed || 0);
      
      // 1. Deduct from subscription boosts first
      if (subAvailable > 0 && remaining > 0) {
        const fromSubscription = Math.min(remaining, subAvailable);
        user.subscriptionBoostsUsed = (user.subscriptionBoostsUsed || 0) + fromSubscription;
        user.monthlyUsedBoosts = (user.monthlyUsedBoosts || 0) + fromSubscription; // Track for yearly monthly limit
        remaining -= fromSubscription;
        
        Logger.info('Deducted from subscription boosts', {
          userId,
          deducted: fromSubscription,
          subscriptionBoostsUsed: user.subscriptionBoostsUsed,
          subscriptionBoostsRemaining: (user.subscriptionBoosts || 0) - user.subscriptionBoostsUsed
        });
      }
      
      // 2. Deduct remaining from top-up boosts
      if (topAvailable > 0 && remaining > 0) {
        const fromTopup = Math.min(remaining, topAvailable);
        user.topupBoostsUsed = (user.topupBoostsUsed || 0) + fromTopup;
        remaining -= fromTopup;
        // Note: Top-up boosts do NOT count toward monthlyUsedBoosts
        
        Logger.info('Deducted from top-up boosts', {
          userId,
          deducted: fromTopup,
          topupBoostsUsed: user.topupBoostsUsed,
          topupBoostsRemaining: (user.topupBoosts || 0) - user.topupBoostsUsed
        });
      }
      
      await user.save();

      // Invalidate user cache to reflect new boost count immediately
      await cacheService.deletePattern(`user:${userId}:*`);

      // Real-time Update via WebSocket (New)
      const totalUsed = (user.subscriptionBoostsUsed || 0) + (user.topupBoostsUsed || 0);
      const totalBoosts = (user.subscriptionBoosts || 0) + (user.topupBoosts || 0);
      
      WebSocketService.sendToUser(userId, 'user:updated', {
        _id: user._id,
        subscriptionBoosts: user.subscriptionBoosts,
        subscriptionBoostsUsed: user.subscriptionBoostsUsed,
        topupBoosts: user.topupBoosts,
        topupBoostsUsed: user.topupBoostsUsed,
        usedBoosts: totalUsed,
        totalBoosts: totalBoosts,
        monthlyUsedBoosts: user.monthlyUsedBoosts,
        monthlyLimit: plan.monthlyBoosts,
        aiUsageBlocked: user.aiUsageBlocked
      });

      await AIUsage.create({
        user: userId,
        plan: user.plan,
        feature,
        promptTokens: promptsTokensUsed,
        completionTokens: completionTokens,
        totalTokens: totalTokens,
        boostsUsed,
      });

      // If tool calls are present, return the whole message object
      // Otherwise return just the content string for backward compatibility
      return choice.message.tool_calls ? choice.message : content;
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
   * Get user's existing data for context (Cached for 10 minutes)
   */
  async getUserContext(userId) {
    const cacheKey = `user:${userId}:ai_context`;
    return await cacheService.remember(cacheKey, 600, async () => {
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
    });
  }

  /**
   * Generate task suggestions (Cached for 1 hour for identical queries)
   */
  async generateTaskSuggestions(data) {
    try {
      const { title, description, userId } = data;
      
      // Sanitize inputs
      const sanitizedTitle = sanitizeInput(title);
      const sanitizedDescription = sanitizeInput(description);

      // Cache key based on user and input content
      const cacheKey = `ai_suggestions:task:${userId}:${Buffer.from(sanitizedTitle + sanitizedDescription).toString('base64').substring(0, 32)}`;

      return await cacheService.remember(cacheKey, 3600, async () => {
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
      });
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
      // Get user's tasks (Regular)
      const tasks = await Task.find({ user: userId, isDeleted: false })
        .select('title description isCompleted dueDate priority status category createdAt completedAt')
        .populate('category', 'title')
        .populate('priority', 'name')
        .populate('status', 'name')
        .sort({ updatedAt: -1 })
        .limit(30)
        .lean();

      // Get user's Vital Tasks
      const vitalTasks = await VitalTask.find({ user: userId, isDeleted: false })
        .select('title description isCompleted dueDate priority status createdAt completedAt')
        .limit(20)
        .lean();

      // Combine them (mark vital tasks for context)
      const allTasks = [
        ...tasks.map(t => ({ ...t, type: 'Regular' })),
        ...vitalTasks.map(t => ({ ...t, type: 'Vital', priority: { name: 'Urgent' } })) // Vital tasks are inherently urgent
      ];

      if (allTasks.length === 0) {
        return {
          insights: ['No tasks found. Create some tasks to get insights!'],
          recommendations: [],
          productivity: {},
        };
      }

      const prompt = INSIGHTS_PROMPTS.ANALYZE_TASKS(allTasks);

      const response = await this.run({
        userId,
        feature: 'AI_INSIGHTS',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

      const insights = parseJSONResponse(response);

      Logger.info('Task insights generated', { userId, taskCount: allTasks.length });

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
          // Check VitalTask if not found in Task
          targetTask = await VitalTask.findOne({ _id: taskId, user: userId })
             .select('title description priority')
             .lean();
        }

        if (!targetTask) {
          throw new Error('Task not found');
        }
      } else if (typeof taskId === 'object' && taskId !== null) {
         // It's a draft object { title, description }
         targetTask = taskId;
      } else {
         throw new Error('Invalid task identifier or draft data');
      }

      // Get all user tasks (Regular)
      const regularTasks = await Task.find({
        user: userId,
        _id: { $ne: targetTask._id }, 
        isDeleted: false,
      })
      .select('title description category priority')
      .limit(20)
      .lean();

      // Get user's Vital Tasks
      const vitalTasks = await VitalTask.find({ 
        user: userId, 
        _id: { $ne: targetTask._id }, 
        isDeleted: false 
      })
      .select('title description priority')
      .limit(10)
      .lean();

      // Combine for comparison
      const allTasks = [...regularTasks, ...vitalTasks];

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
  /**
   * Internal helper to get context for all planning features
   */
  async getPlannerContext(userId) {
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
    let finalTasksToPlan = normalTasks.filter(t => 
      !t.priority || ['high', 'urgent', 'High', 'Urgent'].includes(t.priority.name)
    );

    // FALLBACK: If no high priority tasks found, but we have normal tasks, use them!
    if (finalTasksToPlan.length === 0 && normalTasks.length > 0) {
       finalTasksToPlan = normalTasks;
    }

    // 3. Fetch Background Context for Workload Analysis
    const user = await User.findById(userId).select('timezone');
    const userTz = user?.timezone || 'UTC';
    const { start: todayStart, end: todayEnd } = getLocalDayRange(userTz);

    const [totalPending, dueToday, overdue] = await Promise.all([
      Task.countDocuments({ user: userId, isCompleted: false, isDeleted: false }),
      Task.countDocuments({ 
        user: userId, 
        isCompleted: false, 
        isDeleted: false,
        dueDate: { 
          $gte: todayStart, 
          $lte: todayEnd 
        }
      }),
      Task.countDocuments({ 
        user: userId, 
        isCompleted: false, 
        isDeleted: false,
        dueDate: { $lt: todayStart }
      })
    ]);

    // 4. Fetch Recently Completed Tasks (Last 7 days) for Context Learning
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCompletions = await Task.find({
      user: userId,
      isCompleted: true,
      isDeleted: false,
      completedAt: { $gte: sevenDaysAgo }
    })
    .select('title completedAt priority category status')
    .sort('-completedAt')
    .limit(15)
    .lean();

    return {
      vitalTasks,
      finalTasksToPlan,
      stats: { totalPending, dueToday, overdue },
      recentCompletions
    };
  }

  /**
   * Generate an autonomous strategic plan based on existing tasks
   */
  async generateStrategicPlan(userId) {
    try {
      const { vitalTasks, finalTasksToPlan, stats, recentCompletions } = await this.getPlannerContext(userId);

      if (stats.totalPending === 0) {
        return { error: 'No active tasks found to generate a plan. Create some tasks first!' };
      }

      // 4. Call AI
      const prompt = INSIGHTS_PROMPTS.STRATEGIC_PLAN(
        vitalTasks, 
        finalTasksToPlan, 
        stats,
        recentCompletions
      );
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
          ...finalTasksToPlan.map(t => ({ taskId: t._id, taskModel: 'Task', title: t.title }))
        ],
        expiresAt
      });

      Logger.info('Autonomous Strategic Plan generated and persisted', { userId, planId: newPlan._id });

      return newPlan;
    } catch (error) {
      return handleAIError(error, 'generateStrategicPlan');
    }
  }
  /**
   * Generate CEO-level alternative approaches (3 distinct strategies)
   */
  async generateAlternativeStrategies(userId) {
    try {
      const { vitalTasks, finalTasksToPlan, stats } = await this.getPlannerContext(userId);

      if (stats.totalPending === 0) {
        return { error: 'No active tasks found to analyze alternatives.' };
      }

      const prompt = INSIGHTS_PROMPTS.ALTERNATIVE_STRATEGY(
        vitalTasks,
        finalTasksToPlan,
        stats
      );

      const response = await this.run({
        userId,
        feature: 'AI_PLANNER',
        prompt,
        systemPrompt: SYSTEM_PROMPTS.TASK_ASSISTANT
      });

      const alternativesData = parseJSONResponse(response);
      if (!alternativesData || !Array.isArray(alternativesData.strategies)) {
        throw new Error('AI failed to generate alternative strategies');
      }

      Logger.info('Alternative strategies generated', { userId });
      return alternativesData.strategies;
    } catch (error) {
      return handleAIError(error, 'generateAlternativeStrategies');
    }
  }
}

export default new AIService();
