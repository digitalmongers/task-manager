import "dotenv/config";
import express from "express";
import cors from "cors";
import compression from "compression";
import responseTime from "response-time";
import cookieParser from "cookie-parser";
import passport from './config/passport.js';
import { connectDB } from "./config/db.js";
import redisClient from "./config/redis.js";
import cacheService from "./services/cacheService.js";
import Logger from "./config/logger.js";
import ApiResponse from "./utils/ApiResponse.js";
import { applySecurity, corsOptions } from "./middlewares/security.js";
import requestLogger from "./middlewares/requestLogger.js";
import requestId from "./middlewares/requestId.js";
import safeLogger from "./middlewares/safeLogger.js";
import errorHandler from "./middlewares/errorHandler.js";
import notFound from "./middlewares/notFound.js";
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/authRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import categoryRoutes from "./routes/categoryRoutes.js";
import taskStatusRoutes from "./routes/taskStatusRoutes.js";
import taskPriorityRoutes from "./routes/taskPriorityRoutes.js";


const app = express();

app.set('trust proxy', 1);

app.use(requestId);

app.use(responseTime((req, res, time) => {
  Logger.logResponse(req, res, time.toFixed(2));
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply CORS first - this handles all preflight requests
app.use(cors(corsOptions));

app.use(passport.initialize());

// Apply other security measures
applySecurity(app);

app.use(compression());

app.use(requestLogger);

app.get("/health", async (req, res) => {
  try {
    const redisStatus = redisClient.status === 'ready' ? 'connected' : redisClient.status;
    const cacheStats = redisStatus === 'connected' ? await cacheService.getStats() : null;

    ApiResponse.success(res, 200, "Server is healthy", {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      redis: {
        status: redisStatus,
        dbSize: cacheStats?.dbSize || 0,
      },
      oauth: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        facebook: !!process.env.FACEBOOK_APP_ID,
      },
    });
  } catch (error) {
    ApiResponse.success(res, 200, "Server is healthy (Redis unavailable)", {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      redis: {
        status: 'error',
        error: error.message,
      },
      oauth: {
        google: !!process.env.GOOGLE_CLIENT_ID,
        facebook: !!process.env.FACEBOOK_APP_ID,
      },
    });
  }
});
app.get("/", (req, res) => {
  ApiResponse.success(res, 200, "Task Manager API is running", {
    version: "1.0.0",
  });
});

// Application routes
app.use('/api/v1/upload', uploadRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/contact",contactRoutes)
app.use("/api/suggestion", suggestionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/taskStatus", taskStatusRoutes);
app.use("/api/taskPriority", taskPriorityRoutes);

// 404 handler (must be after all routes)
app.use(notFound);

// Error logging middleware (must be before error handler)
app.use(safeLogger);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      Logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      Logger.info(`Health check: http://localhost:${PORT}/health`);
      Logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
      Logger.info(`Redis Status: ${redisClient.status}`);
      Logger.info(`Cache Prefix: ${cacheService.prefix}`);
      Logger.info(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Enabled' : 'Disabled'}`);
      Logger.info(`Facebook OAuth: ${process.env.FACEBOOK_APP_ID ? 'Enabled' : 'Disabled'}`);
    });
  } catch (error) {
    Logger.error('Failed to start server:', { error: error.message });
    process.exit(1);
  }
};

startServer();

process.on('unhandledRejection', (err) => {
  Logger.error('Unhandled Promise Rejection:', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});