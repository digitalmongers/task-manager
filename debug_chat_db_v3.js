import 'dotenv/config';
import mongoose from 'mongoose';
import TaskMessage from './models/TaskMessage.js';
import { connectDB } from './config/db.js';

async function checkImageMessage() {
  await connectDB();
  
  const msg = await TaskMessage.findOne({ messageType: 'image' }).sort({ createdAt: -1 });
  
  if (msg) {
    console.log('--- RAW IMAGE MESSAGE ---');
    console.log(JSON.stringify(msg.toObject(), null, 2));
  } else {
    console.log('No image messages found in the whole DB');
  }

  process.exit(0);
}

checkImageMessage();
