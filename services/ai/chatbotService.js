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
import ChatConversation from '../../models/ChatConversation.js';

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
   * Chat with AI assistant (Persistent)
   */
  async chat(userId, message, conversationId = null) {
    try {
      if (!openai) {
        throw new Error('AI service not configured');
      }

      // 1. Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await ChatConversation.findOne({ _id: conversationId, user: userId });
      }

      // Create new if not found or not provided
      if (!conversation) {
        conversation = new ChatConversation({
          user: userId,
          messages: [],
          title: message.substring(0, 50) + (message.length > 50 ? '...' : '')
        });
      }

      // 2. Get user context
      const userContext = await this.getUserContext(userId);
      if (!userContext) {
        throw new Error('Failed to get user context');
      }

      // 3. Build system prompt
      const systemPrompt = this.buildSystemPrompt(userContext);

      // 4. Prepare message history for OpenAI (optimize context window)
      // Take last 10 messages from DB + current message
      const historyContext = conversation.messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));

      const messages = [
        { role: 'system', content: systemPrompt },
        ...historyContext,
        { role: 'user', content: message }
      ];

      // 5. Call OpenAI
      const config = getConfig();
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: messages,
        max_tokens: 1000, 
        temperature: 0.7,
      });

      const assistantMessage = response.choices[0].message.content;

      // 6. Save to database
      conversation.messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'assistant', content: assistantMessage });
      
      // Update title if it's a generic "New Conversation" matching the first message
      if (conversation.messages.length === 2 && conversation.title === 'New Conversation') {
         conversation.title = message.substring(0, 30) + '...';
      }

      await conversation.save();

      Logger.info('Chatbot response generated & saved', {
        userId,
        conversationId: conversation._id,
        messageLength: message.length,
      });

      return {
        message: assistantMessage,
        conversationId: conversation._id,
        history: conversation.messages,
        userContext, // Optional: return if frontend needs to update UI
      };
    } catch (error) {
      return handleAIError(error, 'chat');
    }
  }

  /**
   * Get chat history for a user
   */
  async getChatHistory(userId, conversationId = null) {
    try {
      if (conversationId) {
         return await ChatConversation.findOne({ _id: conversationId, user: userId });
      }
      
      // List all conversations (summaries)
      return await ChatConversation.find({ user: userId })
        .select('title updatedAt createdAt')
        .sort({ updatedAt: -1 })
        .limit(20);
    } catch (error) {
      Logger.error('Failed to get chat history', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(userId, conversationId) {
    try {
      await ChatConversation.findOneAndDelete({ _id: conversationId, user: userId });
      return { success: true };
    } catch (error) {
      Logger.error('Failed to delete conversation', { error: error.message });
      throw error;
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
