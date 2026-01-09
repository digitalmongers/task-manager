import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

/**
 * Migration script for new boost tracking system
 * Migrates deprecated totalBoosts -> subscriptionBoosts
 * Migrates deprecated usedBoosts -> subscriptionBoostsUsed
 */
async function migrateUsers() {
  try {
    console.log('Starting migration to new boost tracking system...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const users = await User.find({ 
      $or: [
        { totalBoosts: { $exists: true } },
        { usedBoosts: { $exists: true } }
      ]
    });

    console.log(`Found ${users.length} users to migrate.`);

    let migratedCount = 0;
    for (const user of users) {
      const rawTotal = user.totalBoosts || user.get('totalBoosts');
      const rawUsed = user.usedBoosts || user.get('usedBoosts');

      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            subscriptionBoosts: rawTotal || 0,
            subscriptionBoostsUsed: rawUsed || 0,
            topupBoosts: 0,
            topupBoostsUsed: 0
          },
          $unset: {
            totalBoosts: 1,
            usedBoosts: 1
          }
        }
      );
      
      migratedCount++;
      if (migratedCount % 10 === 0) {
        console.log(`Migrated ${migratedCount}/${users.length} users...`);
      }
    }

    console.log(`Migration complete! Successfully migrated ${migratedCount} users.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateUsers();
