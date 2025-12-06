import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { RATE_LIMIT } from '../config/constants.js';
import Logger from '../config/logger.js';

const getAllowedOrigins = () => {
  const origins = [];
  
  if (process.env.FRONTEND_URL) {
    // Split by comma and clean each URL properly
    process.env.FRONTEND_URL.split(',').forEach(url => {
      const trimmed = url.trim();
      if (trimmed) {  // Only add non-empty URLs
        origins.push(trimmed);
        // Also add version without trailing slash
        origins.push(trimmed.replace(/\/$/, ''));
      }
    });
  }
  
  // Add development URLs only in non-production
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:5173');
    origins.push('http://127.0.0.1:3000');
    origins.push('http://127.0.0.1:5173');
  }
  
  // Remove duplicates and filter out any empty strings
  return [...new Set(origins.filter(Boolean))];
};

export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    Logger.debug('CORS Check:', { 
      origin, 
      allowedOrigins,
      env: process.env.NODE_ENV 
    });
    
    // Allow requests with no origin (Postman, mobile apps, curl, server-to-server)
    if (!origin) {
      Logger.debug('CORS: No origin header, allowing request');
      return callback(null, true);
    }
    
    // Normalize origin - remove trailing slash and convert to lowercase
    const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      const normalizedAllowed = allowedOrigin.replace(/\/$/, '').toLowerCase();
      return normalizedOrigin === normalizedAllowed;
    });
    
    if (isAllowed) {
      Logger.debug('✓ CORS Allowed:', { origin: normalizedOrigin });
      callback(null, true);
    } else {
      Logger.error('✗ CORS Blocked:', { 
        origin: normalizedOrigin, 
        allowedOrigins,
        environment: process.env.NODE_ENV 
      });
      
      // In production, be strict about CORS
      if (process.env.NODE_ENV === 'production') {
        callback(new Error('Not allowed by CORS'));
      } else {
        // In development, log warning but allow (for easier testing)
        Logger.warn('⚠️ Development mode: Allowing blocked origin');
        callback(null, true);
      }
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'X-Request-ID',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['X-Request-ID', 'Set-Cookie'],
  maxAge: 86400, // 24 hours - cache preflight requests
  preflightContinue: false,
};

export const limiter = rateLimit({
  windowMs: RATE_LIMIT.WINDOW_MS,
  max: RATE_LIMIT.MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.path === '/api-docs',
});

export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per window
  delayMs: (hits) => hits * 100, // Add 100ms delay per request after limit
  skip: (req) => req.path === '/health' || req.path === '/api-docs',
});

export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], 
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

export const hppConfig = hpp({
  whitelist: ['sort', 'page', 'limit', 'fields'], 
});

export const applySecurity = (app) => {
  // Note: CORS is applied separately in server.js BEFORE this function
  app.use(helmetConfig);
  app.use(limiter);
  app.use(speedLimiter);
  app.use(hppConfig);
};