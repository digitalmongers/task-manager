import taskMessageRepository from '../repositories/taskMessageRepository.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import Task from '../models/Task.js';
import TaskMessage from '../models/TaskMessage.js';
import { encrypt, decrypt } from '../utils/encryptionUtils.js';
import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import pushService from './pushService.js';
import WebSocketService from '../config/websocket.js';

class ChatService {
  /**
   * Send a message to a task chat
   */
  async sendMessage(taskId, userId, messageData) {
    // 1. Verify access
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) {
      throw ApiError.forbidden('You do not have access to this task chat');
    }

    const { content, messageType = 'text', fileDetails = null, replyTo = null, mentions = [] } = messageData;

    // 2. Validate replyTo if provided
    if (replyTo) {
      const parentMessage = await TaskMessage.findById(replyTo);
      if (!parentMessage || parentMessage.task.toString() !== taskId.toString()) {
        throw ApiError.badRequest('Invalid message to reply to');
      }
    }

    // 3. Encrypt text content
    let finalContent = content;
    if (messageType === 'text' && content) {
      try {
        finalContent = encrypt(content);
      } catch (err) {
        Logger.error('Message encryption failed', { error: err.message });
        throw ApiError.internal('Failed to secure message');
      }
    }

    // 4. Create message in DB
    const message = await taskMessageRepository.createMessage({
      task: taskId,
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
      decryptedMessage.content = decrypt(decryptedMessage.content);
    }

    // Decrypt replied-to message if any
    if (decryptedMessage.replyTo && decryptedMessage.replyTo.isEncrypted && decryptedMessage.replyTo.content) {
      try {
        decryptedMessage.replyTo.content = decrypt(decryptedMessage.replyTo.content);
      } catch (e) {
        decryptedMessage.replyTo.content = '[Encrypted Message]';
      }
    }

    // 6. Trigger Notifications
    this._handleNotifications(taskId, userId, decryptedMessage);

    return decryptedMessage;
  }

  /**
   * Get chat history
   */
  async getChatHistory(taskId, userId, options = {}) {
    // 1. Verify access
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) {
      throw ApiError.forbidden('You do not have access to this task chat');
    }

    // 2. Fetch messages
    const messages = await taskMessageRepository.getTaskMessages(taskId, options);

    // 3. Decrypt messages
    return messages.map(msg => {
      const plainMsg = msg.toObject();
      if (plainMsg.isEncrypted && plainMsg.content) {
        try {
          plainMsg.content = decrypt(plainMsg.content);
        } catch (err) {
          plainMsg.content = '[Encrypted Message]';
          Logger.warn('Failed to decrypt message in history', { messageId: msg._id });
        }
      }

      // Also decrypt content of replied-to message if it exists in history
      if (plainMsg.replyTo && plainMsg.replyTo.isEncrypted && plainMsg.replyTo.content) {
        try {
          plainMsg.replyTo.content = decrypt(plainMsg.replyTo.content);
        } catch (e) {
          plainMsg.replyTo.content = '[Encrypted Message]';
        }
      }

      return plainMsg;
    });
  }

  /**
   * Get all members of a task chat
   */
  async getChatMembers(taskId, userId) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) {
      throw ApiError.forbidden('You do not have access to this task chat members');
    }

    const task = await Task.findById(taskId)
      .populate('user', 'firstName lastName email avatar')
      .populate({
        path: 'collaborators',
        match: { status: 'active' },
        populate: { path: 'collaborator', select: 'firstName lastName email avatar' }
      });

    if (!task) throw ApiError.notFound('Task not found');

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
   * Toggle emoji reaction
   */
  async toggleReaction(taskId, messageId, userId, emoji) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const message = await TaskMessage.findOne({ _id: messageId, task: taskId });
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
  async editMessage(taskId, messageId, userId, newContent) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const message = await TaskMessage.findOne({ _id: messageId, task: taskId, sender: userId });
    if (!message) throw ApiError.notFound('Message not found or you are not the sender');
    if (message.isDeleted) throw ApiError.badRequest('Cannot edit a deleted message');

    // Store original content in history
    message.editHistory.push({
      content: message.content,
      editedAt: new Date()
    });

    // Encrypt new content
    try {
      message.content = encrypt(newContent);
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
  async deleteMessage(taskId, messageId, userId) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    // Allow sender or task owner to delete
    const message = await TaskMessage.findOne({ _id: messageId, task: taskId });
    if (!message) throw ApiError.notFound('Message not found');

    const isSender = message.sender.toString() === userId.toString();
    if (!isSender && !access.isOwner) {
      throw ApiError.forbidden('Only sender or task owner can delete this message');
    }

    message.isDeleted = true;
    message.content = encrypt('[This message was deleted]'); // Secure the deletion notice too if needed
    await message.save();

    // Broadcast deletion
    WebSocketService.sendToChatRoom(taskId, 'chat:message_delete', { messageId });

    return { messageId, isDeleted: true };
  }

  /**
   * Pin or unpin a message
   */
  async togglePin(taskId, messageId, userId) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');
    // Usually only owner or editors can pin
    if (access.role === 'viewer') throw ApiError.forbidden('Viewers cannot pin messages');

    const message = await TaskMessage.findOne({ _id: messageId, task: taskId });
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
   * Get pinned messages for a task
   */
  async getPinnedMessages(taskId, userId) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const messages = await TaskMessage.find({ task: taskId, isPinned: true })
      .populate('sender', 'firstName lastName avatar')
      .sort({ updatedAt: -1 });

    return messages.map(msg => {
      const plain = msg.toObject();
      if (plain.isEncrypted && plain.content) {
        try {
          plain.content = decrypt(plain.content);
        } catch (e) {
          plain.content = '[Encrypted]';
        }
      }
      return plain;
    });
  }

  /**
   * Search messages (Basic implementation: fetches and decrypts)
   */
  async searchMessages(taskId, userId, query) {
    const access = await TaskCollaborator.canUserAccessTask(taskId, userId);
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    // Fetch last 500 messages to search within (reasonable for a task chat)
    const messages = await TaskMessage.find({ task: taskId, isDeleted: false })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(500);

    const results = [];
    for (const msg of messages) {
      if (msg.messageType !== 'text') continue;
      
      try {
        const decryptedContent = decrypt(msg.content);
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
   * Handle socket and push notifications
   */
  async _handleNotifications(taskId, senderId, message) {
    try {
      const task = await Task.findById(taskId).populate('collaborators');
      if (!task) return;

      // Get all collaborator IDs excluding sender
      const collaborators = await TaskCollaborator.find({ task: taskId, status: 'active' });
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
        type: 'CHAT_MESSAGE',
        taskId: task._id,
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
