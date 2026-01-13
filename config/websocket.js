import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Logger from './logger.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
import Task from '../models/Task.js';
import VitalTask from '../models/VitalTask.js';
import redisClient from './redis.js';
import { v4 as uuidv4 } from 'uuid';
import MetricsService from '../services/metricsService.js';

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // userId -> Set of socket IDs
    this.serverId = `server:${uuidv4()}`;
    this.subClient = null;
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    const rawOrigins = process.env.FRONTEND_URL?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
    const allowedOrigins = [];
    rawOrigins.forEach(url => {
      const trimmed = url.trim();
      if (trimmed) {
        allowedOrigins.push(trimmed);
        allowedOrigins.push(trimmed.replace(/\/$/, ''));
      }
    });

    this.io = new Server(server, {
      cors: {
        origin: [...new Set(allowedOrigins)],
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
        socket.userId = decoded.userId.toString();
        
        // Fetch user details for richer real-time info
        const User = mongoose.model('User');
        const user = await User.findById(decoded.userId).select('firstName lastName email');
        
        socket.userEmail = user ? user.email : 'Unknown';
        socket.userName = user ? `${user.firstName} ${user.lastName}` : 'Anonymous';
        
        Logger.info('WebSocket authorized', {
          userId: socket.userId,
          socketId: socket.id,
          origin: socket.handshake.headers.origin
        });
        
        next();
      } catch (error) {
        Logger.error('WebSocket auth failed', {
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

    // Initialize Redis Subscription for cross-server relay
    this._initializeRedisRelay();

    Logger.info('WebSocket server initialized successfully', { serverId: this.serverId });
  }

  /**
   * Internal Redis Relay initialization
   */
  async _initializeRedisRelay() {
    try {
      this.subClient = redisClient.duplicate();
      
      this.subClient.on('message', (channel, message) => {
        try {
          const parsedMessage = JSON.parse(message);
          const { event, data, userId, taskId, room, serverId } = parsedMessage;

          // Ignore messages originating from this server instance to prevent duplication
          if (serverId === this.serverId) {
            return;
          }

          if (userId) {
            this.io.to(`user:${userId}`).emit(event, data);
          } else if (taskId) {
            this.io.to(`chat:${taskId}`).emit(event, data);
          } else if (room) {
            this.io.to(room).emit(event, data);
          }
          
          Logger.debug('Cross-server relay processed', { channel, event, userId });
        } catch (e) {
          Logger.error('Relay message processing failed', { error: e.message, channel });
        }
      });

      // Subscribe to global relay channels
      await Promise.all([
        this.subClient.subscribe('relay:global_user'),
        this.subClient.subscribe('relay:global_chat'),
        this.subClient.subscribe('relay:global_room')
      ]);

      Logger.info('Redis Relay initialized', { serverId: this.serverId });
    } catch (error) {
      Logger.error('Redis Relay initialization failed', { error: error.message });
    }
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

    // Update Presence in Redis (Atomic Socket Tracking with TTL for Ghost Cleanup)
    this._addSocketToPresence(userId, socket.id);

    // Send connection success
    socket.emit('connected', {
      message: 'Connected to notification server',
      userId,
      socketId: socket.id,
    });

    // AUTO-JOIN & AUTO-SYNC (Enterprise Standard)
    this._handleAutoReconnectPresence(socket, userId);

    // Track metrics
    MetricsService.incrementSockets();

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Heartbeat logic (Enterprise Standard)
    socket.on('chat:heartbeat', (data) => {
      this._updateHeartbeat(userId, socket.id);
      if (data?.isIdle) {
        this._updatePresence(userId, 'away');
        // Auto-stop typing if idle
        this.io.to(`user:${userId}`).emit('chat:stop_typing_all', { userId });
        socket.to(Array.from(socket.rooms).filter(r => r.startsWith('chat:'))).emit('chat:stop_typing', { userId });
      } else {
        this._updatePresence(userId, 'online');
      }
    });

    // Presence Heartbeat
    socket.on('presence:heartbeat', () => {
      this._updatePresence(userId, 'online');
    });

    // Handle Throttled Typing Indicator
    socket.on('chat:typing', async (data) => {
      const { taskId } = data;
      if (!taskId) return;

      const lockKey = `typing:lock:${userId}:${taskId}`;
      const isLocked = await redisClient.get(lockKey);

      if (!isLocked) {
        // Broadcast typing and set 2s throttle lock
        socket.to(`chat:${taskId}`).emit('chat:typing', { userId, taskId, userName: socket.userName });
        await redisClient.set(lockKey, 'true', 'EX', 2);
        MetricsService.trackMessage();

        if (socket.typingTimeout) clearTimeout(socket.typingTimeout);
        socket.typingTimeout = setTimeout(() => {
          socket.to(`chat:${taskId}`).emit('chat:stop_typing', { userId, taskId });
        }, 5000);
      }
    });

    socket.on('chat:stop_typing', (data) => {
      const { taskId } = data;
      if (!taskId) return;
      if (socket.typingTimeout) clearTimeout(socket.typingTimeout);
      socket.to(`chat:${taskId}`).emit('chat:stop_typing', { userId, taskId });
    });

    // Handle mark notification as read
    socket.on('notification:read', (notificationId) => {
      Logger.debug('Notification read event from client', { userId, notificationId });
    });

    // Handle Global Status Change
    socket.on('presence:status', (status) => {
      if (['online', 'away', 'dnd'].includes(status)) {
        this._updatePresence(userId, status);
      }
    });

    // Handle Chat Events
    this.handleChatEvents(socket);
  }

  /**
   * Update User Presence in Redis (Unified Hash Format)
   */
  async _updatePresence(userId, status) {
    try {
      const presenceKey = `presence:user:${userId}`;
      const now = new Date().toISOString();

      // Store in Redis with TTL (Presence expires if no heartbeat)
      await redisClient.hset(presenceKey, {
        status,
        lastSeen: now,
        serverId: this.serverId,
        lastHeartbeat: now
      });

      // TTL slightly longer than heartbeat interval (60s)
      await redisClient.expire(presenceKey, 60);

      // Broadcast Presence change to active chats
      this._broadcastPresenceUpdate(userId, status, now);
      
      Logger.debug('User presence updated', { userId, status });
    } catch (error) {
      Logger.error('Presence update failed', { error: error.message, userId });
    }
  }

  /**
   * Handle Task Chat specific events
   */
  handleChatEvents(socket) {
    const userId = socket.userId;

    // Join a specific task chat room
    socket.on('chat:join', async (data) => {
      try {
        const { taskId, isVital } = typeof data === 'string' ? { taskId: data, isVital: false } : data;
        
        const access = isVital 
          ? await VitalTaskCollaborator.canUserAccessVitalTask(taskId, userId)
          : await TaskCollaborator.canUserAccessTask(taskId, userId);
          
        if (!access.canAccess) {
          return socket.emit('chat:error', { message: `Access denied to this ${isVital ? 'vital ' : ''}task chat` });
        }

        socket.join(`chat:${taskId}`);
        Logger.info('User joined chat room', { userId, taskId, isVital });
        socket.emit('chat:joined', { taskId, isVital });
      } catch (error) {
        socket.emit('chat:error', { message: 'Failed to join chat' });
      }
    });

    // Leave room
    socket.on('chat:leave', (taskId) => {
      socket.leave(`chat:${taskId}`);
      Logger.info('User left chat room', { userId, taskId });
    });

    // Handle message delivery acknowledgment
    socket.on('chat:delivered', async (data) => {
      try {
        const { messageId, taskId, isVital } = data;
        const chatService = (await import('../services/chatService.js')).default;
        await chatService.markAsDelivered(messageId, userId, taskId, isVital);
      } catch (error) {
        Logger.error('Error handling chat:delivered', { error: error.message, userId });
      }
    });
  }

  /**
   * Handle socket disconnection
   */
  async handleDisconnection(socket) {
    const userId = socket.userId;
    
    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);
      
      // Remove from Redis Socket Set
      await this._removeSocketFromPresence(userId, socket.id);

      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
        // Do not mark offline immediately if user has other connections on other servers
        // isUserOnline check will handle it.
      }
    }

    Logger.info('User disconnected from WebSocket', {
      userId,
      socketId: socket.id
    });

    MetricsService.decrementSockets();
  }

  /**
   * Send notification to specific user (and relay)
   */
  sendToUser(userId, event, data) {
    if (!this.io) {
      Logger.warn('WebSocket not initialized');
      return false;
    }

    const userIdStr = userId.toString();
    this.io.to(`user:${userIdStr}`).emit(event, data);

    // Relay to other servers via Redis
    this._relayToUser(userIdStr, event, data);

    return true;
  }

  /**
   * Relay event to user on other servers
   */
  async _relayToUser(userId, event, data) {
    try {
      redisClient.publish('relay:global_user', JSON.stringify({
        userId, event, data, serverId: this.serverId
      }));
    } catch (e) {
      Logger.error('User relay failed', { error: e.message, userId });
    }
  }

  /**
   * Send notification to multiple users
   */
  sendToUsers(userIds, event, data) {
    if (!this.io) return false;
    userIds.forEach(userId => this.sendToUser(userId, event, data));
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
   * Get user's active connections count
   */
  getUserConnectionsCount(userId) {
    return this.userSockets.get(userId.toString())?.size || 0;
  }

  /**
   * Send event to a specific task chat room
   */
  sendToChatRoom(taskId, event, data) {
    if (!this.io) return false;
    this.io.to(`chat:${taskId}`).emit(event, data);
    
    redisClient.publish('relay:global_chat', JSON.stringify({
      event, data, taskId, serverId: this.serverId
    }));

    return true;
  }

  /**
   * Presence Helpers: Add Socket
   */
  async _addSocketToPresence(userId, socketId) {
    try {
      const socketSetKey = `presence:sockets:user:${userId}`;
      const socketTtlKey = `presence:socket:${socketId}`;

      await Promise.all([
        redisClient.sadd(socketSetKey, socketId),
        redisClient.set(socketTtlKey, userId, 'EX', 60)
      ]);
      
      await redisClient.expire(socketSetKey, 86400); 
      await this._updatePresence(userId, 'online');
    } catch (e) {
      Logger.error('Add socket to presence failed', { userId, error: e.message });
    }
  }

  /**
   * Presence Helpers: Remove Socket
   */
  async _removeSocketFromPresence(userId, socketId) {
    try {
      const socketSetKey = `presence:sockets:user:${userId}`;
      const socketTtlKey = `presence:socket:${socketId}`;

      await Promise.all([
        redisClient.srem(socketSetKey, socketId),
        redisClient.del(socketTtlKey)
      ]);
      
      const count = await redisClient.scard(socketSetKey);
      if (count === 0) {
        await this._updatePresence(userId, 'offline');
      }
    } catch (e) {
      Logger.error('Remove socket from presence failed', { userId, error: e.message });
    }
  }

  /**
   * Heartbeat logic
   */
  async _updateHeartbeat(userId, socketId) {
    const presenceKey = `presence:user:${userId}`;
    const socketTtlKey = `presence:socket:${socketId}`;
    
    await Promise.all([
        redisClient.expire(presenceKey, 60),
        redisClient.set(socketTtlKey, userId, 'EX', 60)
    ]);
  }

  /**
   * Broadcast presence to active rooms
   */
  async _broadcastPresenceUpdate(userId, status, lastSeen) {
    try {
       const userSockets = this.userSockets.get(userId.toString());
       if (!userSockets) return;

       const activeRooms = new Set();
       userSockets.forEach(sid => {
         const socket = this.io.sockets.sockets.get(sid);
         if (socket) {
           socket.rooms.forEach(room => {
             if (room.startsWith('chat:')) activeRooms.add(room);
           });
         }
       });

       activeRooms.forEach(room => {
         const taskId = room.split(':')[1];
         this.io.to(room).emit('chat:presence_update', { userId, status, lastSeen, taskId });
       });

       this.io.to(`user:${userId}`).emit('chat:presence_sync', { status, lastSeen });
    } catch (e) {
      Logger.error('Broadcast presence update failed', { error: e.message });
    }
  }

  /**
   * Check if user is online
   */
  async isUserOnline(userId) {
    const presenceKey = `presence:user:${userId}`;
    const socketSetKey = `presence:sockets:user:${userId}`;
    
    const [presence, socketIds] = await Promise.all([
      redisClient.hgetall(presenceKey),
      redisClient.smembers(socketSetKey)
    ]);

    if (!presence || presence.status !== 'online' || socketIds.length === 0) {
      return false;
    }

    const ttlChecks = await Promise.all(
        socketIds.map(sid => redisClient.exists(`presence:socket:${sid}`))
    );

    const activeSocketCount = ttlChecks.filter(exists => exists === 1).length;
    
    if (activeSocketCount !== socketIds.length) {
        this._cleanupGhostSockets(userId, socketIds, ttlChecks);
    }

    return activeSocketCount > 0;
  }

  async _cleanupGhostSockets(userId, socketIds, ttlResults) {
      const socketSetKey = `presence:sockets:user:${userId}`;
      const ghosts = socketIds.filter((_, index) => ttlResults[index] === 0);
      if (ghosts.length > 0) {
          await redisClient.srem(socketSetKey, ...ghosts);
      }
  }

  /**
   * Auto-joining logic
   */
  async _handleAutoReconnectPresence(socket, userId) {
    try {
      const standardTasks = await TaskCollaborator.find({ collaborator: userId, status: 'active' }).select('task');
      const vitalTasks = await VitalTaskCollaborator.find({ collaborator: userId, status: 'active' }).select('vitalTask');
      const ownedTasks = await Task.find({ user: userId }).select('_id');
      const ownedVitalTasks = await VitalTask.find({ user: userId }).select('_id');

      const allTaskIds = [...standardTasks.map(t => t.task), ...ownedTasks.map(t => t._id)];
      const allVitalTaskIds = [...vitalTasks.map(t => t.vitalTask), ...ownedVitalTasks.map(t => t._id)];

      allTaskIds.forEach(id => socket.join(`chat:${id}`));
      allVitalTaskIds.forEach(id => socket.join(`chat:${id}`));

      socket.emit('chat:sync_needed', { timestamp: new Date() });
    } catch (error) {
       Logger.error('Auto-reconnect presence failed', { error: error.message });
    }
  }
}

export default new WebSocketService();
