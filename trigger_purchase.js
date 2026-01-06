
import "dotenv/config";
import mongoose from 'mongoose';
import RazorpayService from './services/razorpayService.js';
import User from './models/User.js';
import { connectDB } from './config/db.js';

const triggerPurchase = async () => {
  try {
    await connectDB();
    console.log('Connected to DB');

    const email = 'parasmourya288@gmail.com';
    const user = await User.findOne({ email });

    if (!user) {
      console.error(`User with email ${email} not found!`);
      process.exit(1);
    }

    console.log(`Found user: ${user.firstName} ${user.lastName} (${user._id})`);
    console.log(`Current Plan: ${user.plan}`);

    console.log('\n--- Creating Razorpay Subscription for STARTER (MONTHLY) ---');
    
    // Use the default exported instance
    const subscription = await RazorpayService.createSubscription(
      user._id,
      'STARTER',
      'MONTHLY'
    );

    console.log('✅ Subscription Created Successfully!');
    console.log('Subscription Details:', JSON.stringify(subscription, null, 2));
    
    console.log('\n---------------------------------------------------');
    console.log('NEXT STEPS:');
    console.log('1. Frontend should use this order_id to open Razorpay Checkout.');
    console.log('2. Once payment is successful, Razorpay Webhook will call your API.');
    console.log('3. Your backend will then upgrade this user to STARTER plan.');
    console.log('---------------------------------------------------');

  } catch (error) {
    console.error('Error triggering purchase:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

triggerPurchase();
