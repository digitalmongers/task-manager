import "dotenv/config";
import mongoose from 'mongoose';
import fs from 'fs';
import User from './models/User.js';
import TaskService from './services/taskService.js';
import AuthService from './services/authService.js';
import { connectDB } from './config/db.js';

async function verify() {
  let results = "";
  const log = (msg) => {
    console.log(msg);
    results += msg + "\n";
  };

  try {
    await connectDB();
    log('Connected to MongoDB');

    // 1. Create a dummy user
    const email = `test_onboarding_${Date.now()}@example.com`;
    const user = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email,
      password: 'password123',
      termsAccepted: true,
      isEmailVerified: true
    });
    log(`Created test user: ${user.email}`);
    log(`Initial flags: onboardingComplete=${user.onboardingComplete}, firstTaskCreated=${user.firstTaskCreated}`);

    // 2. Complete onboarding
    await AuthService.completeOnboarding(user._id);
    const updatedUser = await User.findById(user._id);
    log(`After completeOnboarding: onboardingComplete=${updatedUser.onboardingComplete}`);

    // 3. Create first task
    await TaskService.createTask(user._id, { title: 'First Task' });
    const userAfterTask = await User.findById(user._id);
    log(`After first task creation: firstTaskCreated=${userAfterTask.firstTaskCreated}`);

    // Cleanup
    await User.deleteOne({ _id: user._id });
    log('Cleaned up test user');

    await mongoose.connection.close();
    log('Disconnected from MongoDB');
    
    fs.writeFileSync('verify_results.txt', results);
    process.exit(0);
  } catch (error) {
    results += `Verification failed: ${error.message}\n${error.stack}`;
    fs.writeFileSync('verify_results.txt', results);
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verify();
