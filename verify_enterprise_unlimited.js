import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import CollaborationService from './services/collaborationService.js';
import Task from './models/Task.js';
import Logger from './config/logger.js';

dotenv.config();

async function verifyEnterpriseUnlimited() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // 1. Create an Enterprise user (FREE plan)
    const enterpriseUser = await User.findOneAndUpdate(
      { email: 'enterprise_test@tasskr.com' },
      {
        firstName: 'Enterprise',
        lastName: 'Tester',
        password: 'Password123!',
        isEmailVerified: true,
        termsAccepted: true,
        plan: 'FREE',
        isEnterpriseUser: true
      },
      { upsert: true, new: true }
    );

    console.log('Enterprise user created/updated:', enterpriseUser.email, 'isEnterpriseUser:', enterpriseUser.isEnterpriseUser);

    // 2. Create a test task
    const task = await Task.create({
      title: 'Enterprise Test Task',
      user: enterpriseUser._id,
    });

    console.log('Test task created:', task._id);

    // 3. Attempt to invite 3 collaborators (FREE limit is 1)
    const emails = [
      'collab1@test.com',
      'collab2@test.com',
      'collab3@test.com' 
    ];

    console.log(`Attempting to invite ${emails.length} collaborators...`);

    for (const email of emails) {
      try {
        await CollaborationService.inviteToTask(task._id, enterpriseUser._id, email);
        console.log(`Successfully invited ${email}`);
      } catch (error) {
        console.error(`Failed to invite ${email}:`, error.message);
      }
    }

    // 4. Cleanup
    await Task.deleteOne({ _id: task._id });
    // Keep user for future tests or delete if desired
    // await User.deleteOne({ _id: enterpriseUser._id });

    console.log('Verification complete.');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

verifyEnterpriseUnlimited();
