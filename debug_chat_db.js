import 'dotenv/config';
import mongoose from 'mongoose';
import TaskMessage from './models/TaskMessage.js';
import { connectDB } from './config/db.js';

async function checkMessages() {
  await connectDB();
  const taskId = '695b9d4f4ceaca38200a855d';
  
  console.log(`Checking messages for task: ${taskId}`);
  
  const messages = await TaskMessage.find({ task: taskId }).sort({ createdAt: -1 }).limit(5);
  
  messages.forEach((msg, i) => {
    console.log(`\n--- Message ${i+1} ---`);
    console.log(`ID: ${msg._id}`);
    console.log(`Type: ${msg.messageType}`);
    console.log(`Content (Encrypted): ${msg.content}`);
    console.log(`FileDetails:`, JSON.stringify(msg.fileDetails, null, 2));
    console.log(`isEncrypted: ${msg.isEncrypted}`);
  });

  process.exit(0);
}

checkMessages();
