import expressWinston from 'express-winston';
import { logger } from '../config/logger.js';

const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true,
  msg: "HTTP {{req.method}} {{req.url}} {{res.statusCode}} {{res.responseTime}}ms",
  expressFormat: false,
  colorize: false,
  ignoreRoute: (req) => req.url.startsWith('/health'),
  dynamicMeta: (req, res) => {
    return {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      responseTime: res.responseTime,
    };
  },
  requestWhitelist: ['url', 'method', 'httpVersion', 'originalUrl', 'query'],
  responseWhitelist: ['statusCode'],
  headerBlacklist: ['authorization', 'cookie'],
  skip: (req, res) => {
    // Skip successful health checks
    return req.url.startsWith('/health') && res.statusCode < 400;
  },
});

export default requestLogger;
