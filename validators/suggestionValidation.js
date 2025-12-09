import Joi from 'joi';

export const suggestionValidation = {
  // Submit suggestion validation
  submitSuggestion: {
    body: Joi.object({
      title: Joi.string()
        .min(3)
        .max(200)
        .trim()
        .required()
        .messages({
          'string.empty': 'Title is required',
          'string.min': 'Title must be at least 3 characters',
          'string.max': 'Title cannot exceed 200 characters',
        }),
      description: Joi.string()
        .min(10)
        .max(1000)
        .trim()
        .required()
        .messages({
          'string.empty': 'Description is required',
          'string.min': 'Description must be at least 10 characters',
          'string.max': 'Description cannot exceed 1000 characters',
        }),
      message: Joi.string()
        .min(20)
        .max(5000)
        .trim()
        .required()
        .messages({
          'string.empty': 'Message is required',
          'string.min': 'Message must be at least 20 characters',
          'string.max': 'Message cannot exceed 5000 characters',
        }),
      userEmail: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
          'string.empty': 'Email is required',
          'string.email': 'Please provide a valid email address',
        }),
    }),
  },

  // Get suggestion by ID
  getSuggestion: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.empty': 'Suggestion ID is required',
          'string.pattern.base': 'Invalid suggestion ID format',
        }),
    }),
  },

  // Get user suggestions with pagination
  getUserSuggestions: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(10),
    }),
  },
};