import taskMessageRepository from '../repositories/taskMessageRepository.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import TaskMessage from '../models/TaskMessage.js';
import { encrypt, decrypt } from '../utils/encryptionUtils.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import pushService from './pushService.js';
import WebSocketService from '../config/websocket.js';

class ChatService {
  /**
   * Send a message to a task chat (Normal or Vital)
   */
  async sendMessage(taskId, userId, messageData, isVital = false) {
    // 1. Verify access
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) {
      throw ApiError.forbidden(`You do not have access to this ${isVital ? 'vital ' : ''}task chat`);
    }

    const { content, messageType = 'text', fileDetails = null, replyTo = null, mentions = [] } = messageData;

    // 2. Validate replyTo if provided
    if (replyTo) {
      const parentMessage = await TaskMessage.findById(replyTo);
      const field = isVital ? 'vitalTask' : 'task';
      if (!parentMessage || !parentMessage[field] || parentMessage[field].toString() !== taskId.toString()) {
        throw ApiError.badRequest('Invalid message to reply to');
      }
    }

    // 3. Encrypt text content
    let finalContent = content;
    if (messageType === 'text' && content) {
      try {
        finalContent = encrypt(content, 'CHAT');
      } catch (err) {
        Logger.error('Message encryption failed', { error: err.message });
        throw ApiError.internal('Failed to secure message');
      }
    }

    // 4. Create message in DB
    const message = await taskMessageRepository.createMessage({
      task: isVital ? null : taskId,
      vitalTask: isVital ? taskId : null,
      sender: userId,
      content: finalContent,
      messageType,
      fileDetails,
      replyTo,
      mentions,
      isEncrypted: messageType === 'text'
    });

