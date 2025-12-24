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
   * Get paginated chat history for a task (Normal or Vital)
   */
  async getTaskMessages(taskId, options = {}, isVital = false) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        before = null 
      } = options;

      const field = isVital ? 'vitalTask' : 'task';
      const query = { [field]: taskId };
      
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
        .sort({ createdAt: -1 })
        .skip(before ? 0 : skip)
        .limit(parseInt(limit));

      return messages.reverse();
    } catch (error) {
      Logger.error('Error fetching chat history', { 
        error: error.message, 
        taskId,
        isVital
      });
      throw error;
    }
  }

  /**
   * Update read status
   */
  async markAsRead(taskId, userId, isVital = false) {
    try {
      const field = isVital ? 'vitalTask' : 'task';
      return await TaskMessage.updateMany(
        { 
          [field]: taskId,
          sender: { $ne: userId },
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
   * Get last message for a task (Normal or Vital)
   */
  async getLastMessage(taskId, isVital = false) {
    try {
      const field = isVital ? 'vitalTask' : 'task';
      return await TaskMessage.findOne({ [field]: taskId })
        .sort({ createdAt: -1 })
        .populate('sender', 'firstName lastName avatar');
    } catch (error) {
      return null;
    }
  }
}

export default new TaskMessageRepository();
