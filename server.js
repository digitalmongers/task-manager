import "dotenv/config";
import express from "express";
import compression from "compression";
import responseTime from "response-time";
import { connectDB } from "./config/db.js";
import Logger from "./config/logger.js";
import ApiResponse from "./utils/ApiResponse.js";
import { applySecurity } from "./middleware/security.js";
import requestLogger from "./middleware/requestLogger.js";
import requestId from "./middleware/requestId.js";
import safeLogger from "./middleware/safeLogger.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";

// Load environment variables
// dotenv.config(); // Loaded at the top


const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Request ID middleware (must be early in the chain)
app.use(requestId);

// Response time tracking
app.use(responseTime((req, res, time) => {
  Logger.logResponse(req, res, time.toFixed(2));
}));
  

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

applySecurity(app);
 
// Compression middleware
app.use(compression());
 
// HTTP request logging (express-winston)
app.use(requestLogger);

// Safe error logging middleware (logs errors with sanitized data)
app.use(safeLogger);

// Health check endpoint
app.get("/health", (req, res) => {
  ApiResponse.success(res, 200, "Server is healthy", {
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Health check
 *     description: Check if the server is running
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */

// Swagger API Documentation
import { swaggerSpec, swaggerUi } from './config/swagger.js';

const swaggerOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Task Manager API Documentation',
  customfavIcon: '/favicon.ico',
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerOptions));

// Swagger JSON endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});



// API routes
app.get("/", (req, res) => {
  ApiResponse.success(res, 200, "Task Manager API is running", {
    version: "1.0.0",
    documentation: "/api-docs",
  });
});

/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - Health
 *     summary: API root
 *     description: Get API information
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */



// Import routes here when created
import uploadRoutes from './routes/upload.routes.js';
app.use('/api/v1/upload', uploadRoutes);
// app.use('/api/v1/tasks', taskRoutes);
// app.use('/api/v1/users', userRoutes);



// 404 handler (must be after all routes)
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start listening
    app.listen(PORT, () => {
      Logger.info(` Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
      Logger.info(` Health check: http://localhost:${PORT}/health`);
      Logger.info(` API Docs: http://localhost:${PORT}/api-docs`);
      Logger.info(` Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`); 
    });
  } catch (error) {
    Logger.error('Failed to start server:', { error: error.message });
    process.exit(1);
  }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  Logger.error('Unhandled Promise Rejection:', { error: err.message, stack: err.stack });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  Logger.error('Uncaught Exception:', { error: err.message, stack: err.stack });
  process.exit(1);
});

