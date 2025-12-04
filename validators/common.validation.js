import Joi from 'joi';
import { REGEX, PAGINATION } from '../config/constants.js';

/**
 * MongoDB ObjectId validation
 */
export const objectId = Joi.string().pattern(REGEX.MONGODB_ID).message('Invalid ID format');

/**
 * Email validation
 */
export const email = Joi.string().email().lowercase().trim().required();

/**
 * Password validation
 * At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
 */
export const password = Joi.string()
  .min(8)
  .pattern(REGEX.PASSWORD)
  .message('Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character')
  .required();

/**
 * Phone number validation (Indian format)
 */
export const phone = Joi.string()
  .pattern(REGEX.PHONE)
  .message('Invalid phone number format')
  .optional();

/**
 * Pagination query validation
 */
export const paginationQuery = {
  page: Joi.number().integer().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: Joi.number().integer().min(1).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  sort: Joi.string().optional(),
  order: Joi.string().valid('asc', 'desc').default('desc'),
};

/**
 * Search query validation
 */
export const searchQuery = {
  search: Joi.string().trim().optional(),
  ...paginationQuery,
};

/**
 * Date range validation
 */
export const dateRange = {
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
};

/**
 * Common param validation
 */
export const idParam = {
  id: objectId.required(),
};

/**
 * Status validation
 */
export const status = Joi.string().valid('active', 'inactive', 'pending', 'completed').optional();
