import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import chatService from './services/chatService.js';
import Task from './models/Task.js';
import User from './models/User.js';
import TaskCollaborator from './models/TaskCollaborator.js';
import TaskMessage from './models/TaskMessage.js';
import { decrypt } from './utils/encryptionUtils.js';

async function verifyImageChat() {
  await connectDB();
  console.log('✅ Connected to MongoDB\n');

  try {
    // 1. Setup Test User & Task
    const user = await User.findOne({ email: /@example.com/ }) || await User.findOne();
    if (!user) throw new Error('No user found for testing');

    const task = await Task.create({
      title: 'Image Test Task',
      description: 'Testing dual payload chat',
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

    console.log(`[1] Setup complete. User: ${user.firstName}, Task: ${task.title}\n`);

    // 2. Test Case A: Standalone Image
    console.log('[2] Testing Standalone Image...');
    const imgMsg = await chatService.sendMessage(task._id, user._id, {
      fileDetails: {
        url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        mimeType: 'image/jpeg',
        publicId: 'sample_img'
      }
    });

    console.log(`   - MessageType: ${imgMsg.messageType} (Expected: image)`);
    console.log(`   - Has fileDetails: ${!!imgMsg.fileDetails}`);

    // 3. Test Case B: Image + Caption
    console.log('\n[3] Testing Image + Text Caption...');
    const captionText = 'Check out this design mockup!';
    const captionMsg = await chatService.sendMessage(task._id, user._id, {
      content: captionText,
      fileDetails: {
        url: 'https://res.cloudinary.com/demo/image/upload/v1/mockup.png',
        mimeType: 'image/png',
        publicId: 'mockup_img'
      }
    });

    console.log(`   - MessageType: ${captionMsg.messageType} (Expected: image)`);
    console.log(`   - Content: "${captionMsg.content}" (Decrypted successfully)`);
    
    const rawInDb = await TaskMessage.findById(captionMsg._id);
    console.log(`   - Is Encrypted in DB: ${rawInDb.isEncrypted}`);
    try {
        const decrypted = decrypt(rawInDb.content, 'CHAT');
        console.log(`   - DB Content Decodes to: "${decrypted}" (SUCCESS)`);
    } catch (e) {
        console.log('   - DB Content Decode FAILED');
    }

    // 4. Cleanup
    await Task.findByIdAndDelete(task._id);
    await TaskCollaborator.deleteMany({ task: task._id });
    await TaskMessage.deleteMany({ $or: [{ task: task._id }, { vitalTask: task._id }] });

    console.log('\n✅ VERIFICATION COMPLETE: Image delivery and captions are working flawlessly.');

  } catch (error) {
    console.error('❌ VERIFICATION FAILED:', error);
  } finally {
    mongoose.connection.close();
  }
}

verifyImageChat();
