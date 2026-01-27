import Joi from 'joi';

export const categoryValidation = {
  // Create category validation
  createCategory: {
    body: Joi.object({
      title: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .required()
        .messages({
          'string.empty': 'Category title is required',
          'string.min': 'Category title must be at least 2 characters',
          'string.max': 'Category title cannot exceed 50 characters',
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
          'string.pattern.base': 'Please provide a valid hex color (e.g., #3B82F6)',
        }),
    }),
  },

  // Update category validation
  updateCategory: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid category ID format',
          'string.empty': 'Category ID is required',
        }),
    }),
    body: Joi.object({
      title: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .messages({
          'string.min': 'Category title must be at least 2 characters',
          'string.max': 'Category title cannot exceed 50 characters',
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
          'string.pattern.base': 'Please provide a valid hex color (e.g., #3B82F6)',
        }),
    })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update',
    }),
  },

  // Delete category validation
  deleteCategory: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid category ID format',
          'string.empty': 'Category ID is required',
        }),
    }),
  },

  // Get single category validation
  getCategory: {
    params: Joi.object({
      id: Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
          'string.pattern.base': 'Invalid category ID format',
          'string.empty': 'Category ID is required',
        }),
    }),
  },
};