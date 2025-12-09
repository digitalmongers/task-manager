import Joi from 'joi';

/**
 * Validation for creating vital task
 */
export const createVitalTaskSchema = Joi.object({
  title: Joi.string().min(3).max(200).required().messages({
    'string.base': 'Title must be a string',
    'string.empty': 'Title is required',
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title cannot exceed 200 characters',
    'any.required': 'Title is required',
  }),

  description: Joi.string().max(2000).allow(null, '').messages({
    'string.base': 'Description must be a string',
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  dueDate: Joi.date().iso().allow(null).messages({
    'date.base': 'Due date must be a valid date',
    'date.format': 'Due date must be in ISO format',
  }),

  priority: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid priority ID format',
    }),

  status: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid status ID format',
    }),

  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),

  isCompleted: Joi.boolean().messages({
    'boolean.base': 'isCompleted must be a boolean',
  }),
});

/**
 * Validation for updating vital task
 */
export const updateVitalTaskSchema = Joi.object({
  title: Joi.string().min(3).max(200).messages({
    'string.base': 'Title must be a string',
    'string.min': 'Title must be at least 3 characters',
    'string.max': 'Title cannot exceed 200 characters',
  }),

  description: Joi.string().max(2000).allow(null, '').messages({
    'string.base': 'Description must be a string',
    'string.max': 'Description cannot exceed 2000 characters',
  }),

  dueDate: Joi.date().iso().allow(null).messages({
    'date.base': 'Due date must be a valid date',
    'date.format': 'Due date must be in ISO format',
  }),

  priority: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid priority ID format',
    }),

  status: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid status ID format',
    }),

  category: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid category ID format',
    }),

  isCompleted: Joi.boolean().messages({
    'boolean.base': 'isCompleted must be a boolean',
  }),
}).min(1);
