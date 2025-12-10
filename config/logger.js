import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, errors, printf, colorize, json, metadata } = winston.format;


const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] : ${stack || message}`;
  
  const metaKeys = Object.keys(meta).filter(key => key !== 'service');
  if (metaKeys.length > 0) {
    log += `\n${JSON.stringify(meta, null, 2)}`;
  }
  
  return log;
});

const prodLogFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  metadata({ fillExcept: ['message', 'level', 'timestamp', 'label'] }),
  json()
);

const developmentFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  colorize({ all: true }),
  devLogFormat
);


const transports = [];


if (process.env.NODE_ENV !== 'production' || process.env.PERSISTENT_LOGS === 'true') {
  transports.push(
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/%DATE%-combined.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: prodLogFormat,
    }),
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/%DATE%-error.log'),
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '30d',
      format: prodLogFormat,
    })
  );
}


transports.push(
  new winston.transports.Console({
    handleExceptions: true,
    handleRejections: true,
    format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
  })
);


const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
  defaultMeta: { 
    service: 'task-manager-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  exitOnError: false,
});


if (process.env.NODE_ENV !== 'production' || process.env.PERSISTENT_LOGS === 'true') {
  logger.exceptions.handle(
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/%DATE%-exceptions.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: prodLogFormat,
    })
  );

  logger.rejections.handle(
    new DailyRotateFile({
      filename: path.join(__dirname, '../logs/%DATE%-rejections.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      format: prodLogFormat,
    })
  );
}



const SENSITIVE_FIELDS = ['password', 'token', 'apiKey', 'secret', 'authorization', 'creditCard', 'ssn', 'pin'];


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

  
  static logQuery(operation, collection, query = {}, duration = null) {
    logger.debug('Database Query', {
      operation,
      collection,
      query: sanitize(query),
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  
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

  
  static logAuth(event, userId, meta = {}) {
    logger.info(`Auth: ${event}`, {
      userId,
      event,
      ...sanitize(meta),
    });
  }

  
  static logSecurity(event, meta = {}) {
    logger.warn(`Security: ${event}`, sanitize(meta));
  }

  
  static logPerformance(operation, duration, meta = {}) {
    const level = duration > 1000 ? 'warn' : 'debug';
    
    logger[level](`Performance: ${operation}`, {
      operation,
      duration: `${duration}ms`,
      ...sanitize(meta),
    });
  }
}

export { logger };
export default Logger; 