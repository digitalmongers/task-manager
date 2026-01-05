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
import redisClient from '../config/redis.js';
import { getLinkPreview } from '../utils/linkPreview.js';
import Notification from '../models/Notification.js';
import ChatReadState from '../models/ChatReadState.js';
import MetricsService from './metricsService.js';
import WebSocketService from '../config/websocket.js';

class ChatService {
  /**
   * Send a message to a task chat (Normal or Vital)
   */
  async sendMessage(taskId, userId, messageData, isVital = false) {
    // 0. Internal Rate Limiting (Abuse Prevention)
    const limitKey = `ratelimit:msg:${userId}`;
    const count = await redisClient.incr(limitKey);
    if (count === 1) {
      await redisClient.expire(limitKey, 2); // 2 second window
    }
    if (count > 5) {
      throw ApiError.tooManyRequests('Chat rate limit exceeded. Slow down.');
    }

    // 1. Verify access
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) {
      throw ApiError.forbidden(`You do not have access to this ${isVital ? 'vital ' : ''}task chat`);
    }

    let { content, messageType = 'text', fileDetails = null, replyTo = null, mentions = [], clientSideId = null } = messageData;

    // 2. Smarter Type Detection & Validation
    if (fileDetails && fileDetails.url) {
      const mime = fileDetails.mimeType || '';
      if (mime.startsWith('image/')) {
        messageType = 'image';
      } else if (mime.startsWith('audio/')) {
        messageType = 'audio';
      } else {
        messageType = 'file';
      }
    }

    // 2. Idempotency Check
    if (clientSideId) {
      const existingMessage = await TaskMessage.findOne({ clientSideId });
      if (existingMessage) {
        Logger.info('Duplicate message detected (clientSideId), returning existing', { clientSideId });
        MetricsService.trackFailedRetry(); // Using this to track idempotency hits
        return this.getMessageById(existingMessage._id);
      }
    }

    // 3. Validate replyTo if provided
    if (replyTo) {
      const parentMessage = await TaskMessage.findById(replyTo);
      const field = isVital ? 'vitalTask' : 'task';
      if (!parentMessage || !parentMessage[field] || parentMessage[field].toString() !== taskId.toString()) {
        throw ApiError.badRequest('Invalid message to reply to');
      }
    }

    // 3. Encrypt content if present (Captions or Text)
    let finalContent = content;
    let isEncrypted = false;
    if (content) {
      try {
        finalContent = encrypt(content, 'CHAT');
        isEncrypted = true;
      } catch (err) {
        Logger.error('Message encryption failed', { error: err.message });
        throw ApiError.internal('Failed to secure message');
      }
    }

    // 4. Create message in DB (Immediate)
    const message = await taskMessageRepository.createMessage({
      task: isVital ? null : taskId,
      vitalTask: isVital ? taskId : null,
      sender: userId,
      content: finalContent,
      messageType,
      fileDetails,
      replyTo,
      mentions,
      isEncrypted,
      clientSideId,
      status: 'sent',
      linkPreview: null,
      sequenceNumber: await this._getNextSequence(taskId, isVital)
    });

    // Track metrics
    MetricsService.trackMessage();

    // 5. Decrypt and broadcast IMMEDIATELY for seamless experience
    const populatedMessage = await this._populatedAndDecrypted(message._id);
    
    // Fast Emit to the chat room
    WebSocketService.sendToChatRoom(taskId, 'chat:message', populatedMessage);

    // 6. Background Tasks (Non-blocking)
    this._processBackgroundTasks(taskId, userId, populatedMessage, content, isVital);

