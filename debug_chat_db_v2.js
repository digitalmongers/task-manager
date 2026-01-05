import 'dotenv/config';
import mongoose from 'mongoose';
import TaskMessage from './models/TaskMessage.js';
import { connectDB } from './config/db.js';

async function checkMessages() {
  await connectDB();
  const taskId = '695b9d4f4ceaca38200a855d';
  
  const messages = await TaskMessage.find({ task: taskId }).sort({ createdAt: -1 }).limit(1);
  
  if (messages.length > 0) {
    const msg = messages[0];
    console.log(JSON.stringify(msg.toObject(), null, 2));
  } else {
    console.log('No messages found');
  }

  process.exit(0);
}

checkMessages();
