import Joi from 'joi';

export const taskStatusValidation = {
  // Create task status validation
  createTaskStatus: {
    body: Joi.object({
      name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .required()
        .messages({
          'string.empty': 'Status name is required',
          'string.min': 'Status name must be at least 2 characters',
          'string.max': 'Status name cannot exceed 50 characters',
        }),
       
      description: Joi.string()
        .max(500)
        .trim()
        .allow(null, '')
        .messages({
          'string.max': 'Description cannot exceed 500 characters',
        }),
      
      color: Joi.string()
        .pattern(/^#([A-Fa-f0-9]{6})$/)
        .messages({
          'string.pattern.base': 'Please provide a valid hex color (e.g., #10B981)',
        }),
    }),
  },

  // Update task status validation
  updateTaskStatus: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid status ID format',
          'string.empty': 'Status ID is required',
        }),
    }),
    body: Joi.object({
      name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .messages({
          'string.min': 'Status name must be at least 2 characters',
          'string.max': 'Status name cannot exceed 50 characters',
        }),
      
      description: Joi.string()
        .max(500)
        .trim()
        .allow(null, '')
        .messages({
          'string.max': 'Description cannot exceed 500 characters',
        }),
      
      color: Joi.string()
        .pattern(/^#([A-Fa-f0-9]{6})$/)
        .messages({
          'string.pattern.base': 'Please provide a valid hex color (e.g., #10B981)',
        }),
    })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update',
    }),
  },

  // Delete task status validation
  deleteTaskStatus: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid status ID format',
          'string.empty': 'Status ID is required',
        }),
    }),
  },

  // Get single task status validation
  getTaskStatus: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid status ID format',
          'string.empty': 'Status ID is required',
        }),
    }),
  },
};