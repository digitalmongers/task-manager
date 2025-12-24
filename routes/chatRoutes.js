import express from 'express';
import * as chatController from '../controllers/chatController.js';
import { protect } from '../middlewares/authMiddleware.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import upload from '../middlewares/upload.js';

const router = express.Router();

// All chat routes require authentication
router.use(protect);

router.get('/:taskId/history', asyncHandler(chatController.getHistory));
router.get('/:taskId/members', asyncHandler(chatController.getMembers));
router.get('/:taskId/pinned', asyncHandler(chatController.getPinned));
router.get('/:taskId/search', asyncHandler(chatController.search));
router.post('/:taskId/send', asyncHandler(chatController.sendMessage));
router.patch('/:taskId/messages/:messageId', asyncHandler(chatController.editMessage));
router.delete('/:taskId/messages/:messageId', asyncHandler(chatController.deleteMessage));
router.post('/:taskId/messages/:messageId/pin', asyncHandler(chatController.togglePin));
router.post('/:taskId/messages/:messageId/reaction', asyncHandler(chatController.toggleReaction));

// File upload for chat
router.post(
  '/:taskId/upload', 
  upload.single('file'), 
  asyncHandler(chatController.uploadChatFile)
);

export default router;
