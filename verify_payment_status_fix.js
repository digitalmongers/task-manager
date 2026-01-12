import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './models/Payment.js';
import User from './models/User.js';

dotenv.config();

async function verifyFix() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Find a top-up payment record
    const topupPayment = await Payment.findOne({ purchaseType: 'topup' }).sort({ createdAt: -1 });
    if (!topupPayment) {
      console.log('No top-up payment found for testing. Please create one manually if needed.');
      return;
    }

    console.log('Testing with Top-up Payment:', {
      id: topupPayment._id,
      orderId: topupPayment.razorpayOrderId,
      user: topupPayment.user
    });

    // 2. Simulate the query used in checkPaymentStatus
    const query = { razorpayOrderId: topupPayment.razorpayOrderId };
    const foundPayment = await Payment.findOne(query);

    if (foundPayment && foundPayment._id.toString() === topupPayment._id.toString()) {
      console.log('✅ SUCCESS: Top-up payment correctly found using razorpayOrderId');
    } else {
      console.error('❌ FAILURE: Could not find top-up payment using razorpayOrderId');
    }

    // 3. Simulate the authorization check
    const userId = topupPayment.user;
    if (foundPayment.user.toString() === userId.toString()) {
      console.log('✅ SUCCESS: Authorization check passed');
    } else {
      console.error('❌ FAILURE: Authorization check failed', {
        paymentUser: foundPayment.user,
        testUser: userId
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verifyFix();
