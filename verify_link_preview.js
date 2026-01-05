import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import chatService from './services/chatService.js';
import Task from './models/Task.js';
import User from './models/User.js';
import TaskCollaborator from './models/TaskCollaborator.js';
import TaskMessage from './models/TaskMessage.js';

async function verifyLinkPreview() {
  await connectDB();
  console.log('✅ Connected to MongoDB\n');

  try {
    const user = await User.findOne({ email: /@example.com/ }) || await User.findOne();
    if (!user) throw new Error('No user found for testing');

    const task = await Task.create({
      title: 'Link Preview Test',
      user: user._id
    });

    await TaskCollaborator.create({
      task: task._id,
      collaborator: user._id,
      taskOwner: user._id,
      sharedBy: user._id,
      role: 'owner',
      status: 'active'
    });

    // Test Case: Synchronous Link Preview
    console.log('[1] Testing Synchronous Link Preview...');
    const url = 'https://www.google.com';
    const startTime = Date.now();
    const msg = await chatService.sendMessage(task._id, user._id, {
      content: url,
      messageType: 'text'
    });
    const endTime = Date.now();

    console.log(`   - Time Taken: ${endTime - startTime}ms`);
    console.log(`   - Link Preview in Response: ${msg.linkPreview ? 'YES (SUCCESS)' : 'NO (TIMED OUT/FAILED)'}`);
    
    if (msg.linkPreview) {
      console.log(`   - Title: ${msg.linkPreview.title}`);
      console.log(`   - Description: ${msg.linkPreview.description}`);
    }

    // Cleanup
    await Task.findByIdAndDelete(task._id);
    await TaskCollaborator.deleteMany({ task: task._id });
    await TaskMessage.deleteMany({ task: task._id });

    console.log('\n✅ VERIFICATION COMPLETE');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error);
  } finally {
    mongoose.connection.close();
  }
}

verifyLinkPreview();