    // 5. Decrypt and populate for real-time delivery
    const populatedMessage = await TaskMessage.findById(message._id)
      .populate('sender', 'firstName lastName email avatar')
      .populate('mentions', 'firstName lastName avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'firstName lastName avatar' }
      });

    const decryptedMessage = populatedMessage.toObject();
    
    // Decrypt main message
    if (decryptedMessage.isEncrypted && decryptedMessage.content) {
      decryptedMessage.content = decrypt(decryptedMessage.content, 'CHAT');
    }

    // Decrypt replied-to message if any
    if (decryptedMessage.replyTo && decryptedMessage.replyTo.isEncrypted && decryptedMessage.replyTo.content) {
      try {
        decryptedMessage.replyTo.content = decrypt(decryptedMessage.replyTo.content, 'CHAT');
      } catch (e) {
        decryptedMessage.replyTo.content = '[Encrypted Message]';
      }
    }

    // 6. Trigger Notifications
    this._handleNotifications(taskId, userId, decryptedMessage);

    return decryptedMessage;
  }

  /**
   * Get chat history (Normal or Vital)
   */
  async getChatHistory(taskId, userId, options = {}, isVital = false) {
    // 1. Verify access
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) {
      throw ApiError.forbidden(`You do not have access to this ${isVital ? 'vital ' : ''}task chat`);
    }

    // 2. Fetch messages
    const messages = await taskMessageRepository.getTaskMessages(taskId, options, isVital);

    // 3. Decrypt messages
    return messages.map(msg => {
      const plainMsg = msg.toObject();
      if (plainMsg.isEncrypted && plainMsg.content) {
        try {
          plainMsg.content = decrypt(plainMsg.content, 'CHAT');
        } catch (err) {
          plainMsg.content = '[Encrypted Message]';
          Logger.warn('Failed to decrypt message in history', { messageId: msg._id });
        }
      }

      // Also decrypt content of replied-to message if it exists in history
      if (plainMsg.replyTo && plainMsg.replyTo.isEncrypted && plainMsg.replyTo.content) {
        try {
          plainMsg.replyTo.content = decrypt(plainMsg.replyTo.content, 'CHAT');
        } catch (e) {
          plainMsg.replyTo.content = '[Encrypted Message]';
        }
      }

      return plainMsg;
    });
  }

  /**
   * Get all members of a task chat (Normal or Vital)
   */
  async getChatMembers(taskId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) {
      throw ApiError.forbidden(`You do not have access to this ${isVital ? 'vital ' : ''}task chat members`);
    }

    const Model = isVital ? VitalTask : Task;
    const task = await Model.findById(taskId)
      .populate('user', 'firstName lastName email avatar')
      .populate({
        path: 'collaborators',
        match: { status: 'active' },
        populate: { path: 'collaborator', select: 'firstName lastName email avatar' }
      });

    if (!task) throw ApiError.notFound(`${isVital ? 'Vital ' : ''}Task not found`);

    const members = [
      {
        user: task.user,
        role: 'owner',
        isOnline: WebSocketService.isUserOnline(task.user._id)
      }
    ];

    task.collaborators.forEach(c => {
      if (c.collaborator._id.toString() !== task.user._id.toString()) {
        members.push({
          user: c.collaborator,
          role: c.role,
          isOnline: WebSocketService.isUserOnline(c.collaborator._id)
        });
      }
    });

    return members;
  }

  /**
   * Mark messages as read for a task (Normal or Vital)
   */
  async markAsRead(taskId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    await taskMessageRepository.markAsRead(taskId, userId, isVital);

    // Notify room about read status update
    WebSocketService.sendToChatRoom(taskId, 'chat:seen', {
      taskId,
      userId,
      readAt: new Date()
    });

    return true;
  }

  /**
   * Toggle emoji reaction
   */
  async toggleReaction(taskId, messageId, userId, emoji, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const message = await TaskMessage.findOne({ _id: messageId, [field]: taskId });
    if (!message) throw ApiError.notFound('Message not found');

    const existingReactionIndex = message.reactions.findIndex(
      r => r.user.toString() === userId.toString() && r.emoji === emoji
    );

    if (existingReactionIndex > -1) {
      // Remove reaction
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const populatedReaction = await TaskMessage.findById(message._id)
      .populate('reactions.user', 'firstName lastName avatar');

    // Notify room about reaction update
    WebSocketService.sendToChatRoom(taskId, 'chat:reaction_update', {
      messageId,
      reactions: populatedReaction.reactions
    });

    return populatedReaction.reactions;
  }

  /**
   * Edit a message
   */
  async editMessage(taskId, messageId, userId, newContent, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const message = await TaskMessage.findOne({ _id: messageId, [field]: taskId, sender: userId });
    if (!message) throw ApiError.notFound('Message not found or you are not the sender');
    if (message.isDeleted) throw ApiError.badRequest('Cannot edit a deleted message');

    // Store original content in history
    message.editHistory.push({
      content: message.content,
      editedAt: new Date()
    });

    // Encrypt new content
    try {
      message.content = encrypt(newContent, 'CHAT');
      message.isEdited = true;
      await message.save();
    } catch (err) {
      throw ApiError.internal('Failed to secure edited message');
    }

    const decryptedMessage = message.toObject();
    decryptedMessage.content = newContent;

    // Broadcast update
    WebSocketService.sendToChatRoom(taskId, 'chat:message_update', decryptedMessage);

    return decryptedMessage;
  }

  /**
   * Delete a message (Withdraw/Delete for everyone)
   */
  async deleteMessage(taskId, messageId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const message = await TaskMessage.findOne({ _id: messageId, [field]: taskId });
    if (!message) throw ApiError.notFound('Message not found');

    const isSender = message.sender.toString() === userId.toString();
    if (!isSender && !access.isOwner) {
      throw ApiError.forbidden('Only sender or task owner can delete this message');
    }

    message.isDeleted = true;
    message.content = encrypt('[This message was deleted]', 'CHAT'); // Secure the deletion notice too if needed
    await message.save();

    // Broadcast deletion
    WebSocketService.sendToChatRoom(taskId, 'chat:message_delete', { messageId });

    return { messageId, isDeleted: true };
  }

  /**
   * Pin or unpin a message
   */
  async togglePin(taskId, messageId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');
    if (access.role === 'viewer') throw ApiError.forbidden('Viewers cannot pin messages');

    const field = isVital ? 'vitalTask' : 'task';
    const message = await TaskMessage.findOne({ _id: messageId, [field]: taskId });
    if (!message) throw ApiError.notFound('Message not found');

    message.isPinned = !message.isPinned;
    await message.save();

    WebSocketService.sendToChatRoom(taskId, 'chat:message_pinned_toggle', {
      messageId,
      isPinned: message.isPinned
    });

    return { messageId, isPinned: message.isPinned };
  }

  /**
   * Get pinned messages for a task (Normal or Vital)
   */
  async getPinnedMessages(taskId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const messages = await TaskMessage.find({ [field]: taskId, isPinned: true })
      .populate('sender', 'firstName lastName avatar')
      .sort({ updatedAt: -1 });

    return messages.map(msg => {
      const plain = msg.toObject();
      if (plain.isEncrypted && plain.content) {
        try {
          plain.content = decrypt(plain.content, 'CHAT');
        } catch (e) {
          plain.content = '[Encrypted]';
        }
      }
      return plain;
    });
  }

  /**
   * Search messages (Normal or Vital)
   */
  async searchMessages(taskId, userId, query, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const messages = await TaskMessage.find({ [field]: taskId, isDeleted: false })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(500);

    const results = [];
    for (const msg of messages) {
      if (msg.messageType !== 'text') continue;
      
      try {
        const decryptedContent = decrypt(msg.content, 'CHAT');
        if (decryptedContent.toLowerCase().includes(query.toLowerCase())) {
          const plain = msg.toObject();
          plain.content = decryptedContent;
          results.push(plain);
        }
      } catch (e) {
        // Skip malformed
      }
    }

    return results;
  }

  /**
   * Handle socket and push notifications (Normal or Vital)
   */
  async _handleNotifications(taskId, senderId, message, isVital = false) {
    try {
      const Model = isVital ? VitalTask : Task;
      const task = await Model.findById(taskId).populate('collaborators');
      if (!task) return;

      // Get all collaborator IDs excluding sender
      const CollabModel = isVital ? VitalTaskCollaborator : TaskCollaborator;
      const collaborators = await CollabModel.find({ 
        [isVital ? 'vitalTask' : 'task']: taskId, 
        status: 'active' 
      });
      const recipientIds = collaborators
        .map(c => c.collaborator.toString())
        .filter(id => id !== senderId.toString());

      // Also add owner if not sender
      if (task.user.toString() !== senderId.toString() && !recipientIds.includes(task.user.toString())) {
        recipientIds.push(task.user.toString());
      }

      const preview = message.messageType === 'text' 
        ? message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '')
        : `[Sent an ${message.messageType}]`;

      const notificationData = {
        type: isVital ? 'VITAL_CHAT_MESSAGE' : 'CHAT_MESSAGE',
        taskId: task._id,
        isVital,
        taskTitle: task.title,
        senderName: `${message.sender.firstName} ${message.sender.lastName}`,
        messagePreview: preview,
        messageId: message._id
      };

      // 1. WebSocket Broadcast to personal rooms (for alerts/badges)
      WebSocketService.sendToUsers(recipientIds, 'chat:new_message_alert', notificationData);

      // 2. WebSocket broadcast to the actual chat room for users actively viewing the chat
      WebSocketService.sendToChatRoom(taskId, 'chat:message', message);

      // 3. Web Push for offline/background users
      await pushService.sendPushToMultipleUsers(recipientIds, {
        title: `New message in ${task.title}`,
        body: `${notificationData.senderName}: ${preview}`,
        url: `/tasks/${taskId}/chat`, // Frontend route
        data: {
          taskId: taskId
        }
      });

    } catch (error) {
      Logger.error('Chat notification delivery failed', { error: error.message });
    }
  }
}

export default new ChatService();
