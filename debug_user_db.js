import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const debugUser = async () => {
    try {
        console.log('Using MONGO_URI:', process.env.MONGO_URI ? 'Defined' : 'Undefined');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        const targetId = '695e2731c870b845a1acce21';
        
        console.log(`\nSearching for specific user: ${targetId}`);
        const specificUser = await User.findById(targetId);
        
        if (specificUser) {
            console.log('✅ FOUND User:', specificUser.email, specificUser._id);
        } else {
            console.log('❌ User NOT FOUND via findById');
            // Try searching by string ID just in case
            const stringSearch = await User.findOne({ _id: targetId });
            console.log('Search via findOne({_id: string}):', stringSearch ? 'FOUND' : 'NOT FOUND');
        }

        console.log('\nListing first 3 users in DB to verify connection context:');
        const users = await User.find().limit(3);
        users.forEach(u => console.log(`- ${u.email} (${u._id})`));
        
        if (users.length === 0) {
            console.log('⚠️ Database appears empty!');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
};

debugUser();
