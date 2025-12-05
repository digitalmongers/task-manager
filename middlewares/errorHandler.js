import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';
import { HTTP_STATUS, ERROR_MESSAGES } from '../config/constants.js';


const convertToApiError = (err) => {
  let error = err;

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((e) => e.message);
    error = ApiError.unprocessableEntity(errors.join(', '));
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    error = ApiError.conflict(`${field} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized(ERROR_MESSAGES.INVALID_TOKEN);
  }

  if (err.name === 'TokenExpiredError') {
    error = ApiError.unauthorized(ERROR_MESSAGES.TOKEN_EXPIRED);
  }

  // Multer errors
  if (err.name === 'MulterError') {
    error = ApiError.badRequest(err.message);
  }

  return error;
};


const errorHandler = (err, req, res, next) => {
  let error = convertToApiError(err);

  
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
    const message = error.message || ERROR_MESSAGES.INTERNAL_ERROR;
    error = new ApiError(statusCode, message, false, err.stack);
  }

  
  Logger.logError(error, req);

  
  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  
  res.status(error.statusCode).json(response);
};

export default errorHandler;
