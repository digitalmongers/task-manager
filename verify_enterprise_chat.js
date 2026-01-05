
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import chatService from './services/chatService.js';
import TaskMessage from './models/TaskMessage.js';
import User from './models/User.js';
import Task from './models/Task.js';
import redisClient from './config/redis.js';

dotenv.config();

const run = async () => {
  try {
    console.log('Starting verification...');
    if (!process.env.MONGO_URI) throw new Error('MONGO_URI missing');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('DB Connected');
    
    const suffix = Date.now().toString();
    const userA = await User.create({ firstName: 'UserA', lastName: 'Test', email: `a_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const userB = await User.create({ firstName: 'UserB', lastName: 'Test', email: `b_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const task = await Task.create({ title: 'Enterprise Chat Test', user: userA._id });

    console.log(`Setup complete. TaskID: ${task._id}`);

    // 1. Test Idempotency
    const clientSideId = `csid_${suffix}`;
    const msg1 = await chatService.sendMessage(task._id, userA._id, { content: 'Hello', clientSideId });
    const msg2 = await chatService.sendMessage(task._id, userA._id, { content: 'Hello Duplicate', clientSideId });

    if (msg1._id.toString() === msg2._id.toString()) {
      console.log('SUCCESS: Idempotency passed');
    } else {
      console.error('FAIL: Idempotency failed');
    }

    // 2. Test Delivery Tracking
    await chatService.markAsDelivered(msg1._id, userB._id, task._id);
    const delMsg = await TaskMessage.findById(msg1._id);
    if (delMsg.status === 'delivered') {
      console.log('SUCCESS: Delivery status updated');
    } else {
      console.error('FAIL: Delivery status NOT updated');
    }

    // 3. Test Read Tracking
    await chatService.markAsRead(task._id, userB._id);
    const readMsg = await TaskMessage.findById(msg1._id);
    if (readMsg.status === 'read') {
      console.log('SUCCESS: Read status updated');
    } else {
      console.error('FAIL: Read status NOT updated');
    }

    // 4. Test Presence
    await redisClient.set(`presence:${userA._id}`, JSON.stringify({ status: 'online', serverId: 'test-server', lastSeen: new Date() }));
    const members = await chatService.getChatMembers(task._id, userA._id);
    const owner = members.find(m => m.role === 'owner');
    if (owner && owner.isOnline) {
      console.log('SUCCESS: Presence system working');
    } else {
      console.error('FAIL: Presence system failed');
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Task.deleteOne({ _id: task._id });
    await TaskMessage.deleteMany({ task: task._id });
    await redisClient.del(`presence:${userA._id}`);
    console.log('Cleanup complete');

  } catch (error) {
    console.error('VERIFICATION ERROR:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
    process.exit(0);
  }
};

run();
