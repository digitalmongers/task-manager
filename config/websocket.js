import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Logger from './logger.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socket IDs
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL?.split(',').map(url => url.trim()) || ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userEmail = decoded.email;
        
        Logger.info('WebSocket authentication successful', {
          userId: socket.userId,
          socketId: socket.id,
        });
        
        next();
      } catch (error) {
        Logger.error('WebSocket authentication failed', {
          error: error.message,
          socketId: socket.id,
        });
        next(new Error('Authentication error: Invalid token'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    Logger.info('WebSocket server initialized successfully');
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    const userId = socket.userId;

    // Add socket to user's socket set
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    Logger.info('User connected via WebSocket', {
      userId,
      socketId: socket.id,
      totalConnections: this.userSockets.get(userId).size,
    });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Send connection success
    socket.emit('connected', {
      message: 'Connected to notification server',
      userId,
      socketId: socket.id,
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Handle mark notification as read
    socket.on('notification:read', (notificationId) => {
      Logger.info('Notification marked as read', {
        userId,
        notificationId,
      });
    });

    // Handle mark all as read
    socket.on('notifications:read-all', () => {
      Logger.info('All notifications marked as read', { userId });
    });
  }

  /**
   * Handle socket disconnection
   */
  handleDisconnection(socket) {
    const userId = socket.userId;
    
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);
      
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }

    Logger.info('User disconnected from WebSocket', {
      userId,
      socketId: socket.id,
      remainingConnections: this.userSockets.get(userId)?.size || 0,
    });
  }

  /**
   * Send notification to specific user
   */
  sendToUser(userId, event, data) {
    if (!this.io) {
      Logger.warn('WebSocket not initialized');
      return false;
    }

    const userIdStr = userId.toString();
    this.io.to(`user:${userIdStr}`).emit(event, data);

    Logger.info('Notification sent to user', {
      userId: userIdStr,
      event,
      hasActiveConnections: this.userSockets.has(userIdStr),
    });

    return true;
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds, event, data) {
    if (!this.io) {
      Logger.warn('WebSocket not initialized');
      return false;
    }

    userIds.forEach(userId => {
      this.sendToUser(userId, event, data);
    });

    return true;
  }

  /**
   * Send notification to team members
   */
  sendToTeam(teamMemberIds, event, data, excludeUserId = null) {
    if (!this.io) {
      Logger.warn('WebSocket not initialized');
      return false;
    }

    const recipients = excludeUserId 
      ? teamMemberIds.filter(id => id.toString() !== excludeUserId.toString())
      : teamMemberIds;

    recipients.forEach(userId => {
      this.sendToUser(userId, event, data);
    });

    Logger.info('Notification sent to team', {
      teamSize: recipients.length,
      event,
    });

    return true;
  }

  /**
   * Broadcast to all connected users
   */
  broadcast(event, data) {
    if (!this.io) {
      Logger.warn('WebSocket not initialized');
      return false;
    }

    this.io.emit(event, data);
    
    Logger.info('Broadcast notification sent', {
      event,
      totalUsers: this.userSockets.size,
    });

    return true;
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId) {
    return this.userSockets.has(userId.toString());
  }

  /**
   * Get user's active connections count
   */
  getUserConnectionsCount(userId) {
    return this.userSockets.get(userId.toString())?.size || 0;
  }
}

export default new WebSocketService();
