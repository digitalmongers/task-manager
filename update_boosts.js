import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

async function updateFreeBoosts() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const result = await User.updateMany(
            { plan: 'FREE', totalBoosts: 20 },
            { $set: { totalBoosts: 100 } }
        );

        console.log(`Updated ${result.modifiedCount} users from 20 to 100 boosts.`);
        
        // Specifically check the user mentioned if they weren't updated
        const targetUser = await User.findOne({ email: 'devw2884@gmail.com' });
        if (targetUser && targetUser.totalBoosts !== 100) {
            targetUser.totalBoosts = 100;
            await targetUser.save();
            console.log('Manually updated devw2884@gmail.com to 100 boosts.');
        }

        await mongoose.connection.close();
        console.log('Done.');
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
}

updateFreeBoosts();
