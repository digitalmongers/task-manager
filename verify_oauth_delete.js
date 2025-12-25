import "dotenv/config";
import mongoose from 'mongoose';
import User from './models/User.js';
import AuthService from './services/authService.js';
import { connectDB } from './config/db.js';

async function verify() {
  try {
    await connectDB();
    console.log('Connected to MongoDB');

    // 1. Create a dummy GOOGLE user (no password)
    const email = `test_oauth_del_${Date.now()}@example.com`;
    const user = await User.create({
      firstName: 'OAuth',
      lastName: 'User',
      email,
      googleId: 'google123',
      authProvider: 'google',
      isEmailVerified: true,
      termsAccepted: true
    });
    console.log('Created test OAuth user:', user.email);

    // 2. Attempt to delete account WITHOUT password
    try {
      const result = await AuthService.deleteAccount(user._id, null, { ip: '127.0.0.1', get: () => 'test-ua' });
      console.log('Account deletion result:', result.message);
      
      const deletedUser = await User.findById(user._id);
      console.log('User isActive after deletion:', deletedUser.isActive);
      
      if (!deletedUser.isActive) {
        console.log('SUCCESS: OAuth account deleted without password');
      } else {
        console.log('FAILED: OAuth account still active');
      }
    } catch (error) {
      console.error('FAILED: Error during deletion:', error.message);
    }

    // Cleanup
    await User.deleteOne({ _id: user._id });
    console.log('Cleaned up test user');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Verification script failed:', error);
    process.exit(1);
  }
}

verify();