    return populatedMessage;
  }

  /**
   * Handle non-blocking tasks after message is sent
   */
  async _processBackgroundTasks(taskId, userId, populatedMessage, rawContent, isVital) {
    try {
      // A. Meta Data Extraction (Link Previews)
      if (populatedMessage.messageType === 'text' && rawContent) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const match = rawContent.match(urlRegex);
        if (match) {
          getLinkPreview(match[0]).then(async (preview) => {
            if (preview) {
              await TaskMessage.findByIdAndUpdate(populatedMessage._id, { linkPreview: preview });
              populatedMessage.linkPreview = preview;
              // Broadcast update to the room
              WebSocketService.sendToChatRoom(taskId, 'chat:message_update', {
                messageId: populatedMessage._id,
                linkPreview: preview
              });
            }
          }).catch(e => Logger.error('Background review failed', { e: e.message }));
        }
      }

      // B. Push Notifications & Alerts
      await this._handleNotifications(taskId, userId, populatedMessage, isVital);
    } catch (e) {
      Logger.error('Chat background processing failed', { error: e.message });
    }
  }

  /**
   * Helper to populate and decrypt message
   */
  async _populatedAndDecrypted(messageId) {
    const populatedMessage = await TaskMessage.findById(messageId)
      .populate('sender', 'firstName lastName email avatar')
      .populate('mentions', 'firstName lastName avatar')
      .populate({
        path: 'replyTo',
        populate: { path: 'sender', select: 'firstName lastName avatar' }
      });

    if (!populatedMessage) return null;

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
   * Atomic sequence generator for messages using Redis
   */
  async _getNextSequence(taskId, isVital) {
    const key = `chat:seq:${isVital ? 'vital:' : ''}${taskId}`;
    return await redisClient.incr(key);
  }

  /**
   * Sync missed messages since a specific timestamp
   * Essential for Offline Catch-up (Seamless Experience)
   */
  async getSyncMessages(userId, since, limit = 100) {
    if (!since) throw ApiError.badRequest('Missing sync timestamp');

    // Track sync lag (ms)
    MetricsService.trackSyncLag(Date.now() - new Date(since).getTime());
    
    // Find all tasks the user is part of
    const standardTasks = await TaskCollaborator.find({ collaborator: userId, status: 'active' }).select('task');
    const vitalTasks = await VitalTaskCollaborator.find({ collaborator: userId, status: 'active' }).select('vitalTask');
    const ownedTasks = await Task.find({ user: userId }).select('_id');
    const ownedVitalTasks = await VitalTask.find({ user: userId }).select('_id');

    const taskIds = [
      ...standardTasks.map(t => t.task),
      ...ownedTasks.map(t => t._id)
    ];
    const vitalTaskIds = [
      ...vitalTasks.map(t => t.vitalTask),
      ...ownedVitalTasks.map(t => t._id)
    ];

    const messages = await TaskMessage.find({
      $or: [
        { task: { $in: taskIds } },
        { vitalTask: { $in: vitalTaskIds } }
      ],
      createdAt: { $gt: new Date(since) },
      sender: { $ne: userId }
    })
    .populate('sender', 'firstName lastName email avatar')
    .sort({ sequenceNumber: 1 }) // Hard Ordering for sync stream
    .limit(limit);

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

    const members = [];
    
    // Add owner
    const ownerPresence = await this._getUserPresence(task.user._id);
    members.push({
        user: task.user,
        role: 'owner',
        isOnline: ownerPresence.isOnline,
        lastSeen: ownerPresence.lastSeen
    });

    for (const c of task.collaborators) {
      if (c.collaborator._id.toString() !== task.user._id.toString()) {
        const collabPresence = await this._getUserPresence(c.collaborator._id);
        
        // Fetch last read state for this collaborator
        const readState = await ChatReadState.findOne({ 
          user: c.collaborator._id, 
          [isVital ? 'vitalTask' : 'task']: taskId 
        });

        members.push({
          user: c.collaborator,
          role: c.role,
          isOnline: collabPresence.isOnline,
          lastSeen: collabPresence.lastSeen,
          lastReadSequence: readState ? readState.lastReadSequence : 0,
          lastReadAt: readState ? readState.lastReadAt : null
        });
      }
    }

    return members;
  }

  /**
   * Mark messages as read for a user in a task (Normal or Vital)
   */
  async markAsRead(taskId, userId, isVital = false) {
    const access = isVital 
      ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
      : await TaskCollaborator.canUserAccessTask(taskId, userId);
      
    if (!access.canAccess) throw ApiError.forbidden('Access denied');

    const field = isVital ? 'vitalTask' : 'task';
    const now = new Date();

    // 1. Get the latest message to find the current "High-Water Mark" sequence
    const latestMessage = await TaskMessage.findOne({ [field]: taskId })
      .sort({ sequenceNumber: -1 });

    if (!latestMessage) return { success: true };

    // 2. Atomic Upsert of Read State (High-Water Mark Model)
    // This replaces the per-message readBy update for MASSIVE scalability
    await ChatReadState.findOneAndUpdate(
      { user: userId, [field]: taskId },
      { 
        lastReadSequence: latestMessage.sequenceNumber,
        lastReadAt: now,
        isVital
      },
      { upsert: true, new: true }
    );

    // 3. Broadcast globally that this user has read up to this point (for OTHER users)
    // 3. Broadcast globally that this user has read up to this point (for OTHER users)
    WebSocketService.sendToChatRoom(taskId, 'chat:read', {
      taskId,
      userId,
      readAt: now,
      isVital,
      lastReadSequence: latestMessage.sequenceNumber
    });

    // 4. Multi-Device Sync: Notify OTHER devices of the SAME user to clear badges
    WebSocketService.sendToUser(userId, 'chat:read_sync', {
      taskId,
      isVital,
      readAt: now,
      lastReadSequence: latestMessage.sequenceNumber
    });

    return { success: true };
  }

  /**
   * Internal helper to get presence from Redis (Enterprise v2)
   */
  async _getUserPresence(userId) {
    try {
        const presenceKey = `presence:user:${userId}`;
        const data = await redisClient.hgetall(presenceKey);
        
        if (!data || Object.keys(data).length === 0) return { isOnline: false, lastSeen: null };
        
        return {
            isOnline: data.status === 'online',
            status: data.status,
            lastSeen: data.lastSeen,
            lastHeartbeat: data.lastHeartbeat
        };
    } catch (e) {
        return { isOnline: false, lastSeen: null };
    }
  }

  /**
   * Mark message as delivered
   */
  async markAsDelivered(messageId, userId, taskId, isVital = false) {
    const message = await TaskMessage.findById(messageId);
    if (!message || message.status === 'read' || message.status === 'delivered') return;

    // Only update if not the sender
    if (message.sender.toString() === userId.toString()) return;

    message.status = 'delivered';
    await message.save();

    // Notify room (sender especially)
    WebSocketService.sendToChatRoom(taskId, 'chat:delivered', {
      messageId,
      userId,
      deliveredAt: new Date()
    });
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

    // Compliance: Internal audit log entry
    Logger.info('Message edited (Compliance Log)', { 
      messageId, 
      userId, 
      taskId, 
      isVital,
      oldHistoryCount: message.editHistory.length,
      timestamp: new Date() 
    });

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

    // Compliance: Internal audit log entry
    Logger.info('Message deleted (Compliance Log)', { 
      messageId, 
      userId, 
      taskId, 
      isVital, 
      timestamp: new Date() 
    });

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

      // Web Push for offline/background users
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

  /**
   * Helper: Get a single message with decryption and population
   */
  async getMessageById(messageId) {
    const message = await TaskMessage.findById(messageId)
      .populate('sender', 'firstName lastName avatar')
      .populate('replyTo');
    
    if (!message) return null;

    const plain = message.toObject();
    if (plain.isEncrypted && plain.content) {
      try {
        plain.content = decrypt(plain.content, 'CHAT');
      } catch (e) {
        plain.content = '[Encrypted]';
      }
    }
    return plain;
  }

  /**
   * Purge messages older than 90 days (Enterprise Retention Policy)
   */
  async purgeOldMessages(retentionDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);

    const result = await TaskMessage.deleteMany({
      createdAt: { $lt: cutoff },
      isPinned: false // Never purge pinned messages
    });

    Logger.info('Enterprise Retention Policy: Old messages purged', {
      purgedCount: result.deletedCount,
      cutoffDate: cutoff
    });

    return result.deletedCount;
  }
}

export default new ChatService();
