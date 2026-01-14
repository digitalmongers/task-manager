import express from 'express';
import VitalTaskCollaborationController from '../controllers/vitalTaskCollaborationController.js';
import { vitalTaskCollaborationValidation } from '../validators/vitalTaskCollaboration.validation.js';
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
    vitalTaskId: Joi.string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.pattern.base': 'Invalid vital task ID format',
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

// ========== VITAL TASK COLLABORATION ROUTES ==========
router.use(protect);
router.use(timezoneMiddleware);

// Invite user to vital task (via email - for non-team members)
router.post(
  '/vital-tasks/:vitalTaskId/collaborators/invite',
  invitationLimiter,
  validate(vitalTaskCollaborationValidation.inviteToVitalTask),
  asyncHandler(VitalTaskCollaborationController.inviteToVitalTask.bind(VitalTaskCollaborationController))
);

// Share vital task with team members (direct sharing)
router.post(
  '/vital-tasks/:vitalTaskId/share-with-team',
  collaborationLimiter,
  validate(shareWithTeamValidation),
  asyncHandler(VitalTaskCollaborationController.shareWithTeamMembers.bind(VitalTaskCollaborationController))
);

// Get available team members for sharing
router.get(
  '/vital-tasks/:vitalTaskId/available-team-members',
  collaborationLimiter,
  asyncHandler(VitalTaskCollaborationController.getAvailableTeamMembers.bind(VitalTaskCollaborationController))
);

// Get vital task collaborators
router.get(
  '/vital-tasks/:vitalTaskId/collaborators',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.getVitalTaskCollaborators),
  asyncHandler(VitalTaskCollaborationController.getVitalTaskCollaborators.bind(VitalTaskCollaborationController))
);

// Update collaborator role
router.patch(
  '/vital-tasks/:vitalTaskId/collaborators/:collaboratorId/role',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.updateCollaboratorRole),
  asyncHandler(VitalTaskCollaborationController.updateCollaboratorRole.bind(VitalTaskCollaborationController))
);

// Remove collaborator
router.delete(
  '/vital-tasks/:vitalTaskId/collaborators/:collaboratorId',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.removeCollaborator),
  asyncHandler(VitalTaskCollaborationController.removeCollaborator.bind(VitalTaskCollaborationController))
);

// Transfer ownership
router.post(
  '/vital-tasks/:vitalTaskId/transfer-ownership',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.transferOwnership),
  asyncHandler(VitalTaskCollaborationController.transferOwnership.bind(VitalTaskCollaborationController))
);

// Generate share link
router.post(
  '/vital-tasks/:vitalTaskId/share-link',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.generateShareLink),
  asyncHandler(VitalTaskCollaborationController.generateShareLink.bind(VitalTaskCollaborationController))
);

// Access vital task via share link (requires login)
router.get(
  '/vital-tasks/shared/:token',
  collaborationLimiter,
  asyncHandler(VitalTaskCollaborationController.accessViaShareLink.bind(VitalTaskCollaborationController))
);

// ========== INVITATION ROUTES ==========

// Get vital task invitations (pending)
router.get(
  '/vital-tasks/:vitalTaskId/invitations',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.getVitalTaskInvitations),
  asyncHandler(VitalTaskCollaborationController.getVitalTaskInvitations.bind(VitalTaskCollaborationController))
);

// Cancel invitation
router.delete(
  '/vital-tasks/:vitalTaskId/invitations/:invitationId',
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.cancelInvitation),
  asyncHandler(VitalTaskCollaborationController.cancelInvitation.bind(VitalTaskCollaborationController))
);

// Accept invitation (requires auth)
router.post(
  '/vital-task-invitations/:token/accept',
  optionalAuth,
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.acceptInvitation),
  asyncHandler(VitalTaskCollaborationController.acceptInvitation.bind(VitalTaskCollaborationController))
);

// Decline invitation (optional auth - can decline without login)
router.post(
  '/vital-task-invitations/:token/decline',
  optionalAuth,
  collaborationLimiter,
  validate(vitalTaskCollaborationValidation.declineInvitation),
  asyncHandler(VitalTaskCollaborationController.declineInvitation.bind(VitalTaskCollaborationController))
);

// ========== USER SHARED VITAL TASKS ==========

// Get user's shared vital tasks
router.get(
  '/shared-vital-tasks',
  collaborationLimiter,
  asyncHandler(VitalTaskCollaborationController.getUserSharedVitalTasks.bind(VitalTaskCollaborationController))
);

export default router;
