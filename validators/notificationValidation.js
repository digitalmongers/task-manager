import Joi from 'joi';

/**
 * Validation schema for toggling WebSocket notifications
 */
export const toggleWebSocketNotificationsSchema = Joi.object({
  enabled: Joi.boolean().required().messages({
    'boolean.base': 'Enabled must be a boolean value',
    'any.required': 'Enabled field is required',
  }),
});

/**
 * Validation schema for notification query parameters
 */
export const getNotificationsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  skip: Joi.number().integer().min(0).default(0),
  isRead: Joi.boolean().optional(),
  type: Joi.string().optional(),
  teamId: Joi.string().optional(),
});
