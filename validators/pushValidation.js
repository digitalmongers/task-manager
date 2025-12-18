import Joi from 'joi';

export const pushValidation = {
  // Subscribe to push notifications
  subscribe: {
    body: Joi.object({
      subscription: Joi.object({
        endpoint: Joi.string().uri().required().messages({
          'string.uri': 'Invalid endpoint URL',
          'any.required': 'Endpoint is required',
        }),
        keys: Joi.object({
          p256dh: Joi.string().required().messages({
            'any.required': 'p256dh key is required',
          }),
          auth: Joi.string().required().messages({
            'any.required': 'Auth key is required',
          }),
        }).required().messages({
          'any.required': 'Encryption keys are required',
        }),
      }).required().messages({
        'any.required': 'Subscription object is required',
      }),
    }),
  },
};
