import logger from '../config/logger.js';

// Sensitive fields to sanitize
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'secret', 'authorization', 'creditCard', 'ssn'];

/**
 * Sanitize object by removing sensitive fields
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive field name
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Safe logger middleware - logs errors with sanitized data
 */
function safeLogger(err, req, res, next) {
  const errorLog = {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    body: sanitizeObject(req.body),
    params: req.params,
    query: sanitizeObject(req.query),
    timestamp: new Date().toISOString(),
    errorType: err.name || 'Error',
  };

  // Log the error
  logger.error('Request Error', errorLog);

  // Don't send response here - let errorHandler middleware handle it
  next(err);
}

export default safeLogger;
