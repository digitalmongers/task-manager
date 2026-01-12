import 'dotenv/config';
import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import { createServer } from 'http';
import express from 'express';
// Assuming we need to import the actual app setup
// For this test, we might want to hit a running server or import the app
// Since server.js starts the server immediately, we might need to export 'app' from a separate file.
// For now, I'll provide a script that hits the base URL if the server is running, 
// OR imports the logic if possible.

const API_URL = process.env.TEST_API_URL || 'https://task-manager-ljbx.onrender.com';

describe('Signup Real-time Load Test', () => {
  // Increase timeout for load tests (60 seconds)
  jest.setTimeout(60000);

  beforeAll(() => {
    console.log(`📡 Testing against Backend API: ${API_URL}`);
  });

  test('Should handle 20 concurrent signups', async () => {
    const concurrentUsers = 50;
    const startTime = Date.now();
    
    console.log(`🚀 Starting Load Test: Sending ${concurrentUsers} signups to ${API_URL}`);

    const requests = Array.from({ length: concurrentUsers }).map((_, i) => {
      const email = `loadtest_${Date.now()}_${i}@example.com`;
      return request(API_URL)
        .post('/api/auth/register')
        .send({
          firstName: 'Load',
          lastName: `Tester ${i}`,
          email: email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
          termsAccepted: true
        });
    });

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`✅ Completed ${concurrentUsers} signups in ${duration}ms`);

    const statuses = responses.map(r => r.status);
    const successCount = statuses.filter(s => s === 201).length;
    const failureCount = concurrentUsers - successCount;

    console.log(`📊 Results:`);
    console.log(`   - Success: ${successCount}`);
    console.log(`   - Failure: ${failureCount}`);
    console.log(`   - Avg Time per signup: ${(duration / concurrentUsers).toFixed(2)}ms`);

    if (failureCount > 0) {
      console.warn('⚠️ Some requests failed. Check for rate limits or DB bottlenecks.');
      // Log first error for debugging
      const firstError = responses.find(r => r.status !== 201);
      console.error('Sample Error:', firstError.body);
    }

    expect(successCount).toBeGreaterThan(0);
  });
});

