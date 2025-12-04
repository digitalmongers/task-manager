import logger from '../config/logger.js';

// Sensitive fields to sanitize
const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'secret', 'authorization', 'creditCard', 'ssn', 'pin'];

/**
 * Sanitize data before logging
 */
function sanitize(data) {
  if (!data || typeof data !== 'object') return data;
  
  const sanitized = Array.isArray(data) ? [...data] : { ...data };
  
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    
    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  
  return sanitized;
}

class Logger {
  static info(message, meta = {}) {
    logger.info(message, sanitize(meta));
  }

  static error(message, meta = {}) {
    logger.error(message, sanitize(meta));
  }

  static warn(message, meta = {}) {
    logger.warn(message, sanitize(meta));
  }

  static debug(message, meta = {}) {
    logger.debug(message, sanitize(meta));
  }

  static http(message, meta = {}) {
    logger.http(message, sanitize(meta));
  }

  /**
   * Log HTTP request with sanitized data
   */
  static logRequest(req) {
    logger.http('HTTP Request', {
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      query: sanitize(req.query),
      body: sanitize(req.body),
    });
  }

  /**
   * Log HTTP response with performance metrics
   */
  static logResponse(req, res, responseTime) {
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    
    logger[level]('HTTP Response', {
      requestId: req.requestId || req.id,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('content-length'),
    });
  }

  /**
   * Log database query with performance tracking
   */
  static logQuery(operation, collection, query = {}, duration = null) {
    logger.debug('Database Query', {
      operation,
      collection,
      query: sanitize(query),
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  /**
   * Log error with full context and sanitized request data
   */
  static logError(error, req = null) {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      errorType: error.name || 'Error',
      isOperational: error.isOperational,
    };

    if (req) {
      errorLog.request = {
        requestId: req.requestId || req.id,
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        body: sanitize(req.body),
        params: req.params,
        query: sanitize(req.query),
      };
    }

    logger.error('Application Error', errorLog);
  }

  /**
   * Log authentication events
   */
  static logAuth(event, userId, meta = {}) {
    logger.info(`Auth: ${event}`, {
      userId,
      event,
      ...sanitize(meta),
    });
  }

  /**
   * Log security events
   */
  static logSecurity(event, meta = {}) {
    logger.warn(`Security: ${event}`, sanitize(meta));
  }

  /**
   * Log performance metrics
   */
  static logPerformance(operation, duration, meta = {}) {
    const level = duration > 1000 ? 'warn' : 'debug';
    
    logger[level](`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...sanitize(meta),
    });
  }

  /**
   * Start performance timer
   */
  static startTimer(label) {
    const start = Date.now();
    return {
      end: (meta = {}) => {
        const duration = Date.now() - start;
        this.logPerformance(label, duration, meta);
        return duration;
      }
    };
  }

  /**
   * Log business events
   */
  static logEvent(event, meta = {}) {
    logger.info(`Event: ${event}`, sanitize(meta));
  }
}

export default Logger;
