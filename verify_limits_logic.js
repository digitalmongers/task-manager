import mongoose from 'mongoose';
import dotenv from 'dotenv';
import CollaborationRepository from './repositories/collaborationRepository.js';
import User from './models/User.js';
import { PLAN_LIMITS } from './config/aiConfig.js';

dotenv.config();

async function verify() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const testUser = await User.findOne({ email: 'parasmourya288@gmail.com' });
    if (!testUser) {
      console.log('User not found');
      return;
    }

    console.log(`Testing for User: ${testUser.email} (Plan: ${testUser.plan || 'FREE'})`);

    const emailsSet = await CollaborationRepository.getGlobalCollaboratorEmails(testUser._id);
    console.log('Unique Collaborators Emails:', Array.from(emailsSet));
    console.log('Count:', emailsSet.size);

    const plan = PLAN_LIMITS[testUser.plan || 'FREE'];
    console.log(`Plan Limit: ${plan.maxCollaborators}`);

    if (emailsSet.size > plan.maxCollaborators) {
      console.log('⚠️ LIMIT EXCEEDED! (Though expected if manually added previously)');
    } else {
      console.log('✅ Within limits');
    }

    // Test specific email
    const testEmail = 'test@example.com';
    const wouldExceed = !emailsSet.has(testEmail) && emailsSet.size >= plan.maxCollaborators;
    console.log(`Would inviting ${testEmail} exceed limit? ${wouldExceed}`);

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

verify();
