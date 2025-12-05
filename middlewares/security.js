import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { RATE_LIMIT } from '../config/constants.js';
import Logger from '../config/logger.js';

// Get allowed origins from environment
const getAllowedOrigins = () => {
  const origins = [];
  
  // Add frontend URL from environment
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // In development, also allow localhost variants
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:3001'); // backup port
    origins.push('http://127.0.0.1:3000');
  }
  
  Logger.info('Allowed CORS origins:', { origins });
  return origins;
};

export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    
    if (!origin) {
      Logger.debug('CORS: No origin header, allowing request');
      return callback(null, true);
    }
    
    // Normalize origin (remove trailing slashes)
    const normalizedOrigin = origin.replace(/\/$/, '');
    
    // Check if origin is allowed
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      return normalizedOrigin === allowedOrigin.replace(/\/$/, '');
    });
    
    if (isAllowed) {
      Logger.debug('CORS Allowed:', { origin: normalizedOrigin });
      callback(null, true);
    } else {
      Logger.warn('CORS Blocked:', { 
        origin: normalizedOrigin, 
        allowedOrigins,
        environment: process.env.NODE_ENV 
      });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
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
  delayAfter: 50,
  delayMs: (hits) => hits * 100,
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
  app.use(helmetConfig);
  app.use(cors(corsOptions));
  app.use(limiter);
  app.use(speedLimiter);
  app.use(hppConfig);
};