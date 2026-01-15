import ChatService from '../services/chatService.js';
import TaskMessage from '../models/TaskMessage.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { decrypt } from '../utils/encryptionUtils.js';
import { uploadToCloudinary } from './upload.js'; // Reuse upload controller logic if needed, or implement specific one
import { formatToLocal } from '../utils/dateUtils.js';

export const getHistory = async (req, res) => {
  const { taskId } = req.params;
  const { page, limit, beforeSequence, isVital } = req.query;

  const history = await ChatService.getChatHistory(taskId, req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    beforeSequence
  }, isVital === 'true');

  // Localize timestamps for messages in history
  // Localize timestamps for messages in history
  const messages = history?.messages || [];
  const localizedHistory = messages.map(msg => {
    // msg is already a plain object
    return {
      ...msg,
      createdAtLocal: formatToLocal(msg.createdAt, req.timezone),
    };
  });

  ApiResponse.success(res, 200, 'Chat history fetched successfully', {
    messages: localizedHistory,
    pagination: history.pagination,
  });
};

export const sendMessage = async (req, res) => {
  const { taskId } = req.params;
  const { content, messageType, fileDetails, replyTo, mentions, isVital, clientSideId } = req.body;

  if (!content && !fileDetails) {
    throw ApiError.badRequest('Message content or file is required');
  }

  const message = await ChatService.sendMessage(taskId, req.user._id, {
    content,
    messageType,
    fileDetails,
    replyTo,
    mentions,
    clientSideId
  }, isVital === true || req.query.isVital === 'true');

  // Localize timestamp for the sent message
  // message is already a plain object
  const localizedMessage = {
    ...message,
    createdAtLocal: formatToLocal(message.createdAt, req.timezone),
  };

  ApiResponse.success(res, 201, 'Message sent successfully', localizedMessage);
};

export const getMembers = async (req, res) => {
  const { taskId } = req.params;
  const { isVital } = req.query;
  const members = await ChatService.getChatMembers(taskId, req.user._id, isVital === 'true');
  ApiResponse.success(res, 200, 'Chat members fetched successfully', members);
};

export const toggleReaction = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { emoji, isVital } = req.body;

  const reactions = await ChatService.toggleReaction(taskId, messageId, req.user._id, emoji, isVital === true || req.query.isVital === 'true');
  ApiResponse.success(res, 200, 'Reaction updated successfully', reactions);
};

export const markAsRead = async (req, res) => {
  const { taskId } = req.params;
  const { isVital } = req.query;
  await ChatService.markAsRead(taskId, req.user._id, isVital === 'true');
  ApiResponse.success(res, 200, 'Messages marked as read');
};

export const editMessage = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { content, isVital } = req.body;

  if (!content) throw ApiError.badRequest('New content is required');

  const message = await ChatService.editMessage(taskId, messageId, req.user._id, content, isVital === true || req.query.isVital === 'true');
  // Localize timestamp for the edited message
  // message is already a plain object
  const localizedMessage = {
    ...message,
    updatedAtLocal: formatToLocal(message.updatedAt, req.timezone),
  };
  ApiResponse.success(res, 200, 'Message edited successfully', localizedMessage);
};

export const deleteMessage = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { isVital } = req.query;

  const result = await ChatService.deleteMessage(taskId, messageId, req.user._id, isVital === 'true');
  ApiResponse.success(res, 200, 'Message deleted successfully', result);
};

export const togglePin = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { isVital } = req.query;

  const result = await ChatService.togglePin(taskId, messageId, req.user._id, isVital === 'true');
  ApiResponse.success(res, 200, result.isPinned ? 'Message pinned' : 'Message unpinned', result);
};

