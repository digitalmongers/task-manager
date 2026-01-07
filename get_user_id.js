import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const findUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const email = 'parasmourya288@gmail.com';
        const user = await User.findOne({ email });
        
        if (user) {
            console.log(`User Found: ${user.email}`);
            console.log(`ID: ${user._id}`);
            console.log(`Current Plan: ${user.plan}`);
        } else {
            console.log('User not found');
        }
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

findUser();
