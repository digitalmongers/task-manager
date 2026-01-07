import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './models/Payment.js';

dotenv.config();

const debugMismatch = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const logPaymentId = '695cf5fdeb7b599274cf3d3b'; // ID found in logs
        const userPaymentId = '695e2eca74d7ea363b7b8f73'; // ID user provided

        console.log(`--- Log Payment (Found by Webhook) ---`);
        const logP = await Payment.findById(logPaymentId);
        if (logP) {
            console.log(`ID: ${logP._id}`);
            console.log(`Plan: ${logP.plan}`);
            console.log(`Cycle: ${logP.billingCycle}`);
            console.log(`SubID: ${logP.razorpaySubscriptionId}`);
            console.log(`OrderID: ${logP.razorpayOrderId}`);
            console.log(`Amount: ${logP.amount}`);
            console.log(`Status: ${logP.status}`);
            console.log(`Created: ${logP.createdAt}`);
        } else {
            console.log('Log Payment Not Found');
        }

        console.log(`\n--- User Payment (Expected by User) ---`);
        const userP = await Payment.findById(userPaymentId);
        if (userP) {
            console.log(`ID: ${userP._id}`);
            console.log(`Plan: ${userP.plan}`);
            console.log(`Cycle: ${userP.billingCycle}`);
            console.log(`SubID: ${userP.razorpaySubscriptionId}`);
            console.log(`OrderID: ${userP.razorpayOrderId}`);
            console.log(`Amount: ${userP.amount}`);
            console.log(`Status: ${userP.status}`);
            console.log(`Created: ${userP.createdAt}`);
        } else {
            console.log('User Payment Not Found');
        }
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

debugMismatch();
