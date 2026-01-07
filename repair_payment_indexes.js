
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Payment from './models/Payment.js';

dotenv.config();

const repairIndexes = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected!');

    const collection = mongoose.connection.collection('payments');
    
    console.log('Listing current indexes...');
    const indexes = await collection.indexes();
    console.log(indexes.map(idx => idx.name));

    const indexesToDrop = ['razorpayOrderId_1', 'razorpaySubscriptionId_1'];
    
    for (const indexName of indexesToDrop) {
      if (indexes.some(idx => idx.name === indexName)) {
        console.log(`Dropping index: ${indexName}...`);
        await collection.dropIndex(indexName);
        console.log(`Dropped ${indexName}`);
      } else {
        console.log(`Index ${indexName} not found, skipping.`);
      }
    }

    console.log('Recreating indexes via Mongoose...');
    await Payment.createIndexes();
    
    console.log('Verifying new indexes...');
    const newIndexes = await collection.indexes();
    console.log('Final indexes:', newIndexes.map(idx => ({ 
        name: idx.name, 
        unique: idx.unique, 
        sparse: idx.sparse 
    })));

    console.log('✅ Repair completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Repair failed:', error);
    process.exit(1);
  }
};

repairIndexes();
