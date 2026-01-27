import ApiError from '../utils/ApiError.js';
import Logger from '../config/logger.js';

// Common patterns used by vulnerability scanners and bots
const BOT_PATTERNS = [
  /\/wp-json/i,
  /\/wp-admin/i,
  /\/wp-content/i,
  /\/wp-includes/i,
  /xmlrpc\.php/i,
  /index\.php\?route=/i, // OpenCart
  /magento/i,
  /phpmyadmin/i,
  /\.env/i,
  /\.git/i,
  /config\.php/i,
  /admin\//i,
  /login\.php/i,
];

const isBotScan = (url) => {
  return BOT_PATTERNS.some(pattern => pattern.test(url));
};

const notFound = (req, res, next) => {
  const message = `Route ${req.originalUrl} not found`;
  
  // If it looks like a bot scan, log it as a warning instead of a full error
  if (isBotScan(req.originalUrl)) {
    Logger.warn(`Potential bot scan detected: ${message}`, {
      ip: req.ip,
      method: req.method,
      userAgent: req.get('user-agent'),
      requestId: req.requestId
    });
    return res.status(404).json({
      success: false,
      statusCode: 404,
      message: message
    });
  }

  next(ApiError.notFound(message));
};

export default notFound;

