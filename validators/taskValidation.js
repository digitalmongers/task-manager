import Joi from 'joi';

export const taskValidation = {
  // Create task validation
  createTask: {
    body: Joi.object({
      title: Joi.string()
        .min(3)
        .max(200)
        .trim()
        .required()
        .messages({
          'string.empty': 'Task title is required',
          'string.min': 'Task title must be at least 3 characters',
          'string.max': 'Task title cannot exceed 200 characters',
        }),
      
      description: Joi.string()
        .max(2000)
        .trim()
        .allow(null, '')
        .messages({
          'string.max': 'Description cannot exceed 2000 characters',
        }),
      
      dueDate: Joi.date()
        .min('now')
        .allow(null, '')
        .messages({
          'date.min': 'Due date cannot be in the past',
        }),
      
      priority: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
        }),
      
      status: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid status ID format',
        }),
      
      category: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid category ID format',
        }),
      
      isCompleted: Joi.boolean()
        .messages({
          'boolean.base': 'isCompleted must be a boolean value',
        }),
    }),
  },

  // Update task validation
  updateTask: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
    body: Joi.object({
      title: Joi.string()
        .min(3)
        .max(200)
        .trim()
        .messages({
          'string.min': 'Task title must be at least 3 characters',
          'string.max': 'Task title cannot exceed 200 characters',
        }),
      
      description: Joi.string()
        .max(2000)
        .trim()
        .allow(null, '')
        .messages({
          'string.max': 'Description cannot exceed 2000 characters',
        }),
      
      dueDate: Joi.date()
        .allow(null, '')
        .messages({
          'date.base': 'Invalid due date format',
        }),
      
      priority: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
        }),
      
      status: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid status ID format',
        }),
      
      category: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Invalid category ID format',
        }),
      
      isCompleted: Joi.boolean()
        .messages({
          'boolean.base': 'isCompleted must be a boolean value',
        }),
    })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update',
    }),
  },

  // Delete task validation
  deleteTask: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
  },

  // Get single task validation
  getTask: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
  },

  // Get all tasks validation (query params)
  getAllTasks: {
    query: Joi.object({
      category: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid category ID format',
        }),
      
      status: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid status ID format',
        }),
      
      priority: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
          'string.pattern.base': 'Invalid priority ID format',
        }),
      
      isCompleted: Joi.string()
        .valid('true', 'false')
        .messages({
          'any.only': 'isCompleted must be true or false',
        }),
      
      sort: Joi.string()
        .valid('createdAt', '-createdAt', 'dueDate', '-dueDate', 'title', '-title')
        .messages({
          'any.only': 'Invalid sort parameter',
        }),
      
      page: Joi.number()
        .integer()
        .min(1)
        .messages({
          'number.base': 'Page must be a number',
          'number.min': 'Page must be at least 1',
        }),
      
      limit: Joi.number()
        .integer()
        .min(1)
        .max(100)
        .messages({
          'number.base': 'Limit must be a number',
          'number.min': 'Limit must be at least 1',
          'number.max': 'Limit cannot exceed 100',
        }),
    }),
  },

  // Toggle complete validation
  toggleComplete: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
  },

  // Upload task image validation
  uploadTaskImage: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
  },

  // Delete task image validation
  deleteTaskImage: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid task ID format',
          'string.empty': 'Task ID is required',
        }),
    }),
  },
};