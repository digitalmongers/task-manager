import TeamService from './services/TeamService.js';
import CollaborationService from './services/collaborationService.js';
import User from './models/User.js';
import TeamMember from './models/TeamMember.js';
import TaskRepository from './repositories/taskRepository.js';
import CollaborationRepository from './repositories/collaborationRepository.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function verifyCollaboratorLimits() {
  console.log('--- Starting Collaborator Limits Verification ---');

  const ownerId = new mongoose.Types.ObjectId();
  const owner = {
    _id: ownerId,
    plan: 'FREE',
    email: 'owner@example.com'
  };

  // Mock User.findById
  User.findById = async (id) => owner;
  
  // Mock TeamMember.countDocuments
  TeamMember.countDocuments = async (query) => {
    console.log('Checking team member count for:', query.owner);
    return 1; // Already has 1 (Limit for FREE is 1)
  };

  try {
    console.log('\n1. Testing Team Invite on FREE plan (Limit 1)');
    try {
      await TeamService.inviteTeamMember(ownerId, 'new@example.com');
    } catch (e) {
      console.log('Caught expected error:', e.message);
    }

    console.log('\n2. Testing Task Invite on FREE plan (Limit 1)');
    // Mock TaskRepository
    TaskRepository.findByIdAndUser = async () => ({ _id: 'task123' });
    // Mock CollaborationRepository
    CollaborationRepository.canUserAccessTask = async () => ({ canAccess: true, role: 'owner' });
    CollaborationRepository.getTaskCollaborators = async () => [ {id: 1} ]; // 1 active
    CollaborationRepository.getTaskInvitations = async () => []; // 0 pending
    
    try {
      await CollaborationService.inviteToTask('task123', ownerId, 'collab@example.com');
    } catch (e) {
      console.log('Caught expected error:', e.message);
    }

    console.log('\n--- Collaborator Verification Finished ---');
  } catch (error) {
    console.error('Verification failed:', error);
  }
}

verifyCollaboratorLimits();
