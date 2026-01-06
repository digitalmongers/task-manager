import "dotenv/config";
import mongoose from 'mongoose';
import AIService from './services/ai/aiService.js';
import User from './models/User.js';
import { connectDB } from './config/db.js';

const testFreePlanSuggestions = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    // 1. Create/Find a test user on FREE plan
    let user = await User.findOne({ email: 'free_test@example.com' });
    if (!user) {
      user = await User.create({
        firstName: 'Free',
        lastName: 'Test',
        email: 'free_test@example.com',
        password: 'password123',
        plan: 'FREE',
        totalBoosts: 20,
        usedBoosts: 0
      });
      console.log('Test User Created on FREE plan');
    } else {
      user.plan = 'FREE';
      user.totalBoosts = 20;
      user.usedBoosts = 0;
      await user.save();
      console.log('Test User Reset to FREE plan');
    }

    console.log('\n--- TEST 1: Task Suggestions (Should Work) ---');
    try {
      const suggestions = await AIService.generateTaskSuggestions({
        title: 'Complete the project reporting',
        description: 'I need to finish the final monthly report for the board meeting next Tuesday.',
        userId: user._id
      });
      
      if (suggestions && suggestions.suggestedCategory) {
        console.log('✅ SUCCESS: AI Suggestions generated correctly.');
        console.log('Suggested Category:', suggestions.suggestedCategory);
        console.log('Suggested Priority:', suggestions.suggestedPriority);
      } else {
        console.log('❌ FAILED: Unexpected response format', suggestions);
      }
    } catch (e) {
      console.log('❌ FAILED: Task Suggestions errored', e.message);
    }

    console.log('\n--- TEST 2: Voice Task / NLP (Should be Blocked) ---');
    try {
      await AIService.run({
        userId: user._id,
        feature: 'VOICE_TASK',
        prompt: 'Remind me to call Mom tomorrow at 5pm'
      });
      console.log('❌ FAILED: Voice Task was NOT blocked for FREE user.');
    } catch (e) {
      console.log('✅ SUCCESS: Voice Task correctly blocked. Reason:', e.message);
    }

    console.log('\n--- TEST 3: Check isEnabled() ---');
    console.log('AIService.isEnabled():', AIService.isEnabled());

  } catch (err) {
    console.error('Test script failed:', err);
  } finally {
    await mongoose.connections[0].close();
    process.exit(0);
  }
};

testFreePlanSuggestions();
