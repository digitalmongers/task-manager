import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import aiService from './services/ai/aiService.js';
import subscriptionService from './services/subscriptionService.js';
import Logger from './config/logger.js';

dotenv.config();

// Set dummy key for initialization
process.env.OPENAI_API_KEY = 'sk-mock-key';

// Mock OpenAI
aiService.openai = {
  chat: {
    completions: {
      create: async () => ({
        choices: [{ message: { content: 'Mock response' }, finish_reason: 'stop' }],
        usage: { total_tokens: 1000, completion_tokens: 500, prompt_tokens: 500 }
      })
    }
  }
};

async function runTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Create a dummy user for testing
    const testEmail = `test_free_trial_${Date.now()}@example.com`;
    const user = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: testEmail,
      password: 'Password123!',
      termsAccepted: true,
      plan: 'FREE',
      totalBoosts: 100,
      usedBoosts: 0,
    });

    console.log('--- TEST 1: New User (Within 30 days) ---');
    try {
      await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
      console.log('✅ TEST 1 PASSED: AI usage allowed for new user');
    } catch (e) {
      console.error('❌ TEST 1 FAILED:', e.message);
    }

    console.log('--- TEST 2: Old User (> 30 days) ---');
    user.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await user.save();
    try {
      await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
      console.error('❌ TEST 2 FAILED: AI usage allowed for old user');
    } catch (e) {
      console.log('✅ TEST 2 PASSED:', e.message);
    }

    console.log('--- TEST 3: User with 100 boosts used ---');
    user.createdAt = new Date(); // Reset to fresh
    user.usedBoosts = 100;
    user.aiUsageBlocked = false;
    await user.save();
    try {
      await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
      console.error('❌ TEST 3 FAILED: AI usage allowed for exhausted user');
    } catch (e) {
      console.log('✅ TEST 3 PASSED:', e.message);
    }

    console.log('--- TEST 4: Lazy Reset for FREE User ---');
    user.usedBoosts = 50;
    user.lastMonthlyReset = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    await user.save();
    
    // Trigger lazy reset by calling aiService.run
    try {
        await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
        const updatedUser = await User.findById(user._id);
        if (updatedUser.usedBoosts === 50) {
            console.log('✅ TEST 4 PASSED: FREE user boosts NOT refilled by lazy reset');
        } else {
            console.error('❌ TEST 4 FAILED: FREE user boosts refilled to', updatedUser.usedBoosts);
        }
    } catch (e) {
        console.error('❌ TEST 4 ERROR:', e.message);
    }

    console.log('--- TEST 5: Subscription Expiry Logic ---');
    user.plan = 'STARTER';
    user.currentPeriodEnd = new Date(Date.now() - 1000); // Expired
    user.usedBoosts = 105; // More than FREE limit
    user.createdAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // Account is old
    await user.save();

    await subscriptionService.handleExpiry(user._id);
    const expiredUser = await User.findById(user._id);
    if (expiredUser.plan === 'FREE' && expiredUser.aiUsageBlocked === true) {
        console.log('✅ TEST 5 PASSED: Expired user downgraded to FREE and blocked due to account age');
    } else {
        console.error('❌ TEST 5 FAILED: Plan:', expiredUser.plan, 'Blocked:', expiredUser.aiUsageBlocked);
    }

    console.log('--- TEST 6: STARTER Plan User (> 30 days) ---');
    user.plan = 'STARTER';
    user.createdAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days old
    user.usedBoosts = 0;
    user.totalBoosts = 1000;
    user.aiUsageBlocked = false;
    await user.save();
    try {
      await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
      console.log('✅ TEST 6 PASSED: Paid plan user NOT blocked by account age');
    } catch (e) {
      console.error('❌ TEST 6 FAILED:', e.message);
    }

    console.log('--- TEST 7: Upgrade from Expired FREE to STARTER ---');
    // Set as expired FREE first
    user.plan = 'FREE';
    user.createdAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    user.aiUsageBlocked = true;
    user.usedBoosts = 100;
    await user.save();

    // Perform manual upgrade (simulating subscriptionService.upgradeUserPlan)
    user.plan = 'STARTER';
    user.totalBoosts = 1000;
    user.usedBoosts = 0;
    user.aiUsageBlocked = false;
    await user.save();

    try {
      await aiService.run({ userId: user._id, feature: 'TASK_SUGGESTION', input: 'Test' });
      console.log('✅ TEST 7 PASSED: Upgraded user can use AI despite old account');
    } catch (e) {
      console.error('❌ TEST 7 FAILED:', e.message);
    }

    // Cleanup
    await User.findByIdAndDelete(user._id);
    console.log('Test user deleted');

  } catch (error) {
    console.error('Test script error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

runTest();
