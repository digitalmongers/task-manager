import Joi from 'joi';

/**
 * Validation for vital tasks
 */
export const vitalTaskValidation = {
  // Create vital task validation
  createVitalTask: {
    body: Joi.object({
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

      priority: Joi.alternatives().try(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/), // ObjectId
        Joi.string().min(1) // Name lookup
      ).allow(null, '').messages({
        'alternatives.match': 'Priority must be a valid ID or name',
      }),

      status: Joi.string()
        .valid('Not Started', 'In Progress', 'Completed')
        .allow(null)
        .messages({
          'any.only': 'Status must be one of: Not Started, In Progress, Completed',
        }),

      category: Joi.alternatives().try(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/), // ObjectId
        Joi.string() // Name lookup or empty
      ).allow(null, '').messages({
        'alternatives.match': 'Category must be a valid ID or name',
      }),

      isCompleted: Joi.boolean().messages({
        'boolean.base': 'isCompleted must be a boolean',
      }),

      steps: Joi.alternatives().try(
        Joi.array().items(Joi.any()),
        Joi.string().allow('', null)
      ).messages({
        'alternatives.types': 'Steps must be an array or a string',
      }),
    })
  },

  // Update vital task validation
  updateVitalTask: {
    body: Joi.object({
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

      priority: Joi.alternatives().try(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
        Joi.string().min(1)
      ).allow(null, '').messages({
        'alternatives.match': 'Priority must be a valid ID or name',
      }),

      status: Joi.string()
        .valid('Not Started', 'In Progress', 'Completed')
        .allow(null)
        .messages({
          'any.only': 'Status must be one of: Not Started, In Progress, Completed',
        }),

      category: Joi.alternatives().try(
        Joi.string().pattern(/^[0-9a-fA-F]{24}$/),
        Joi.string()
      ).allow(null, '').messages({
        'alternatives.match': 'Category must be a valid ID or name',
      }),

      isCompleted: Joi.boolean().messages({
        'boolean.base': 'isCompleted must be a boolean',
      }),

      steps: Joi.alternatives().try(
        Joi.array().items(Joi.any()),
        Joi.string().allow('', null)
      ).messages({
        'alternatives.types': 'Steps must be an array or a string',
      }),
    })
  }
};
