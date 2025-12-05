import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';


class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
     
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  
  static badRequest(message = ERROR_MESSAGES.BAD_REQUEST) {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message);
  }

  static unauthorized(message = ERROR_MESSAGES.UNAUTHORIZED) {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static forbidden(message = ERROR_MESSAGES.FORBIDDEN) {
    return new ApiError(HTTP_STATUS.FORBIDDEN, message);
  }

  static notFound(message = ERROR_MESSAGES.RESOURCE_NOT_FOUND) {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message = ERROR_MESSAGES.DUPLICATE_RESOURCE) {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static unprocessableEntity(message = ERROR_MESSAGES.VALIDATION_ERROR) {
    return new ApiError(HTTP_STATUS.UNPROCESSABLE_ENTITY, message);
  }

  static tooManyRequests(message = ERROR_MESSAGES.TOO_MANY_REQUESTS) {
    return new ApiError(HTTP_STATUS.TOO_MANY_REQUESTS, message);
  }

  static internal(message = ERROR_MESSAGES.INTERNAL_ERROR) {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, false);
  }
}

export default ApiError;
