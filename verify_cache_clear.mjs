import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import SubscriptionService from './services/subscriptionService.js';
import cacheService from './services/cacheService.js';
import Logger from './config/logger.js';

dotenv.config();

async function runVerification() {
  console.log('Starting Cache Invalidation verification...');
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Find or create test user
    const testUser = await User.findOneAndUpdate(
       { email: 'cache_test@example.com' },
       { 
         firstName: 'Cache', 
         lastName: 'Test', 
         password: 'password123',
         plan: 'STARTER',
         billingCycle: 'MONTHLY',
         subscriptionStatus: 'active'
       },
       { upsert: true, new: true }
    );
    console.log('Test User ID:', testUser._id);

    // 2. Set a dummy cache key simulating /me endpoint
    // Key format from cacheByUser: user:{userId}:{path}:{query}
    // Note: cacheService.set takes 'key' and PREPENDS the prefix. 
    // Wait, cacheMiddleware calls keyGenerator -> `user:...`
    // Then calls cacheService.set(cacheKey). 
    // cacheService.set(key) calls this.getKey(key) -> `Task Manager{key}`.
    // So if middleware sets `user:123`, redis gets `Task Manageruser:123`.
    // Verification:
    const cacheKey = `user:${testUser._id}:/api/auth/me:{}`; 
    await cacheService.set(cacheKey, { user: 'cached_data' }, 300);
    
    // Verify it's set
    const existsBefore = await cacheService.exists(cacheKey);
    console.log(`Cache key exists before upgrade: ${existsBefore}`);
    if (!existsBefore) throw new Error('Failed to set cache key');

    // 3. Trigger Upgrade
    console.log('Upgrading plan...');
    await SubscriptionService.upgradeUserPlan(testUser._id, 'PRO', 'YEARLY');
    
    // 4. Verify cache is gone
    // We used deletePattern(`user:${userId}:*`). 
    // deletePattern calls getKey(pattern) -> `Task Manageruser:...*`
    // redis.keys(`Task Manageruser:...*`) should match `Task Manageruser:.../api/auth/me...`
    // and delete it.
    
    // Wait a brief moment as redis ops are async but awaited
    const existsAfter = await cacheService.exists(cacheKey);
    console.log(`Cache key exists after upgrade: ${existsAfter}`);
    
    if (!existsAfter) {
        console.log('✅ Success: Cache key was invalidated.');
    } else {
        console.log('❌ Failure: Cache key still exists.');
    }

    console.log('\nVerification complete. Waiting for logs...');
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (error) {
    console.error('Verification failed:', error);
    if (error.stack) console.error(error.stack);
    import('fs').then(fs => fs.writeFileSync('verification_error.txt', error.toString() + '\\n' + error.stack));
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
}

runVerification();
