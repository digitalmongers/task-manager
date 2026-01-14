import express from 'express';
import CollaborationController from '../controllers/collaborationController.js';
import { collaborationValidation } from '../validators/collaborationValidation.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';

const router = express.Router();

// Rate limiters
const invitationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 invitations per 5 minutes
  message: {
    success: false,
    message: 'Too many invitations sent, please try again later',
  },
});

const collaborationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000, // 10000 requests per 5 minutes
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

// Additional validation for sharing with team
const shareWithTeamValidation = {
  params: Joi.object({
    taskId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid task ID format',
      }),
  }),
  body: Joi.object({
    memberIds: Joi.array()
      .items(Joi.string().regex(/^[0-9a-fA-F]{24}$/))
      .min(1)
      .required()
      .messages({
        'array.min': 'At least one team member must be selected',
        'array.base': 'Member IDs must be an array',
      }),
  }),
};

// ========== TASK COLLABORATION ROUTES ==========
router.use(protect);
router.use(timezoneMiddleware);

// Invite user to task (via email - for non-team members)
router.post(
  '/tasks/:taskId/collaborators/invite',
  invitationLimiter,
  validate(collaborationValidation.inviteToTask),
  asyncHandler(CollaborationController.inviteToTask.bind(CollaborationController))
);

// Share task with team members (direct sharing)
router.post(
  '/tasks/:taskId/share-with-team',
  collaborationLimiter,
  validate(shareWithTeamValidation),
  asyncHandler(CollaborationController.shareWithTeamMembers.bind(CollaborationController))
);

// Get available team members for sharing
router.get(
  '/tasks/:taskId/available-team-members',
  collaborationLimiter,
  asyncHandler(CollaborationController.getAvailableTeamMembers.bind(CollaborationController))
);

// Get task collaborators
router.get(
  '/tasks/:taskId/collaborators',
  collaborationLimiter,
  validate(collaborationValidation.getTaskCollaborators),
  asyncHandler(CollaborationController.getTaskCollaborators.bind(CollaborationController))
);

// Update collaborator role
router.patch(
  '/tasks/:taskId/collaborators/:collaboratorId/role',
  collaborationLimiter,
  validate(collaborationValidation.updateCollaboratorRole),
  asyncHandler(CollaborationController.updateCollaboratorRole.bind(CollaborationController))
);

// Remove collaborator
router.delete(
  '/tasks/:taskId/collaborators/:collaboratorId',
  collaborationLimiter,
  validate(collaborationValidation.removeCollaborator),
  asyncHandler(CollaborationController.removeCollaborator.bind(CollaborationController))
);

// Transfer ownership
router.post(
  '/tasks/:taskId/transfer-ownership',
  collaborationLimiter,
  validate(collaborationValidation.transferOwnership),
  asyncHandler(CollaborationController.transferOwnership.bind(CollaborationController))
);

// Generate share link
router.post(
  '/tasks/:taskId/share-link',
  collaborationLimiter,
  validate(collaborationValidation.generateShareLink),
  asyncHandler(CollaborationController.generateShareLink.bind(CollaborationController))
);

// Access task via share link (requires login)
router.get(
  '/tasks/shared/:token',
  collaborationLimiter,
  asyncHandler(CollaborationController.accessViaShareLink.bind(CollaborationController))
);

// ========== INVITATION ROUTES ==========

// Get task invitations (pending)
router.get(
  '/tasks/:taskId/invitations',
  collaborationLimiter,
  validate(collaborationValidation.getTaskInvitations),
  asyncHandler(CollaborationController.getTaskInvitations.bind(CollaborationController))
);

// Cancel invitation
router.delete(
  '/tasks/:taskId/invitations/:invitationId',
  collaborationLimiter,
  validate(collaborationValidation.cancelInvitation),
  asyncHandler(CollaborationController.cancelInvitation.bind(CollaborationController))
);

// Accept invitation (requires auth)
router.post(
  '/invitations/:token/accept',
  optionalAuth,
  collaborationLimiter,
  validate(collaborationValidation.acceptInvitation),
  asyncHandler(CollaborationController.acceptInvitation.bind(CollaborationController))
);

// Decline invitation (optional auth - can decline without login)
router.post(
  '/invitations/:token/decline',
  optionalAuth,
  collaborationLimiter,
  validate(collaborationValidation.declineInvitation),
  asyncHandler(CollaborationController.declineInvitation.bind(CollaborationController))
);

// ========== USER SHARED TASKS ==========

// Get user's shared tasks
router.get(
  '/shared-tasks',
  collaborationLimiter,
  asyncHandler(CollaborationController.getUserSharedTasks.bind(CollaborationController))
);

export default router;