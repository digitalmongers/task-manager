import Joi from 'joi';

export const contactValidation = {
  sendMessage: {
    body: Joi.object({
      name: Joi.string()
        .min(2)
        .max(100)
        .trim()
        .required()
        .messages({
          'string.empty': 'Name is required',
          'string.min': 'Name must be at least 2 characters',
          'string.max': 'Name cannot exceed 100 characters',
        }),
      email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
          'string.empty': 'Email is required',
          'string.email': 'Please provide a valid email address',
        }),
      subject: Joi.string()
        .min(5)
        .max(200)
        .trim()
        .required()
        .messages({
          'string.empty': 'Subject is required',
          'string.min': 'Subject must be at least 5 characters',
          'string.max': 'Subject cannot exceed 200 characters',
        }),
      message: Joi.string()
        .min(10)
        .max(2000)
        .trim()
        .required()
        .messages({
          'string.empty': 'Message is required',
          'string.min': 'Message must be at least 10 characters',
          'string.max': 'Message cannot exceed 2000 characters',
        }),
    }),
  },
};