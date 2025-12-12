/**
 * AI Chatbot Service
 * Enterprise-level chatbot with context awareness
 */

import openai, { getConfig } from '../../config/openai.js';
import Logger from '../../config/logger.js';
import Task from '../../models/Task.js';
import VitalTask from '../../models/VitalTask.js';
import Category from '../../models/Category.js';
import TaskPriority from '../../models/TaskPriority.js';
import TaskStatus from '../../models/TaskStatus.js';
import { parseJSONResponse, handleAIError } from './aiHelpers.js';

class ChatbotService {
  /**
   * Get user context for chatbot
   */
  async getUserContext(userId) {
    try {
      const [tasks, vitalTasks, categories, priorities, statuses] = await Promise.all([
        Task.find({ user: userId, isDeleted: false })
          .select('title status priority dueDate isCompleted')
          .populate('status', 'name')
          .populate('priority', 'name')
          .limit(20)
          .lean(),
        VitalTask.find({ user: userId, isDeleted: false })
          .select('title status priority dueDate isCompleted')
          .limit(10)
          .lean(),
        Category.find({ user: userId }).select('title').lean(),
        TaskPriority.find({ user: userId }).select('name').lean(),
        TaskStatus.find({ user: userId }).select('name').lean(),
      ]);

      // Calculate stats
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter(t => t.isCompleted).length;
      const overdueTasks = tasks.filter(t => 
        !t.isCompleted && t.dueDate && new Date(t.dueDate) < new Date()
      ).length;
      const todayTasks = tasks.filter(t => {
        if (!t.dueDate) return false;
        const today = new Date().toDateString();
        return new Date(t.dueDate).toDateString() === today;
      }).length;

      return {
        stats: {
          totalTasks,
          completedTasks,
          overdueTasks,
          todayTasks,
          vitalTasks: vitalTasks.length,
        },
        recentTasks: tasks.slice(0, 5).map(t => ({
          title: t.title,
          status: t.status?.name || 'Unknown',
          priority: t.priority?.name || 'Unknown',
          dueDate: t.dueDate,
          isCompleted: t.isCompleted,
        })),
        categories: categories.map(c => c.title),
        priorities: priorities.map(p => p.name),
        statuses: statuses.map(s => s.name),
      };
    } catch (error) {
      Logger.error('Failed to get user context for chatbot', { error: error.message });
      return null;
    }
  }

  /**
   * Build system prompt with user context
   */
  buildSystemPrompt(userContext) {
    return `You are an intelligent task management assistant. You help users manage their tasks, provide insights, and answer questions.

User's Current Status:
- Total Tasks: ${userContext.stats.totalTasks}
- Completed: ${userContext.stats.completedTasks}
- Overdue: ${userContext.stats.overdueTasks}
- Due Today: ${userContext.stats.todayTasks}
- Vital Tasks: ${userContext.stats.vitalTasks}

Available Categories: ${userContext.categories.join(', ')}
Available Priorities: ${userContext.priorities.join(', ')}
Available Statuses: ${userContext.statuses.join(', ')}

Recent Tasks:
${userContext.recentTasks.map((t, i) => 
  `${i + 1}. ${t.title} - ${t.status} (Priority: ${t.priority})`
).join('\n')}

Guidelines:
1. Be helpful, friendly, and concise
2. Provide actionable advice
3. Reference user's actual tasks when relevant
4. Suggest task management best practices
5. If user asks to create/update tasks, provide structured data
6. Always be encouraging and positive

Respond naturally and conversationally.`;
  }

  /**
   * Chat with AI assistant
   */
  async chat(userId, message, conversationHistory = []) {
    try {
      if (!openai) {
        throw new Error('AI service not configured');
      }

      // Get user context
      const userContext = await this.getUserContext(userId);
      if (!userContext) {
        throw new Error('Failed to get user context');
      }

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(userContext);

      // Build messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: message },
      ];

      // Call OpenAI
      const config = getConfig();
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: messages,
        max_tokens: 800, // Longer for chat
        temperature: 0.8, // More conversational
      });

      const assistantMessage = response.choices[0].message.content;

      Logger.info('Chatbot response generated', {
        userId,
        messageLength: message.length,
        responseLength: assistantMessage.length,
      });

      return {
        message: assistantMessage,
        conversationHistory: [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: assistantMessage },
        ],
        userContext,
      };
    } catch (error) {
      return handleAIError(error, 'chat');
    }
  }

  /**
   * Get quick suggestions based on user query
   */
  async getQuickSuggestions(userId, query) {
    try {
      const userContext = await this.getUserContext(userId);

      const prompt = `Based on this query: "${query}"

User has:
- ${userContext.stats.totalTasks} total tasks
- ${userContext.stats.overdueTasks} overdue tasks
- ${userContext.stats.todayTasks} tasks due today

Provide 3-5 quick action suggestions. Return as JSON array:
["suggestion 1", "suggestion 2", "suggestion 3"]`;

      const config = getConfig();
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are a helpful task assistant.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const suggestions = parseJSONResponse(response.choices[0].message.content);

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'getQuickSuggestions');
    }
  }

  /**
   * Analyze user intent and extract action
   */
  async analyzeIntent(message) {
    try {
      const prompt = `Analyze this user message and determine the intent:
"${message}"

Return JSON:
{
  "intent": "create_task|update_task|delete_task|list_tasks|get_insights|general_question",
  "action": "what user wants to do",
  "entities": {
    "taskTitle": "extracted task title if any",
    "priority": "extracted priority if any",
    "dueDate": "extracted date if any"
  }
}`;

      const config = getConfig();
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: 'system', content: 'You are an intent analyzer.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.3,
      });

      const intent = parseJSONResponse(response.choices[0].message.content);

      return intent;
    } catch (error) {
      return handleAIError(error, 'analyzeIntent');
    }
  }

  /**
   * Get smart reply suggestions
   */
  getSmartReplies(userContext) {
    const replies = [];

    if (userContext.stats.overdueTasks > 0) {
      replies.push(`Show me overdue tasks (${userContext.stats.overdueTasks})`);
    }

    if (userContext.stats.todayTasks > 0) {
      replies.push(`What's due today? (${userContext.stats.todayTasks} tasks)`);
    }

    replies.push('Create a new task');
    replies.push('Show my task insights');
    replies.push('Help me plan my week');

    return replies.slice(0, 4);
  }
}

export default new ChatbotService();
