import 'dotenv/config';
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import User from '../models/User.js';

const API_URL = process.env.TEST_API_URL || 'https://task-manager-ljbx.onrender.com';

describe('Subscription Real-time Load Test', () => {
  // Increase timeout for load tests (2 minutes since it involves Razorpay API)
  jest.setTimeout(120000);

  let tokens = [];

  // Step 1: Create, Verify, and Login test users
  beforeAll(async () => {
    const userCount = 20;
    console.log(`👤 Pre-creating ${userCount} users for subscription test...`);
    
    // Connect to MongoDB to manually verify users
    await mongoose.connect(process.env.MONGO_URI);
    
    const testUsers = Array.from({ length: userCount }).map((_, i) => ({
      firstName: 'Sub',
      lastName: `Tester ${i}`,
      email: `subtest_${Date.now()}_${i}@example.com`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      termsAccepted: true
    }));

    // 1. Signup
    const signupPromises = testUsers.map(user => 
      request(API_URL).post('/api/auth/register').send(user)
    );
    await Promise.all(signupPromises);
    console.log('✅ Signups complete.');

    // 2. Manually verify in DB
    const emails = testUsers.map(u => u.email);
    await User.updateMany({ email: { $in: emails } }, { $set: { isEmailVerified: true } });
    console.log('✅ Users verified in database.');

    // 3. Login to get tokens
    const loginPromises = testUsers.map(user => 
      request(API_URL).post('/api/auth/login').send({ email: user.email, password: user.password })
    );
    const loginResponses = await Promise.all(loginPromises);
    
    tokens = loginResponses.map(r => r.body.data?.token).filter(Boolean);
    
    console.log(`✅ Obtained ${tokens.length} valid auth tokens.`);
    
    await mongoose.connection.close();
  });


  test('Should handle 20 concurrent subscription initiations', async () => {
    const validTokens = tokens.filter(Boolean);
    if (validTokens.length === 0) {
      throw new Error('No valid auth tokens available. Signup might have failed or tokens are in cookies.');
    }

    const concurrentUsers = validTokens.length;
    const startTime = Date.now();
    
    console.log(`🚀 Starting Subscription Load Test: Sending ${concurrentUsers} requests to ${API_URL}`);

    const requests = validTokens.map((token) => {
      return request(API_URL)
        .post('/api/payments/create-subscription')
        .set('Authorization', `Bearer ${token}`)
        .send({
          planKey: 'TEAM',
          billingCycle: 'MONTHLY'
        });
    });


    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`✅ Completed ${concurrentUsers} subscription requests in ${duration}ms`);

    const successCount = responses.filter(r => r.status === 200 || r.status === 201).length;
    const failureCount = concurrentUsers - successCount;

    console.log(`📊 Results:`);
    console.log(`   - Success: ${successCount}`);
    console.log(`   - Failure: ${failureCount}`);
    console.log(`   - Avg Time per request: ${(duration / concurrentUsers).toFixed(2)}ms`);

    if (failureCount > 0) {
      console.warn('⚠️ Some requests failed. Check Razorpay logs or server CPU.');
      const firstError = responses.find(r => r.status >= 400);
      console.error('Sample Error Status:', firstError?.status);
      console.error('Sample Error Body:', firstError?.body);
    }

    expect(successCount).toBeGreaterThan(0);
  });
});
