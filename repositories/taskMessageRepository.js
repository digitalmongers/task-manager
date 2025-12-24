import TaskMessage from '../models/TaskMessage.js';
import Logger from '../config/logger.js';

class TaskMessageRepository {
  /**
   * Create a new chat message
   */
  async createMessage(messageData) {
    try {
      const message = await TaskMessage.create(messageData);
      
      await message.populate([
        { path: 'sender', select: 'firstName lastName email avatar' }
      ]);

      return message;
    } catch (error) {
      Logger.error('Error creating chat message', { error: error.message });
      throw error;
    }
  }

  /**
   * Get paginated chat history for a task
   */
  async getTaskMessages(taskId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        before = null // For infinite scroll support
      } = options;

      const query = { task: taskId };
      
      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const skip = (page - 1) * limit;

      const messages = await TaskMessage.find(query)
        .populate('sender', 'firstName lastName email avatar')
        .populate('mentions', 'firstName lastName avatar')
        .populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'firstName lastName avatar' }
        })
        .populate('reactions.user', 'firstName lastName avatar')
        .sort({ createdAt: -1 }) // Newest first
        .skip(before ? 0 : skip)
        .limit(parseInt(limit));

      // Return messages sorted chronologically (oldest first) for UI
      return messages.reverse();
    } catch (error) {
      Logger.error('Error fetching chat history', { 
        error: error.message, 
        taskId 
      });
      throw error;
    }
  }

  /**
   * Update read status
   */
  async markAsRead(messageIds, userId) {
    try {
      return await TaskMessage.updateMany(
        { 
          _id: { $in: messageIds },
          'readBy.user': { $ne: userId }
        },
        { 
          $addToSet: { 
            readBy: { user: userId, readAt: new Date() } 
          } 
        }
      );
    } catch (error) {
      Logger.error('Error marking messages as read', { error: error.message });
      throw error;
    }
  }

  /**
   * Get last message for a task
   */
  async getLastMessage(taskId) {
    try {
      return await TaskMessage.findOne({ task: taskId })
        .sort({ createdAt: -1 })
        .populate('sender', 'firstName lastName avatar');
    } catch (error) {
      return null;
    }
  }
}

export default new TaskMessageRepository();
