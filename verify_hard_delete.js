import "dotenv/config";
import mongoose from 'mongoose';
import User from './models/User.js';
import Task from './models/Task.js';
import AuthService from './services/authService.js';
import { connectDB } from './config/db.js';

async function verify() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // 1. Create a user
    const email = `test_hard_del_${Date.now()}@example.com`;
    const user = await User.create({
      firstName: 'Hard',
      lastName: 'Delete',
      email,
      password: 'password123',
      authProvider: 'local',
      isEmailVerified: true,
      termsAccepted: true
    });
    console.log('Created test user:', user._id);

    // 2. Create some data for the user
    const task = await Task.create({
      title: 'Cleanup Me',
      user: user._id
    });
    console.log('Created task for user:', task._id);

    // 3. Perform hard delete
    console.log('Performing hard delete via AuthService.deleteAccount...');
    await AuthService.deleteAccount(user._id, 'password123', { ip: '127.0.0.1', get: () => 'ua' });

    // 4. Verify user is gone
    const foundUser = await User.findById(user._id);
    if (!foundUser) {
      console.log('✅ SUCCESS: User document removed from database');
    } else {
      console.log('❌ FAILED: User document still exists');
    }

    // 5. Verify task is gone
    const foundTask = await Task.findById(task._id);
    if (!foundTask) {
      console.log('✅ SUCCESS: Associated task removed from database');
    } else {
      console.log('❌ FAILED: Associated task still exists');
    }

    await mongoose.connection.close();
    console.log('Verification finished');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
