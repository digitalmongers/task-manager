/**
 * AI Rate Limiting Middleware
 * Limits AI API calls to prevent abuse and control costs
 */

import rateLimit from 'express-rate-limit';
import Logger from '../config/logger.js';

// AI-specific rate limiter (more restrictive than general API)
const aiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max:1000, // 1000 requests per hour per user (Increased from 100)
  message: {
    success: false,
    message: 'Too many AI requests. Please try again later.',
    retryAfter: '1 hour',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use user ID as key if authenticated
  keyGenerator: (req) => {
    return req.user ? req.user._id.toString() : req.ip;
  },
  // Log rate limit hits
  handler: (req, res) => {
    Logger.warn('AI rate limit exceeded', {
      userId: req.user?._id,
      ip: req.ip,
      path: req.path,
    });
    
    res.status(429).json({
      success: false,
      message: 'Too many AI requests. Please try again later.',
      retryAfter: '1 hour',
    });
  },
  // Skip rate limiting in development
  skip: (req) => {
    return process.env.NODE_ENV === 'development' && process.env.SKIP_AI_RATE_LIMIT === 'true';
  },
});

export default aiRateLimit;
