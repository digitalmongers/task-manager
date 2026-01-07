import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const checkSub = async () => {
    const subId = "sub_S0tqL76haS73DH";
    try {
        const sub = await instance.subscriptions.fetch(subId);
        console.log('STATUS:', sub.status);
        // console.log('Subscription Details:');
        // console.log(JSON.stringify(sub, null, 2));
    } catch (error) {
        console.error('Error:', error);
    }
};

checkSub();
