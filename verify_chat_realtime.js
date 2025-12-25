import "dotenv/config";
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import Task from './models/Task.js';
import ChatService from './services/chatService.js';
import WebSocketService from './config/websocket.js';
import { connectDB } from './config/db.js';

async function verify() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // 1. Create test users
    const user1 = await User.create({
      firstName: 'Sender',
      lastName: 'User',
      email: `sender_${Date.now()}@example.com`,
      password: 'Password123!',
      isEmailVerified: true,
      termsAccepted: true
    });
    
    const user2 = await User.create({
      firstName: 'Receiver',
      lastName: 'User',
      email: `receiver_${Date.now()}@example.com`,
      password: 'Password123!',
      isEmailVerified: true,
      termsAccepted: true
    });

    // 2. Create a task and add user2 as collaborator
    const task = await Task.create({
      title: 'Real-time Chat Test',
      user: user1._id,
      collaborators: [
        { collaborator: user2._id, role: 'editor', status: 'active' }
      ]
    });

    console.log(`Task created: ${task._id}`);

    // 3. Mock WebSocket Initialization (since we can't run a real server easily in this env)
    // We'll mock the 'io' object to see what gets emitted
    const emittedEvents = [];
    WebSocketService.io = {
      to: (room) => ({
        emit: (event, data) => {
          emittedEvents.push({ room, event, data });
          console.log(`[EMIT] Room: ${room}, Event: ${event}`);
        }
      })
    };

    // 4. Send a message via ChatService
    console.log('Sending message via ChatService...');
    await ChatService.sendMessage(task._id, user1._id, {
      content: 'Hello Real-time World!',
      messageType: 'text'
    }, false);

    // 5. Verify emitted events
    console.log('Verifying emitted events...');
    
    const chatMessageEvent = emittedEvents.find(e => e.event === 'chat:message');
    const alertEvent = emittedEvents.find(e => e.event === 'chat:new_message_alert');

    if (chatMessageEvent && chatMessageEvent.room === `chat:${task._id}`) {
      console.log('✅ SUCCESS: chat:message emitted to correct room');
    } else {
      console.log('❌ FAILED: chat:message not emitted correctly');
    }

    if (alertEvent && alertEvent.room === `user:${user2._id}`) {
      console.log('✅ SUCCESS: chat:new_message_alert emitted to receiver');
    } else {
      console.log('❌ FAILED: chat:new_message_alert not emitted incorrectly');
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [user1._id, user2._id] } });
    await Task.deleteOne({ _id: task._id });
    console.log('Cleaned up test data');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
