import Joi from 'joi';

// Custom password validation
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

export const authValidation = {
  // Register validation
  register: {
    body: Joi.object({
      firstName: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .required()
        .messages({
          'string.empty': 'First name is required',
          'string.min': 'First name must be at least 2 characters',
          'string.max': 'First name cannot exceed 50 characters',
        }),
      lastName: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .required()
        .messages({
          'string.empty': 'Last name is required',
          'string.min': 'Last name must be at least 2 characters',
          'string.max': 'Last name cannot exceed 50 characters',
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
      password: Joi.string()
        .min(8)
        .pattern(passwordRegex)
        .required()
        .messages({
          'string.empty': 'Password is required',
          'string.min': 'Password must be at least 8 characters',
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        }),
      confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
          'any.only': 'Passwords do not match',
          'string.empty': 'Confirm password is required',
        }),
      termsAccepted: Joi.boolean()
        .valid(true)
        .required()
        .messages({
          'any.only': 'You must accept the terms and conditions',
          'boolean.base': 'Terms acceptance must be a boolean value',
        }),
    }),
  },

  // Login validation
  login: {
    body: Joi.object({
      email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
          'string.empty': 'Email is required',
          'string.email': 'Please provide a valid email address',
        }),
      password: Joi.string()
        .required()
        .messages({
          'string.empty': 'Password is required',
        }),
      rememberMe: Joi.boolean().default(false),
    }),
  },

  // Email verification
  verifyEmail: {
    params: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Verification token is required',
        }),
    }),
  },

  // Resend verification email
  resendVerification: {
    body: Joi.object({
      email: Joi.string()
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

  // Forgot password
  forgotPassword: {
    body: Joi.object({
      email: Joi.string()
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

  // Reset password
  resetPassword: {
    params: Joi.object({
      token: Joi.string()
        .required()
        .messages({
          'string.empty': 'Reset token is required',
        }),
    }),
    body: Joi.object({
      password: Joi.string()
        .min(8)
        .pattern(passwordRegex)
        .required()
        .messages({
          'string.empty': 'Password is required',
          'string.min': 'Password must be at least 8 characters',
          'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        }),
      confirmPassword: Joi.string()
        .valid(Joi.ref('password'))
        .required()
        .messages({
          'any.only': 'Passwords do not match',
          'string.empty': 'Confirm password is required',
        }),
    }),
  },

  // ========== UPDATED: Change password validation ==========
  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string()
        .required()
        .messages({
          'string.empty': 'Current password is required',
        }),
      newPassword: Joi.string()
        .min(8)
        .max(128)
        .pattern(passwordRegex)
        .required()
        .invalid(Joi.ref('currentPassword'))
        .messages({
          'string.empty': 'New password is required',
          'string.min': 'New password must be at least 8 characters',
          'string.max': 'New password cannot exceed 128 characters',
          'any.invalid': 'New password must be different from current password',
          'string.pattern.base': 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        }),
      confirmPassword: Joi.string()
        .valid(Joi.ref('newPassword'))
        .required()
        .messages({
          'any.only': 'Passwords do not match',
          'string.empty': 'Confirm password is required',
        }),
    }),
  },

  // ========== NEW: Profile update validation ==========
  updateProfile: {
    body: Joi.object({
      firstName: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .messages({
          'string.min': 'First name must be at least 2 characters',
          'string.max': 'First name cannot exceed 50 characters',
        }),
      lastName: Joi.string()
        .min(2)
        .max(50)
        .trim()
        .messages({
          'string.min': 'Last name must be at least 2 characters',
          'string.max': 'Last name cannot exceed 50 characters',
        }),
      phoneNumber: Joi.string()
        .pattern(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
        .allow(null, '')
        .messages({
          'string.pattern.base': 'Please provide a valid phone number',
        }),
    })
    .min(1)
    .messages({
      'object.min': 'At least one field is required to update',
    }),
  },

  // ========== NEW: Delete account validation ==========
  deleteAccount: {
    body: Joi.object({
      password: Joi.string()
        .required()
        .messages({
          'string.empty': 'Password is required to delete account',
        }),
    }),
  },

  // Add these validations to your existing authValidation object:

// ========== NEW: Google unlink validation ==========
unlinkGoogle: {
  body: Joi.object({
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(passwordRegex)
      .required()
      .messages({
        'string.empty': 'Password is required to unlink Google account',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      }),
  }),
},

// ========== NEW: Check email validation ==========
checkEmail: {
  body: Joi.object({
    email: Joi.string()
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



// ========== NEW: Facebook unlink validation ==========
unlinkFacebook: {
  body: Joi.object({
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(passwordRegex)
      .required()
      .messages({
        'string.empty': 'Password is required to unlink Facebook account',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password cannot exceed 128 characters',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      }),
  }),
},
};