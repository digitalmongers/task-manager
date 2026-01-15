import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import CollaborationRepository from '../repositories/collaborationRepository.js';
import User from '../models/User.js';
import TeamMember from '../models/TeamMember.js';
import TaskInvitation from '../models/TaskInvitation.js';
import TaskCollaborator from '../models/TaskCollaborator.js';
import AuthService from '../services/authService.js';

dotenv.config();

const resultsPath = 'scripts/verification_results.txt';
function log(msg) {
  console.log(msg);
  fs.appendFileSync(resultsPath, msg + '\n');
}

async function runVerification() {
  if (fs.existsSync(resultsPath)) fs.unlinkSync(resultsPath);
  log('--- Starting Collaborator Limit Verification ---');
  
  // Connect to DB
  log('Connecting to DB...');
  await mongoose.connect(process.env.MONGO_URI);
  log('Connected to Database successfully');

  const ownerId = new mongoose.Types.ObjectId();
  const ownerEmail = `owner_${Date.now()}@example.com`;
  
  try {
    // 1. Setup Mock Owner
    await User.create({
      _id: ownerId,
      firstName: 'Owner',
      lastName: 'Test',
      email: ownerEmail,
      password: 'Password123!',
      termsAccepted: true,
      plan: 'FREE' // Limit 1
    });
    console.log('Created test owner');

    // 2. Test Expired Invitation (Should NOT count)
    const expiredToken = 'expired_' + Date.now();
    await TaskInvitation.create({
      task: new mongoose.Types.ObjectId(),
      inviteeEmail: 'expired@example.com',
      inviter: ownerId,
      invitationToken: expiredToken,
      expiresAt: new Date(Date.now() - 1000) // 1 second ago
    });
    console.log('Created expired invitation');

    let globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Exp should be 0):', globalCollabs.size);
    if (globalCollabs.size !== 0) throw new Error('Expired invitation was counted!');

    // 3. Test Active Invitation (Should count)
    const activeToken = 'active_' + Date.now();
    await TaskInvitation.create({
      task: new mongoose.Types.ObjectId(),
      inviteeEmail: 'active@example.com',
      inviter: ownerId,
      invitationToken: activeToken,
      expiresAt: new Date(Date.now() + 100000)
    });
    console.log('Created active invitation');

    globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Should be 1):', globalCollabs.size);
    if (globalCollabs.size !== 1) throw new Error('Active invitation NOT counted!');

    // 4. Test Owner Email (Should NOT count)
    await TeamMember.create({
      owner: ownerId,
      memberEmail: ownerEmail,
      invitedBy: ownerId,
      status: 'active'
    });
    console.log('Added owner as team member (self-invite simulation)');

    globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Should still be 1, owner email ignored):', globalCollabs.size);
    if (globalCollabs.size !== 1) throw new Error('Owner email was counted!');

    // 5. Test Removal (Should free slot)
    await TaskInvitation.deleteOne({ inviteeEmail: 'active@example.com' });
    console.log('Deleted active invitation');

    globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Should be 0 after removal):', globalCollabs.size);
    if (globalCollabs.size !== 0) throw new Error('Slot NOT freed after removal!');

    // 6. Test Account Deletion Cascade
    const collabUserId = new mongoose.Types.ObjectId();
    const collabEmail = `collab_${Date.now()}@example.com`;
    const collaborator = await User.create({
      _id: collabUserId,
      firstName: 'Collab',
      lastName: 'Test',
      email: collabEmail,
      password: 'Password123!',
      termsAccepted: true
    });
    
    await TaskCollaborator.create({
      task: new mongoose.Types.ObjectId(),
      taskOwner: ownerId,
      collaborator: collabUserId,
      sharedBy: ownerId,
      status: 'active'
    });
    console.log('Created collaborator user and association');

    globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Should be 1):', globalCollabs.size);

    console.log('Deleting collaborator account...');
    await AuthService.systemHardDeleteUser(collabUserId);
    
    globalCollabs = await CollaborationRepository.getGlobalCollaboratorEmails(ownerId);
    console.log('Global Collabs (Should be 0 after collab account deletion):', globalCollabs.size);
    if (globalCollabs.size !== 0) throw new Error('Slot NOT freed after account deletion!');

    console.log('\n--- ALL VERIFICATIONS PASSED ---');

  } catch (error) {
    console.error('VERIFICATION FAILED:', error);
  } finally {
    // Cleanup
    await User.deleteMany({ _id: { $in: [ownerId] } });
    await TaskInvitation.deleteMany({ inviter: ownerId });
    await TaskCollaborator.deleteMany({ taskOwner: ownerId });
    await TeamMember.deleteMany({ owner: ownerId });
    await mongoose.disconnect();
    process.exit();
  }
}

runVerification();
