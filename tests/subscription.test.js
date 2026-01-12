import { jest } from '@jest/globals';
import User from '../models/User.js';
import SubscriptionService from '../services/subscriptionService.js';

// Mock the User model
jest.mock('../models/User.js');

describe('SubscriptionService', () => {
  let mockUser;

  beforeEach(() => {
    mockUser = {
      _id: 'user123',
      plan: 'FREE',
      save: jest.fn().mockResolvedValue(true)
    };
    User.findById = jest.fn().mockResolvedValue(mockUser);
  });

  test('upgradeUserPlan should save razorpaySubscriptionId to user', async () => {
    const planKey = 'PRO';
    const billingCycle = 'MONTHLY';
    const subscriptionId = 'sub_test_999';

    await SubscriptionService.upgradeUserPlan(mockUser._id, planKey, billingCycle, subscriptionId);

    expect(mockUser.plan).toBe(planKey);
    expect(mockUser.razorpaySubscriptionId).toBe(subscriptionId);
    expect(mockUser.subscriptionStatus).toBe('active');
    expect(mockUser.save).toHaveBeenCalled();
  });
});
