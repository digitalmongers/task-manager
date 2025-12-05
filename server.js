import "dotenv/config";
import express from "express";
import compression from "compression";
import responseTime from "response-time";
import { connectDB } from "./config/db.js";
import Logger from "./config/logger.js";
import ApiResponse from "./utils/ApiResponse.js";
import { applySecurity } from "./middlewares/security.js";
import requestLogger from "./middlewares/requestLogger.js";
import requestId from "./middlewares/requestId.js";
import safeLogger from "./middlewares/safeLogger.js";
import errorHandler from "./middlewares/errorHandler.js";
import notFound from "./middlewares/notFound.js";
import uploadRoutes from './routes/upload.routes.js';
import authRoutes from './routes/authRoutes.js';

const app = express();

app.set('trust proxy', 1);

app.use(requestId);

app.use(responseTime((req, res, time) => {
  Logger.logResponse(req, res, time.toFixed(2));
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

applySecurity(app);

app.use(compression());

app.use(requestLogger);

app.get("/health", (req, res) => {
  ApiResponse.success(res, 200, "Server is healthy", {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get("/", (req, res) => {
  ApiResponse.success(res, 200, "Task Manager API is running", {
    version: "1.0.0",
  });
});

// Application routes
app.use('/api/v1/upload', uploadRoutes);
app.use("/api/auth", authRoutes);

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
