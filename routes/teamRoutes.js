import express from 'express';
import TeamController from '../controllers/TeamController.js';
import validate from '../middlewares/validate.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { protect, optionalAuth } from '../middlewares/authMiddleware.js';
import { timezoneMiddleware } from '../middlewares/timezoneMiddleware.js';

const router = express.Router();

// Apply timezone middleware to all team routes
router.use(timezoneMiddleware);

// Rate limiters
const teamLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000,
  message: {
    success: false,
    message: 'Too many requests, please try again later',
  },
});

const inviteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10000,
  message: {
    success: false,
    message: 'Too many invitations sent, please try again later',
  },
});

// Validation schemas
const teamValidation = {
  inviteTeamMember: {
    body: Joi.object({
      email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
          'string.empty': 'Email is required',
          'string.email': 'Please provide a valid email address',
        }),
      role: Joi.string()
        .valid('editor', 'assignee', 'viewer')
        .default('editor')
        .messages({
          'any.only': 'Role must be one of: editor, assignee, viewer',
        }),
      message: Joi.string()
        .max(500)
        .trim()
        .allow(null, '')
        .messages({
          'string.max': 'Message cannot exceed 500 characters',
        }),
    }),
  },

  updateMemberRole: {
    params: Joi.object({
      memberId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid member ID format',
        }),
    }),
    body: Joi.object({
      role: Joi.string()
        .valid('editor', 'assignee', 'viewer')
        .required()
        .messages({
          'any.only': 'Role must be one of: editor, assignee, viewer',
          'string.empty': 'Role is required',
        }),
    }),
  },

  acceptInvitation: {
    params: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Invitation token is required',
        }),
    }),
  },
};

// ========== ALL ROUTES REQUIRE AUTHENTICATION (except accept/decline) ==========

// Invite team member
router.post(
  '/invite',
  protect,
  inviteLimiter,
  validate(teamValidation.inviteTeamMember),
  asyncHandler(TeamController.inviteTeamMember.bind(TeamController))
);

// Get team members
router.get(
  '/members',
  protect,
  teamLimiter,
  asyncHandler(TeamController.getTeamMembers.bind(TeamController))
);

// Accept invitation (requires auth - user must login/signup first)

router.post(
  '/accept/:token',
  optionalAuth,
  teamLimiter,
  validate(teamValidation.acceptInvitation),
  asyncHandler(TeamController.acceptInvitation.bind(TeamController))
);

// Decline invitation (can be done without login)
router.post(
  '/decline/:token',
  optionalAuth,
  teamLimiter,
  validate(teamValidation.acceptInvitation),
  asyncHandler(TeamController.declineInvitation.bind(TeamController))
);

// Remove team member
router.delete(
  '/members/:memberId',
  protect,
  teamLimiter,
  asyncHandler(TeamController.removeTeamMember.bind(TeamController))
);

// Update member role
router.patch(
  '/members/:memberId/role',
  protect,
  teamLimiter,
  validate(teamValidation.updateMemberRole),
  asyncHandler(TeamController.updateMemberRole.bind(TeamController))
);

// Get my teams (where I'm a member)
router.get(
  '/my-teams',
  protect,
  teamLimiter,
  asyncHandler(TeamController.getMyTeams.bind(TeamController))
);

// Cancel pending invitation
router.delete(
  '/invitations/:invitationId',
  protect,
  teamLimiter,
  asyncHandler(TeamController.cancelInvitation.bind(TeamController))
);

export default router;