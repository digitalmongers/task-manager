
import "dotenv/config";
import mongoose from 'mongoose';
import User from './models/User.js';
import { connectDB } from './config/db.js';
import { PLAN_LIMITS } from './config/aiConfig.js';
import Logger from './config/logger.js';

const manualUpgrade = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    const email = 'parasmourya288@gmail.com';
    const planKey = 'STARTER';
    const cycle = 'MONTHLY';

    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User with email ${email} not found!`);
      process.exit(1);
    }

    console.log(`Upgrading User: ${user.firstName} ${user.lastName} (${user.email})`);
    console.log(`Previous Status: Plan=${user.plan}, Status=${user.subscriptionStatus}`);

    // Update user based on STARTER plan limits
    user.plan = planKey;
    user.totalBoosts = PLAN_LIMITS[planKey].monthlyBoosts;
    user.usedBoosts = 0;
    user.aiUsageBlocked = false;
    user.billingCycle = cycle;
    user.subscriptionStatus = 'active';
    
    // Set expiration to 1 month from now
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    user.currentPeriodEnd = expiry;

    await user.save();

    console.log('\n✅ Manual Upgrade Successful!');
    console.log('--- Current Account Status ---');
    console.log(`Plan: ${user.plan}`);
    console.log(`Total Boosts: ${user.totalBoosts}`);
    console.log(`Used Boosts: ${user.usedBoosts}`);
    console.log(`Subscription Status: ${user.subscriptionStatus}`);
    console.log(`Expires At: ${user.currentPeriodEnd}`);
    console.log('------------------------------');

  } catch (error) {
    console.error('Error during manual upgrade:', error.message);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

manualUpgrade();
