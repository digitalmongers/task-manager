import "dotenv/config";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import compression from "compression";
import responseTime from "response-time";
import cookieParser from "cookie-parser";
import passport from './config/passport.js';
import { connectDB } from "./config/db.js";
import redisClient from "./config/redis.js";
import cacheService from "./services/cacheService.js";
import WebSocketService from "./config/websocket.js";
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
import twofaRoutes from './routes/twofaRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import suggestionRoutes from './routes/suggestionRoutes.js';
import categoryRoutes from "./routes/categoryRoutes.js";
import taskStatusRoutes from "./routes/taskStatusRoutes.js";
import taskPriorityRoutes from "./routes/taskPriorityRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import vitalTaskRoutes from "./routes/vitalTaskRoutes.js";
import teamRoutes from "./routes/teamRoutes.js";
import collaborationRoutes from "./routes/collaborationRoutes.js";
import vitalTaskCollaborationRoutes from "./routes/vitalTaskCollaborationRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import insightsRoutes from "./routes/insightsRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import systemRoutes from "./routes/systemRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import topupRoutes from "./routes/topupRoutes.js";
import newsletterRoutes from "./routes/newsletterRoutes.js";
import { testConnection as testOpenAI } from './config/openai.js';
import './config/webPush.js'; // Initialize web-push with VAPID


const app = express();
const httpServer = createServer(app);

// Initialize WebSocket server
WebSocketService.initialize(httpServer);

app.set('trust proxy', 1);

app.use(requestId);

app.use(responseTime((req, res, time) => {
  Logger.logResponse(req, res, time.toFixed(2));
}));

app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/payments/webhook')) {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Apply CORS first - this handles all preflight requests
app.use(cors(corsOptions));

// Serve static files
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/public', express.static(path.join(__dirname, 'public')));

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
      ai: {
        enabled: !!process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
      ai: {
        enabled: !!process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
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
app.use("/api/auth/2fa", twofaRoutes);
app.use("/api/contact",contactRoutes)
app.use("/api/suggestion", suggestionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/taskStatus", taskStatusRoutes);
app.use("/api/taskPriority", taskPriorityRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/vital-tasks", vitalTaskRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/collaboration", collaborationRoutes);
app.use("/api/vital-task-collaboration", vitalTaskCollaborationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/insights", insightsRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/topups", topupRoutes);
app.use("/api/newsletter", newsletterRoutes);

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

    // Test OpenAI connection
    await testOpenAI();

    // Initialize Cron Jobs
    const CronService = (await import('./services/cronService.js')).default;
    CronService.init();

    httpServer.listen(PORT, () => {
      Logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      Logger.info(`Health check: http://localhost:${PORT}/health`);
      Logger.info(`Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
      Logger.info(`Redis Status: ${redisClient.status}`);
      Logger.info(`Cache Prefix: ${cacheService.prefix}`);
      Logger.info(`WebSocket: Enabled`);
      Logger.info(`Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? 'Enabled' : 'Disabled'}`);
      Logger.info(`Facebook OAuth: ${process.env.FACEBOOK_APP_ID ? 'Enabled' : 'Disabled'}`);
      Logger.info(`OpenAI: ${process.env.OPENAI_API_KEY ? 'Enabled' : 'Disabled'}`);
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