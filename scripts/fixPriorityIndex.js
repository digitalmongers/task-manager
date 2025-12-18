import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Logger from '../config/logger.js';

// Load environment variables
dotenv.config();

/**
 * Migration script to fix TaskPriority index
 * This drops the old unique index and creates a new partial index
 * that only applies to non-deleted priorities
 */
async function fixPriorityIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    Logger.info('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('taskpriorities');

    // Get existing indexes
    const indexes = await collection.indexes();
    Logger.info('Current indexes:', indexes);

    // Drop the old unique index on user + name
    try {
      await collection.dropIndex('user_1_name_1');
      Logger.info('✅ Dropped old unique index: user_1_name_1');
    } catch (error) {
      if (error.code === 27) {
        Logger.warn('Index user_1_name_1 does not exist, skipping drop');
      } else {
        throw error;
      }
    }

    // Create new partial unique index
    await collection.createIndex(
      { user: 1, name: 1 },
      {
        unique: true,
        partialFilterExpression: { isDeleted: { $ne: true } },
        name: 'user_1_name_1'
      }
    );
    Logger.info('✅ Created new partial unique index with isDeleted filter');

    // Verify new indexes
    const newIndexes = await collection.indexes();
    Logger.info('Updated indexes:', newIndexes);

    Logger.info('🎉 Index migration completed successfully!');
    process.exit(0);
  } catch (error) {
    Logger.error('❌ Error during index migration:', error);
    process.exit(1);
  }
}

// Run the migration
fixPriorityIndex();
