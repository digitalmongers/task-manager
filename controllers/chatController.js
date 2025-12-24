import chatService from '../services/chatService.js';
import ApiResponse from '../utils/ApiResponse.js';
import ApiError from '../utils/ApiError.js';
import { uploadSingle } from './upload.js'; // Reuse upload controller logic if needed, or implement specific one

export const getHistory = async (req, res) => {
  const { taskId } = req.params;
  const { page, limit, before } = req.query;

  const history = await chatService.getChatHistory(taskId, req.user._id, {
    page: parseInt(page),
    limit: parseInt(limit),
    before
  });

  ApiResponse.success(res, 200, 'Chat history fetched successfully', history);
};

export const sendMessage = async (req, res) => {
  const { taskId } = req.params;
  const { content, messageType, fileDetails, replyTo, mentions } = req.body;

  if (!content && !fileDetails) {
    throw ApiError.badRequest('Message content or file is required');
  }

  const message = await chatService.sendMessage(taskId, req.user._id, {
    content,
    messageType,
    fileDetails,
    replyTo,
    mentions
  });

  ApiResponse.success(res, 201, 'Message sent successfully', message);
};

export const getMembers = async (req, res) => {
  const { taskId } = req.params;
  const members = await chatService.getChatMembers(taskId, req.user._id);
  ApiResponse.success(res, 200, 'Chat members fetched successfully', members);
};

export const toggleReaction = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { emoji } = req.body;

  const reactions = await chatService.toggleReaction(taskId, messageId, req.user._id, emoji);
  ApiResponse.success(res, 200, 'Reaction updated successfully', reactions);
};

export const editMessage = async (req, res) => {
  const { taskId, messageId } = req.params;
  const { content } = req.body;

  if (!content) throw ApiError.badRequest('New content is required');

  const message = await chatService.editMessage(taskId, messageId, req.user._id, content);
  ApiResponse.success(res, 200, 'Message edited successfully', message);
};

export const deleteMessage = async (req, res) => {
  const { taskId, messageId } = req.params;

  const result = await chatService.deleteMessage(taskId, messageId, req.user._id);
  ApiResponse.success(res, 200, 'Message deleted successfully', result);
};

export const togglePin = async (req, res) => {
  const { taskId, messageId } = req.params;

  const result = await chatService.togglePin(taskId, messageId, req.user._id);
  ApiResponse.success(res, 200, result.isPinned ? 'Message pinned' : 'Message unpinned', result);
};

export const getPinned = async (req, res) => {
  const { taskId } = req.params;

  const pinned = await chatService.getPinnedMessages(taskId, req.user._id);
  ApiResponse.success(res, 200, 'Pinned messages fetched successfully', pinned);
};

export const search = async (req, res) => {
  const { taskId } = req.params;
  const { q } = req.query;

  if (!q) throw ApiError.badRequest('Search query is required');

  const results = await chatService.searchMessages(taskId, req.user._id, q);
  ApiResponse.success(res, 200, 'Search results fetched successfully', results);
};

/**
 * Special handler for uploading files specifically for chat
 * This might be used by the frontend before sending the actual message
 */
export const uploadChatFile = async (req, res) => {
  // We can reuse the existing uploadSingle controller if we want
  // or wrap it to provide chat-specific folder
  return uploadSingle(req, res);
};
