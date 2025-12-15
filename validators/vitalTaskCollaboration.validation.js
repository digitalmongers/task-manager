import Joi from 'joi';

export const vitalTaskCollaborationValidation = {
  // Invite to vital task
  inviteToVitalTask: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
          'string.empty': 'Vital task ID is required',
        }),
    }),
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

  // Get vital task collaborators
  getVitalTaskCollaborators: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
          'string.empty': 'Vital task ID is required',
        }),
    }),
  },

  // Update collaborator role
  updateCollaboratorRole: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
      collaboratorId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid collaborator ID format',
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

  // Remove collaborator
  removeCollaborator: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
      collaboratorId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid collaborator ID format',
        }),
    }),
  },

  // Transfer ownership
  transferOwnership: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
    }),
    body: Joi.object({
      newOwnerId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid user ID format',
          'string.empty': 'New owner ID is required',
        }),
    }),
  },

  // Generate share link
  generateShareLink: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
    }),
  },

  // Get vital task invitations
  getVitalTaskInvitations: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
    }),
  },

  // Cancel invitation
  cancelInvitation: {
    params: Joi.object({
      vitalTaskId: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid vital task ID format',
        }),
      invitationId: Joi.string()
        .required()
        .messages({
          'string.empty': 'Invitation ID is required',
        }),
    }),
  },

  // Accept invitation
  acceptInvitation: {
    params: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Invitation token is required',
        }),
    }),
  },

  // Decline invitation
  declineInvitation: {
    params: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Invitation token is required',
        }),
    }),
  },
};
