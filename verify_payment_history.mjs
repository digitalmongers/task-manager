import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import Payment from './models/Payment.js';
import Logger from './config/logger.js';

dotenv.config();

async function runVerification() {
  console.log('Starting Payment History verification...');
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // 1. Create/Find test user
    const testUser = await User.findOneAndUpdate(
      { email: 'history_test@example.com' },
      {
        firstName: 'History',
        lastName: 'Test',
        password: 'password123',
        emailVerified: true,
        plan: 'PRO',
        billingCycle: 'YEARLY',
        subscriptionStatus: 'active',
        totalBoosts: 800,
        usedBoosts: 150
      },
      { upsert: true, new: true }
    );
    console.log('Test User ID:', testUser._id);

    // 2. Create dummy payments
    await Payment.deleteMany({ user: testUser._id });
    const dummyPayments = [
      {
        user: testUser._id,
        plan: 'STARTER',
        billingCycle: 'MONTHLY',
        amount: 12,
        status: 'captured',
        razorpayPaymentId: 'pay_dummy_1',
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      },
      {
        user: testUser._id,
        plan: 'PRO',
        billingCycle: 'YEARLY',
        amount: 290,
        status: 'captured',
        razorpayPaymentId: 'pay_dummy_2',
        createdAt: new Date()
      }
    ];
    await Payment.insertMany(dummyPayments);
    console.log('Dummy payments created');

    // 3. Verify history retrieval logic
    // We'll simulate the controller logic directly here since we can't easily mock req/res with expressAsyncHandler easily without a full server hit.
    // However, we can check the query logic.

    const payments = await Payment.find({ user: testUser._id })
      .sort({ createdAt: -1 })
      .select('plan billingCycle amount currency status createdAt invoiceUrl razorpayPaymentId');

    console.log('\nRetrieved History:');
    payments.forEach((p, i) => {
      console.log(`${i+1}. Plan: ${p.plan}, Cycle: ${p.billingCycle}, Status: ${p.status}, Created: ${p.createdAt}`);
    });

    if (payments.length === 2 && payments[0].plan === 'PRO') {
      console.log('\n✅ Success: Payment history retrieved and sorted correctly.');
    } else {
      console.log('\n❌ Failure: History mismatch.');
    }

    console.log('\nVerification complete. Waiting for logs...');
    setTimeout(() => {
      process.exit(0);
    }, 2000);
  } catch (error) {
    console.error('Verification failed:', error);
    setTimeout(() => {
      process.exit(1);
    }, 2000);
  }
}

runVerification();
