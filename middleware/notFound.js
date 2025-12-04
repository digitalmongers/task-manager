import ApiError from '../utils/ApiError.js';
import { ERROR_MESSAGES } from '../config/constants.js';


const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  next(ApiError.notFound(message));
};

export default notFound;
