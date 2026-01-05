import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Logger from './logger.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import VitalTaskCollaborator from '../models/VitalTaskCollaborator.js';
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
        socket.userId = decoded.userId;
        
        // Fetch user details for richer real-time info
        const User = mongoose.model('User');
        const user = await User.findById(decoded.userId).select('firstName lastName email');
        
        socket.userEmail = user ? user.email : 'Unknown';
        socket.userName = user ? `${user.firstName} ${user.lastName}` : 'Anonymous';
        
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
          const { event, data, userId, taskId, room } = JSON.parse(message);
          if (userId) {
            this.io.to(`user:${userId}`).emit(event, data);
          } else if (taskId) {
            this.io.to(`chat:${taskId}`).emit(event, data);
          } else if (room) {
            this.io.to(room).emit(event, data);
          }
        } catch (e) {
          Logger.error('Relay message processing failed', { error: e.message, channel });
        }
      });

      await this.subClient.subscribe(`relay:${this.serverId}`);
      await this.subClient.subscribe('relay:global_chat');
      await this.subClient.subscribe('relay:global_user');
      
      Logger.info('Redis Relay initialized', { serverId: this.serverId });
    } catch (error) {
      Logger.error('Failed to initialize Redis Relay', { error: error.message });
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

    // Throttled Typing Indicator with Auto-expire (5s)
    socket.on('chat:typing', async (data) => {
      const { taskId } = data;
      if (!taskId) return;

      const lockKey = `typing:lock:${userId}:${taskId}`;
      const isLocked = await redisClient.get(lockKey);

      if (!isLocked) {
        // Broadcast typing and set 2s throttle lock
        socket.to(`chat:${taskId}`).emit('chat:typing', { userId, taskId });
        await redisClient.set(lockKey, 'true', 'EX', 2);

        // Track metric (typing is also a message-like event for load tracking)
        MetricsService.trackMessage();

        // Schedule auto-stop broadcast if user stops sending signals
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
      Logger.info('Notification marked as read', {
        userId,
        notificationId,
      });
    });

    // Handle mark all as read
    socket.on('notifications:read-all', () => {
      Logger.info('All notifications marked as read', { userId });
    });

    // Handle Chat Events
    this.handleChatEvents(socket);

    // Handle Presence Heartbeat
    socket.on('presence:heartbeat', () => {
      this._updatePresence(userId, 'online');
    });
  }

  /**
   * Update User Presence in Redis
   */
  async _updatePresence(userId, status) {
    try {
      const key = `presence:${userId}`;
      if (status === 'online') {
        await redisClient.set(key, JSON.stringify({
          status: 'online',
          serverId: this.serverId,
          lastSeen: new Date()
        }), 'EX', 120); // 2 min expiry
      } else {
        await redisClient.set(key, JSON.stringify({
          status: 'offline',
          lastSeen: new Date()
        }), 'EX', 86400 * 7); // Keep for 7 days
      }
    } catch (e) {
      Logger.error('Presence update failed', { userId, error: e.message });
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

    // Leave a specific task chat room
    socket.on('chat:leave', (taskId) => {
      socket.leave(`chat:${taskId}`);
      Logger.info('User left chat room', { userId, taskId });
    });

    // Handle typing indicators
    socket.on('chat:typing', (taskId) => {
      socket.to(`chat:${taskId}`).emit('chat:typing', { 
        userId, 
        taskId,
        userName: socket.userName
      });
    });

    socket.on('chat:stop_typing', (taskId) => {
      socket.to(`chat:${taskId}`).emit('chat:stop_typing', { userId, taskId });
    });

    // Handle message delivery acknowledgment from client
    socket.on('chat:delivered', async (data) => {
      try {
        const { messageId, taskId, isVital } = data;
        const chatService = (await import('../services/chatService.js')).default;
        await chatService.markAsDelivered(messageId, userId, taskId, isVital);
      } catch (error) {
        Logger.error('Error handling chat:delivered', { error: error.message, userId });
      }
    });

    // Explicit manual Presence update
    socket.on('chat:presence', (status) => {
      if (['online', 'away', 'dnd'].includes(status)) {
        this._updatePresence(userId, status);
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
      }
    }

    Logger.info('User disconnected from WebSocket', {
      userId,
      socketId: socket.id,
      remainingConnections: this.userSockets.get(userId)?.size || 0,
    });

    // Track metrics
    MetricsService.decrementSockets();
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

    // Relay to other servers via Redis
    this._relayToUser(userIdStr, event, data);

    return true;
  }

  /**
   * Relay event to user on other servers (Multi-Device Sync)
   */
  async _relayToUser(userId, event, data) {
    try {
      // Broadcast to a global user channel so all instances where the user is connected receive it
      redisClient.publish('relay:global_user', JSON.stringify({
        userId, event, data
      }));
    } catch (e) {
      Logger.error('User relay failed', { error: e.message, userId });
    }
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
   * Send event to a specific task chat room
   */
  sendToChatRoom(taskId, event, data) {
    if (!this.io) return false;
    this.io.to(`chat:${taskId}`).emit(event, data);
    
    // Broadcast to all servers via global relay channel
    redisClient.publish('relay:global_chat', JSON.stringify({
      event, data, taskId
    }));

    return true;
  }

  /**
   * Atomic Socket Tracking: Add socket ID to Redis Set + Per-socket TTL
   */
  async _addSocketToPresence(userId, socketId) {
    try {
      const socketSetKey = `presence:sockets:user:${userId}`;
      const socketTtlKey = `presence:socket:${socketId}`;

      await Promise.all([
        redisClient.sadd(socketSetKey, socketId),
        redisClient.set(socketTtlKey, userId, 'EX', 60) // Heartbeat expected every 30s
      ]);
      
      await redisClient.expire(socketSetKey, 86400); // 24h safety expiry
      await this._updatePresence(userId, 'online');
    } catch (e) {
      Logger.error('Add socket to presence failed', { userId, error: e.message });
    }
  }

  /**
   * Atomic Socket Tracking: Remove socket ID from Redis Set
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
   * Update User Presence across multiple server instances via Redis
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

      // TTL slightly longer than heartbeat interval (60s for true "ghost" detection)
      await redisClient.expire(presenceKey, 60);

      // Broadcast Presence change to active chats
      this._broadcastPresenceUpdate(userId, status, now);
      
      Logger.debug('User presence updated', { userId, status });
    } catch (error) {
      Logger.error('Presence update failed', { error: error.message, userId });
    }
  }

  /**
   * Update heartbeat specifically to keep presence alive (Per-socket & Per-user)
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
   * Broadcast presence to rooms where user is active
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

       // Also global sync for the user
       this.sendToUser(userId, 'chat:presence_sync', { status, lastSeen });
    } catch (e) {
      Logger.error('Broadcast presence update failed', { error: e.message });
    }
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
   * Check if user is online (Cluster-Safe + Ghost Cleanup Awareness)
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

    // Filter sockets that have valid TTL keys (Ghost cleanup check)
    const ttlChecks = await Promise.all(
        socketIds.map(sid => redisClient.exists(`presence:socket:${sid}`))
    );

    const activeSocketCount = ttlChecks.filter(exists => exists === 1).length;
    
    // If we found ghost sockets in the set, cleanup background
    if (activeSocketCount !== socketIds.length) {
        this._cleanupGhostSockets(userId, socketIds, ttlChecks);
    }

    return activeSocketCount > 0;
  }

  /**
   * Background cleanup of ghost sockets from the set
   */
  async _cleanupGhostSockets(userId, socketIds, ttlResults) {
      const socketSetKey = `presence:sockets:user:${userId}`;
      const ghosts = socketIds.filter((_, index) => ttlResults[index] === 0);
      if (ghosts.length > 0) {
          await redisClient.srem(socketSetKey, ...ghosts);
          Logger.debug('Cleaned up ghost sockets', { userId, count: ghosts.length });
      }
  }

  /**
   * Get user's active connections count
   */
  getUserConnectionsCount(userId) {
    return this.userSockets.get(userId.toString())?.size || 0;
  }

  /**
   * Handle auto-joining rooms and syncing missed data on connect
   */
  async _handleAutoReconnectPresence(socket, userId) {
    try {
      // 1. Fetch all tasks the user is part of
      const chatService = (await import('../services/chatService.js')).default;
      const standardTasks = await TaskCollaborator.find({ collaborator: userId, status: 'active' }).select('task');
      const vitalTasks = await VitalTaskCollaborator.find({ collaborator: userId, status: 'active' }).select('vitalTask');
      const ownedTasks = await Task.find({ user: userId }).select('_id');
      const ownedVitalTasks = await VitalTask.find({ user: userId }).select('_id');

      const allTaskIds = [
        ...standardTasks.map(t => t.task),
        ...ownedTasks.map(t => t._id)
      ];
      const allVitalTaskIds = [
        ...vitalTasks.map(t => t.vitalTask),
        ...ownedVitalTasks.map(t => t._id)
      ];

      // Auto-join rooms
      allTaskIds.forEach(id => socket.join(`chat:${id}`));
      allVitalTaskIds.forEach(id => socket.join(`chat:${id}`));

      Logger.debug('User auto-joined chat rooms', { userId, roomCount: allTaskIds.length + allVitalTaskIds.length });

      // 2. Performance: Push a sync check if user was recently offline
      // We'll let the frontend request it via the 'sync' route, 
      // but we can also broadcast a 'chat:sync_needed' hint here.
      socket.emit('chat:sync_needed', { timestamp: new Date() });

    } catch (error) {
       Logger.error('Auto-reconnect presence failed', { error: error.message });
    }
  }
}

export default new WebSocketService();
