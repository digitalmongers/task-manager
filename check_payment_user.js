import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './models/Payment.js';

dotenv.config();

const checkPaymentUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        // Subscription ID from the Step 794 log
        const subId = 'sub_S0wPgxaAMnS9Qi';
        const orderId = 'order_S0wPhoPrxJAiBe';
        
        console.log(`Searching for Payments with Sub ID: ${subId}`);
        const paymentsBySub = await Payment.find({ razorpaySubscriptionId: subId });
        console.log(`Found ${paymentsBySub.length} payments by SubID.`);
        paymentsBySub.forEach(p => console.log(`- ID: ${p._id}, User: ${p.user}, Status: ${p.status}`));

        console.log(`\nSearching for Payments with Order ID: ${orderId}`);
        const paymentsByOrder = await Payment.find({ razorpayOrderId: orderId });
        console.log(`Found ${paymentsByOrder.length} payments by OrderID.`);
        paymentsByOrder.forEach(p => console.log(`- ID: ${p._id}, User: ${p.user}, Status: ${p.status}`));

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

checkPaymentUser();
