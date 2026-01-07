import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './models/Payment.js';

dotenv.config();

const debugSubPayments = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const subId = 'sub_S0wqAGYViA0qdd';
        console.log(`Searching for ALL Payments with Sub ID: ${subId}`);
        
        const payments = await Payment.find({ razorpaySubscriptionId: subId });
        console.log(`Found ${payments.length} records.`);
        
        payments.forEach((p, index) => {
            console.log(`Record ${index + 1}: ${JSON.stringify(p.toJSON())}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

debugSubPayments();
