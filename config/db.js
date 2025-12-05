import mongoose from "mongoose";
import Logger from "./logger.js";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    Logger.info(`MongoDB Connected: ${conn.connection.host}`);

     
    mongoose.connection.on('connected', () => {
      Logger.info('Mongoose connected to MongoDB');
    });

    mongoose.connection.on('error', (err) => {
      Logger.error('Mongoose connection error:', { error: err.message });
    });

    mongoose.connection.on('disconnected', () => {
      Logger.warn('Mongoose disconnected from MongoDB');
    });

    
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      Logger.info('Mongoose connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    Logger.error("MongoDB Connection Error:", { error: error.message });
    process.exit(1);
  }
};
