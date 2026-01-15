import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TeamService from '../services/TeamService.js';
import TeamMember from '../models/TeamMember.js';
import User from '../models/User.js';

dotenv.config();

async function runVerification() {
  console.log('--- Starting Team Member Re-invitation Verification ---');
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to Database');

  const ownerId = new mongoose.Types.ObjectId();
  const collabEmail = `collab_reinvite_${Date.now()}@example.com`;
  
  try {
    // 1. Setup Owner
    await User.create({
      _id: ownerId,
      firstName: 'Owner',
      lastName: 'Test',
      email: `owner_reinvite_${Date.now()}@example.com`,
      password: 'Password123!',
      termsAccepted: true
    });
    console.log('Created test owner');

    // 2. Invite Collaborator
    console.log('First invitation...');
    await TeamService.inviteTeamMember(ownerId, collabEmail, 'editor');
    
    const member = await TeamMember.findOne({ owner: ownerId, memberEmail: collabEmail });
    console.log('Member status (should be pending):', member.status);

    // 3. Remove Member
    console.log('Removing member...');
    await member.removeMember(ownerId);
    console.log('Member status (should be removed):', (await TeamMember.findOne({ owner: ownerId, memberEmail: collabEmail })).status);

    // 4. Invite Again (This used to crash)
    console.log('Second invitation (re-invite)...');
    try {
      await TeamService.inviteTeamMember(ownerId, collabEmail, 'viewer');
      console.log('Second invitation successful! Fix works.');
      
      const newMember = await TeamMember.findOne({ owner: ownerId, memberEmail: collabEmail });
      console.log('New member status (should be pending):', newMember.status);
      console.log('New member role (should be viewer):', newMember.role);
    } catch (error) {
      console.error('Re-invitation FAILED:', error);
      throw error;
    }

    console.log('\n--- VERIFICATION PASSED ---');

  } catch (error) {
    console.error('VERIFICATION FAILED:', error);
  } finally {
    await User.deleteMany({ _id: ownerId });
    await TeamMember.deleteMany({ owner: ownerId });
    await mongoose.disconnect();
    process.exit();
  }
}

runVerification();
