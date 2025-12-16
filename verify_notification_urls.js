
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Notification from './models/Notification.js';
import User from './models/User.js';
import VitalTask from './models/VitalTask.js';
import NotificationService from './services/notificationService.js';

dotenv.config();

const run = async () => {
    try {
        if (!process.env.MONGO_URI) {
           throw new Error('MONGO_URI is not defined in .env');
        }
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const suffix = Date.now().toString();
        // Create Owner
        const owner = await User.create({
            firstName: 'Owner',
            lastName: 'User',
            email: `owner_${suffix}@test.com`,
            password: 'password123',
            passwordConfirm: 'password123'
        });

        // Create Collaborator
        const collaborator = await User.create({
            firstName: 'Collab',
            lastName: 'User',
            email: `collab_${suffix}@test.com`,
            password: 'password123',
            passwordConfirm: 'password123'
        });

        // Create Vital Task
        const vitalTask = await VitalTask.create({
            title: 'Critical Mission',
            user: owner._id,
        });

        console.log('Test Data Created');

        // Trigger Notification: Collaborator Added to Vital Task
        console.log('Triggering notifyCollaboratorAdded (Vital Task)...');
        await NotificationService.notifyCollaboratorAdded(vitalTask, collaborator, owner, true);

        // Verify
        const notification = await Notification.findOne({ recipient: collaborator._id, type: 'vital_task_collaborator_added' });
        
        if (!notification) {
            console.error('FAIL: Notification not found');
        } else {
            console.log('Notification found:', notification.title);
            console.log('Action URL:', notification.actionUrl);
            
            const expectedUrl = `/vital-tasks/${vitalTask._id}`;
            if (notification.actionUrl === expectedUrl) {
                console.log('SUCCESS: Action URL matches expected Vital Task URL');
            } else {
                console.error(`FAIL: Expected ${expectedUrl}, got ${notification.actionUrl}`);
            }
        }

        // Cleanup
        await User.deleteMany({ _id: { $in: [owner._id, collaborator._id] } });
        await VitalTask.deleteOne({ _id: vitalTask._id });
        await Notification.deleteOne({ _id: notification?._id });
        console.log('Cleanup done');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
};

run();
