import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
// We'll mock the dependencies to focus on concurrency logic
import VitalTaskController from '../controllers/vitalTaskController.js';

// Setup a minimal express app for the load test
const app = express();
app.use(express.json());

// Mock user middleware
app.use((req, res, next) => {
  req.user = { _id: 'test_user_id' };
  next();
});

// Route for testing
app.post('/api/vital-tasks', (req, res) => VitalTaskController.createVitalTask(req, res));

// Mock VitalTaskService
jest.mock('../services/vitalTaskService.js', () => ({
  createVitalTask: jest.fn().mockImplementation((userId, taskData) => {
    return Promise.resolve({
      message: 'Vital task created',
      vitalTask: { ...taskData, _id: Math.random().toString(36).substring(7) }
    });
  })
}));

describe('Vital Task Concurrency Load Test', () => {
  test('Should handle 100 concurrent vital task creations', async () => {
    const concurrentRequests = 100;
    const requests = [];

    console.log(`Starting load test with ${concurrentRequests} concurrent requests...`);
    const startTime = Date.now();

    for (let i = 0; i < concurrentRequests; i++) {
      requests.push(
        request(app)
          .post('/api/vital-tasks')
          .send({
            title: `Load Test Task ${i}`,
            priority: 'high',
            deadline: new Date().toISOString()
          })
      );
    }

    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;

    console.log(`Completed ${concurrentRequests} requests in ${duration}ms`);

    // Verify all requests succeeded
    responses.forEach((res, index) => {
      if (res.status !== 201) {
        console.error(`Request ${index} failed with status ${res.status}:`, res.body);
      }
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    const successCount = responses.filter(r => r.status === 201).length;
    console.log(`Success rate: ${(successCount / concurrentRequests) * 100}%`);
  });
});