export const getPinned = async (req, res) => {
  const { taskId } = req.params;
  const { isVital } = req.query;

  const pinned = await ChatService.getPinnedMessages(taskId, req.user._id, isVital === 'true');
  // Localize timestamps for pinned messages
  const localizedPinned = pinned.map(msg => {
    // msg is already a plain object
    return {
      ...msg,
      createdAtLocal: formatToLocal(msg.createdAt, req.timezone),
    };
  });
  ApiResponse.success(res, 200, 'Pinned messages fetched successfully', localizedPinned);
};

export const search = async (req, res) => {
  const { taskId } = req.params;
  const { q, isVital } = req.query;

  if (!q) throw ApiError.badRequest('Search query is required');

  // 1. Verify access (Enterprise Security)
  const access = isVital === 'true'
    ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, req.user._id)
    : await TaskCollaborator.canUserAccessTask(taskId, req.user._id);

  if (!access.canAccess) {
    throw ApiError.forbidden('You do not have access to search in this chat');
  }

  // 2. Optimized Search using Text Index
  const field = isVital === 'true' ? 'vitalTask' : 'task';
  const query = {
    [field]: taskId,
    $text: { $search: q },
    isDeleted: false // Respect soft-deletion
  };

  const results = await TaskMessage.find(query, { score: { $meta: 'textScore' } })
    .populate('sender', 'firstName lastName avatar')
    .sort({ score: { $meta: 'textScore' } }) // Relevance first
    .limit(100);

  // 3. Decrypt results and localize timestamps
  const decryptedResults = results.map(msg => {
    const plain = msg.toObject();
    if (plain.isEncrypted && plain.content) {
      try {
        plain.content = decrypt(plain.content, 'CHAT');
      } catch (e) {
        plain.content = '[Encrypted]';
      }
    }
    plain.createdAtLocal = formatToLocal(plain.createdAt, req.timezone);
    return plain;
  });

  ApiResponse.success(res, 200, 'Search results fetched successfully', decryptedResults);
};

/**
 * Global Sync for missed messages (Offline Catch-up)
 */
export const syncMessages = async (req, res) => {
  const { since, limit } = req.query;

  if (!since) throw ApiError.badRequest('Sync timestamp (since) is required');

  const messages = await ChatService.getSyncMessages(
    req.user._id,
    since,
    limit ? parseInt(limit) : 100
  );

  // Localize timestamps for synced messages
  const localizedMessages = messages.map(msg => {
    const msgObj = msg.toObject();
    return {
      ...msgObj,
      createdAtLocal: formatToLocal(msg.createdAt, req.timezone),
    };
  });

  ApiResponse.success(res, 200, 'Sync data fetched successfully', {
    messages: localizedMessages,
    count: localizedMessages.length,
    timestamp: new Date()
  });
};

import sharp from 'sharp';

/**
 * Special handler for uploading files specifically for chat
 * Includes automatic thumbnail generation for images
 */
export const uploadChatFile = async (req, res) => {
  if (!req.file) throw ApiError.badRequest('File is required');

  const { taskId } = req.params;
  const isImage = req.file.mimetype.startsWith('image/');
  const isAudio = req.file.mimetype.startsWith('audio/');

  // 1. Upload original file
  const result = await uploadToCloudinary(req.file, `chat/${taskId}`);

  const responseData = {
    url: result.secure_url,
    publicId: result.public_id,
    format: result.format,
    bytes: result.bytes,
    resourceType: result.resource_type,
  };

  // 2. Generate Thumbnail if it's an image
  if (isImage) {
    try {
      const thumbnailBuffer = await sharp(req.file.buffer)
        .resize(200, 200, { fit: 'inside' })
        .webp({ quality: 50 })
        .toBuffer();

      const thumbResult = await uploadToCloudinary(
        { buffer: thumbnailBuffer, mimetype: 'image/webp' },
        `chat/${taskId}/thumbnails`
      );
      
      responseData.thumbnailUrl = thumbResult.secure_url;
    } catch (err) {
      Logger.error('Thumbnail generation failed', { error: err.message });
      // Don't fail the whole request if thumbnail fails
    }
  }

  ApiResponse.success(res, 200, 'File uploaded successfully', responseData);
};
