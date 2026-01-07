import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Notification from './models/Notification.js';
import SubscriptionService from './services/subscriptionService.js';
import Logger from './config/logger.js';

dotenv.config();

async function runVerification() {
  console.log('Starting verification...');
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Create a test user
    const testUser = await User.findOneAndUpdate(
      { email: 'test_upgrade@example.com' },
      {
        firstName: 'Test',
        lastName: 'Upgrade',
        password: 'password123',
        emailVerified: true,
        plan: 'FREE',
        websocketNotificationsEnabled: true
      },
      { upsert: true, new: true }
    );

    console.log('Test User Created/Found:', testUser._id);

    const plans = ['STARTER', 'PRO', 'TEAM'];
    const cycles = ['MONTHLY', 'YEARLY'];

    for (const plan of plans) {
      for (const cycle of cycles) {
        try {
          console.log(`\nTesting Upgrade to ${plan} (${cycle})...`);
          
          await SubscriptionService.upgradeUserPlan(testUser._id, plan, cycle);
          
          // Check finding latest notification
          const notification = await Notification.findOne({
            recipient: testUser._id,
            type: 'plan_upgraded'
          }).sort({ createdAt: -1 });

          if (notification) {
            console.log(`Title: ${notification.title}`);
            console.log(`Message: ${notification.message}`);
            console.log(`Metadata:`, JSON.stringify(notification.metadata));
            
            if (notification.title.includes(plan)) {
              console.log(`✅ Success: Specific notification sent for ${plan}`);
            } else {
              console.log(`❌ Failure: Generic notification found for ${plan}`);
            }
          } else {
            console.log('❌ Failure: No notification found');
          }
        } catch (innerError) {
          console.error(`Error during ${plan} ${cycle} upgrade:`, innerError.message);
          if (innerError.stack) console.error(innerError.stack);
        }
      }
    }

    // Cleanup
    // await User.deleteOne({ _id: testUser._id });
    // await Notification.deleteMany({ recipient: testUser._id });
    
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runVerification();
