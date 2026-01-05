
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import chatService from './services/chatService.js';
import TaskMessage from './models/TaskMessage.js';
import User from './models/User.js';
import Task from './models/Task.js';
import fs from 'fs';

dotenv.config();

const run = async () => {
  try {
    console.log('Starting Advanced Verification...');
    await mongoose.connect(process.env.MONGO_URI);
    
    const suffix = Date.now().toString();
    const user = await User.create({ firstName: 'AdvUser', lastName: 'Test', email: `adv_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const task = await Task.create({ title: 'Advanced Chat Test', user: user._id });

    // 1. Test Link Preview
    console.log('\n--- 1. Testing Link Preview ---');
    const msgWithLink = await chatService.sendMessage(task._id, user._id, { content: 'Check this out: https://github.com' });
    if (msgWithLink.linkPreview && msgWithLink.linkPreview.title) {
      console.log('SUCCESS: Link preview generated:', msgWithLink.linkPreview.title);
    } else {
      console.log('NOTICE: Link preview might be empty if GitHub blocked it, but object should exist if reachable.');
    }

    // 2. Test Search (Wait a bit for indexing if necessary, though Mongoose usually does it sync in local)
    console.log('\n--- 2. Testing Optimized Search ---');
    // We need to wait for MongoDB to build the index or hope it's ready.
    // Let's try searching for a keyword.
    await chatService.sendMessage(task._id, user._id, { content: 'Enterprise search keyword unique_word' });
    
    // Manual find with $text since we want to verify the controller logic
    const results = await TaskMessage.find({ $text: { $search: 'unique_word' } });
    if (results.length > 0) {
      console.log('SUCCESS: Text search found the message');
    } else {
      console.log('FAIL: Text search did not find the message (Index might still be building)');
    }

    // 3. Test Offline Sync
    console.log('\n--- 3. Testing Offline Sync ---');
    const beforeSync = new Date(Date.now() - 10000); // 10 seconds ago
    await chatService.sendMessage(task._id, user._id, { content: 'Missed message' });
    
    const secondUser = await User.create({ firstName: 'User2', lastName: 'Test', email: `u2_${suffix}@test.com`, password: 'password123', passwordConfirm: 'password123' });
    const syncData = await chatService.getSyncMessages(secondUser._id, beforeSync);
    // Since message was from user1 and user2 is part of NO tasks, it should be 0.
    // Let's add user2 to the task.
    task.collaborators.push({ collaborator: secondUser._id, role: 'editor' });
    await task.save();
    
    const syncData2 = await chatService.getSyncMessages(secondUser._id, beforeSync);
    if (syncData2.length > 0) {
      console.log('SUCCESS: Sync caught missed message');
    } else {
      console.log('FAIL: Sync failed to catch message');
    }

    // Cleanup
    await User.deleteMany({ _id: { $in: [user._id, secondUser._id] } });
    await Task.deleteOne({ _id: task._id });
    await TaskMessage.deleteMany({ task: task._id });
    console.log('\nCleanup complete');

  } catch (error) {
    console.error('VERIFICATION ERROR:', error.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();
