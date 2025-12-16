
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Task from './models/Task.js';
import TaskCollaborator from './models/TaskCollaborator.js';
import User from './models/User.js';

dotenv.config();

const run = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        // unique suffix
        const suffix = Date.now().toString();

        // 1. Create a dummy user (collaborator)
        const collaborator = await User.create({
            firstName: 'TestCollab',
            lastName: 'User',
            email: `collab_${suffix}@example.com`,
            password: 'password123',
            passwordConfirm: 'password123'
        });
        console.log('Created collaborator:', collaborator._id);

        // 2. Create a dummy user (owner)
        const owner = await User.create({
            firstName: 'TestOwner',
            lastName: 'User',
            email: `owner_${suffix}@example.com`,
            password: 'password123',
            passwordConfirm: 'password123'
        });
         console.log('Created owner:', owner._id);

        // 3. Create a task
        const task = await Task.create({
            title: 'Test Task for Crash',
            user: owner._id,
        });
        console.log('Created task:', task._id);

        // 4. Create collaboration
        await TaskCollaborator.create({
             task: task._id,
             taskOwner: owner._id,
             collaborator: collaborator._id,
             role: 'editor',
             sharedBy: owner._id
        });
        console.log('Created collaboration');

        // 5. Soft Delete the task (this is the key step!)
        // The default find hook in Task model filters out deleted tasks
        task.isDeleted = true;
        await task.save();
        console.log('Soft deleted task');
        
        // 6. Call getSharedTasks
        console.log('Calling getSharedTasks...');
        try {
            const results = await Task.getSharedTasks(collaborator._id);
            console.log('Success! Results:', results);
        } catch (error) {
            console.error('CAUGHT EXPECTED ERROR:', error);
        }

        // Cleanup
        await TaskCollaborator.deleteMany({ task: task._id });
        await Task.deleteOne({ _id: task._id });
        await User.deleteMany({ _id: { $in: [collaborator._id, owner._id] } });
        console.log('Cleanup done');

    } catch (error) {
        console.error('Unexpected error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
