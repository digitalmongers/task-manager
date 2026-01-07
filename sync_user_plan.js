
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import SubscriptionService from './services/subscriptionService.js';
import User from './models/User.js';

dotenv.config();

const syncUser = async () => {
    const userId = "695d02f6eb7b599274cf3f4f"; // User from the logs
    const planKey = "PRO";
    const billingCycle = "YEARLY";

    try {
        console.log(`Connecting to DB to upgrade user ${userId} to ${planKey} (${billingCycle})...`);
        await mongoose.connect(process.env.MONGO_URI);
        
        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found!");
            process.exit(1);
        }

        console.log(`Current Plan: ${user.plan}, Status: ${user.subscriptionStatus}`);
        
        await SubscriptionService.upgradeUserPlan(userId, planKey, billingCycle);
        
        const updatedUser = await User.findById(userId);
        console.log("Success! Updated Profile:");
        console.log({
            _id: updatedUser._id,
            email: updatedUser.email,
            plan: updatedUser.plan,
            billingCycle: updatedUser.billingCycle,
            subscriptionStatus: updatedUser.subscriptionStatus,
            totalBoosts: updatedUser.totalBoosts,
            currentPeriodEnd: updatedUser.currentPeriodEnd
        });

        process.exit(0);
    } catch (error) {
        console.error("Upgrade failed:", error);
        process.exit(1);
    }
};

syncUser();
