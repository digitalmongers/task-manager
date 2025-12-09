import Joi from 'joi';

export const taskPriorityValidation = {
  // Create task priority validation
  createTaskPriority: {
    body: Joi.object({
      name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .required()
        .messages({
          'string.empty': 'Priority name is required',
          'string.min': 'Priority name must be at least 2 characters',
          'string.max': 'Priority name cannot exceed 50 characters',
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
          'string.pattern.base': 'Please provide a valid hex color (e.g., #F59E0B)',
        }),
    }),
  },

  // Update task priority validation
  updateTaskPriority: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
          'string.empty': 'Priority ID is required',
        }),
    }),
    body: Joi.object({
      name: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .messages({
          'string.min': 'Priority name must be at least 2 characters',
          'string.max': 'Priority name cannot exceed 50 characters',
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
          'string.pattern.base': 'Please provide a valid hex color (e.g., #F59E0B)',
        }),
    })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update',
    }),
  },

  // Delete task priority validation
  deleteTaskPriority: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
          'string.empty': 'Priority ID is required',
        }),
    }),
  },

  // Get single task priority validation
  getTaskPriority: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
          'string.empty': 'Priority ID is required',
        }),
    }),
  },
};