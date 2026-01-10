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
import AIService from './aiService.js';
import TaskService from '../../services/taskService.js';
import VitalTaskService from '../../services/vitalTaskService.js';

const CHAT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a new regular task. Note: Always provide title and description in English.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the task (e.g., "Buy milk")' },
          description: { type: 'string', description: 'Detailed description of the task' },
          dueDate: { type: 'string', description: 'Due date in ISO format or relative (e.g., "2024-12-31")' },
          priority: { type: 'string', description: 'Priority ID (find from context if possible)' },
          category: { type: 'string', description: 'Category ID (find from context if possible)' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_vital_task',
      description: 'Create a new Vital Task. Note: Always provide title and description in English.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The title of the vital task' },
          description: { type: 'string', description: 'Detailed description' },
          dueDate: { type: 'string', description: 'Due date' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tasks',
      description: 'Search for existing tasks. You can search using English or Hindi keywords.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query or keywords' },
        },
        required: ['query'],
      },
    },
  },
];

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
        categories: categories.map(c => ({ _id: c._id, title: c.title })),
        priorities: priorities.map(p => ({ _id: p._id, name: p.name })),
        statuses: statuses.map(s => ({ _id: s._id, name: s.name })),
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
    return `You are an AI Task Manager Assistant. You support both English and Hindi.
User Context:
- Tasks: ${userContext.stats.totalTasks} (${userContext.stats.completedTasks} done, ${userContext.stats.overdueTasks} overdue)
- Vital Tasks: ${userContext.stats.vitalTasks}
- Categories: ${userContext.categories.map(c => `${c.title} (ID: ${c._id})`).join(', ')}
- Priorities: ${userContext.priorities.map(p => `${p.name} (ID: ${p._id})`).join(', ')}
- Statuses: ${userContext.statuses.map(s => `${s.name} (ID: ${s._id})`).join(', ')}

Capabilities:
1. Create regular tasks or Vital Tasks.
2. Search for existing tasks to answer questions.
3. Provide productivity insights.

Instructions:
- If a user asks to create a task (e.g., "Mera ek task bana do..."), use the 'create_task' or 'create_vital_task' tool.
- CRITICAL: Always translate 'title' and 'description' into ENGLISH when calling 'create_task' or 'create_vital_task', even if the user spoke in Hindi.
- If a user asks about their tasks, use 'search_tasks' to find relevant info before answering.
- Respond to the user in the language they used (Hindi/English/Hinglish), but keep stored tasks in English.
- Be concise and professional.`;
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

      // 5. Call AIService.run with tools
      const aiResponse = await AIService.run({
        userId,
        feature: 'AI_CHATBOT',
        messages: messages,
        tools: CHAT_TOOLS,
        tool_choice: 'auto'
      });

      let finalAssistantMessage;

      // 6. Handle Tool Calls
      if (typeof aiResponse === 'object' && aiResponse.tool_calls) {
        messages.push(aiResponse); // Add assistant's tool call message
        
        for (const toolCall of aiResponse.tool_calls) {
          const result = await this.executeTool(userId, toolCall);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(result)
          });
        }

        // Get final conversational response from AI
        finalAssistantMessage = await AIService.run({
          userId,
          feature: 'AI_CHATBOT',
          messages: messages
        });
      } else {
        finalAssistantMessage = aiResponse;
      }

      const assistantMessage = finalAssistantMessage;

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
   * Execute a tool call from AI
   */
  async executeTool(userId, toolCall) {
    const { name, arguments: argsString } = toolCall.function;
    const args = JSON.parse(argsString);
    
    Logger.info('Executing AI Chat Tool', { name, userId, args });

    try {
      switch (name) {
        case 'create_task': {
          // Resolve category/priority names to IDs if necessary
          const context = await this.getUserContext(userId);
          if (args.category) {
            const cat = context.categories.find(c => c.title === args.category || c._id.toString() === args.category);
            if (cat) args.category = cat._id;
          }
          if (args.priority) {
            const prio = context.priorities.find(p => p.name === args.priority || p._id.toString() === args.priority);
            if (prio) args.priority = prio._id;
          }
          return await TaskService.createTask(userId, args);
        }
        
        case 'create_vital_task':
          return await VitalTaskService.createVitalTask(userId, args);
        
        case 'search_tasks':
          const query = args.query.toLowerCase();
          const [tasks, vitalTasks] = await Promise.all([
            Task.find({ 
              user: userId, 
              isDeleted: false,
              $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
              ]
            }).limit(10).lean(),
            VitalTask.find({ 
              user: userId, 
              isDeleted: false,
              $or: [
                { title: { $regex: query, $options: 'i' } },
                { description: { $regex: query, $options: 'i' } }
              ]
            }).limit(5).lean()
          ]);
          return { tasks, vitalTasks, count: tasks.length + vitalTasks.length };

        default:
          return { error: 'Unknown tool' };
      }
    } catch (error) {
      Logger.error('AI Tool Execution Failed', { name, error: error.message });
      return { error: error.message };
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

      const response = await AIService.run({
        userId,
        feature: 'AI_CHATBOT',
        prompt,
        systemPrompt: 'You are a helpful task assistant.'
      });

      const suggestions = parseJSONResponse(response);

      return suggestions;
    } catch (error) {
      return handleAIError(error, 'getQuickSuggestions');
    }
  }

  /**
   * Analyze user intent and extract action
   */
  async analyzeIntent(userId, message) {
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

      const response = await AIService.run({
        userId, // Note: this method might be called without userId in some contexts, 
                // but for now we expect it from higher layers if we want enforcement.
                // In analyzeIntent it was not passing userId before, but we should.
        feature: 'TASK_SUGGESTION', // Intent analysis is a utility, allow on FREE? 
                                     // Actually chatbot needs it. Let's use TASK_SUGGESTION to keep it light.
        prompt,
        systemPrompt: 'You are an intent analyzer.'
      });

      const intent = parseJSONResponse(response);

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
