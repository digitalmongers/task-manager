import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { combine, timestamp, errors, printf, colorize, json, metadata } = winston.format;

// Custom format for development with colors and stack traces
const devLogFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}] : ${stack || message}`;
  
  // Add metadata if present
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

// Combined logs - all levels
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/%DATE%-combined.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: prodLogFormat,
});

// Error logs - separate file with longer retention
const errorRotateFile = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/%DATE%-error.log'),
  level: 'error',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '30d',
  format: prodLogFormat,
});

// HTTP logs - separate file for API requests
const httpRotateFile = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/%DATE%-http.log'),
  level: 'http',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '7d',
  format: prodLogFormat,
});

// Debug logs - only in development
const debugRotateFile = new DailyRotateFile({
  filename: path.join(__dirname, '../logs/%DATE%-debug.log'),
  level: 'debug',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '3d',
  format: prodLogFormat,
});

// Create transports array based on environment
const transports = [
  dailyRotateFileTransport,
  errorRotateFile,
  httpRotateFile,
];

// Add debug logs only in development
if (process.env.NODE_ENV !== 'production') {
  transports.push(debugRotateFile);
}

// Console transport with appropriate format
const consoleTransport = new winston.transports.Console({
  handleExceptions: true,
  handleRejections: true,
  format: process.env.NODE_ENV === 'production' ? prodLogFormat : developmentFormat,
});

transports.push(consoleTransport);

// Create the logger
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

// Exception handlers
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(__dirname, '../logs/%DATE%-exceptions.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: prodLogFormat,
  })
);

// Rejection handlers
logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(__dirname, '../logs/%DATE%-rejections.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: prodLogFormat,
  })
);

// Catch unhandled errors globally
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION - Application will terminate', {
    error: err.message,
    stack: err.stack,
    type: 'uncaughtException',
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED REJECTION - Application will terminate', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
    type: 'unhandledRejection',
  });
  process.exit(1);
});

export default logger;
