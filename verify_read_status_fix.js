
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import chatService from './services/chatService.js';
import User from './models/User.js';
import Task from './models/Task.js';
import TaskMessage from './models/TaskMessage.js';
import ChatReadState from './models/ChatReadState.js';

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const suffix = Date.now().toString();
        const user = await User.create({
            firstName: 'Verify',
            lastName: 'Read',
            email: `verify_read_${suffix}@example.com`,
            password: 'Password123!',
            isEmailVerified: true
        });

        const task = await Task.create({
            title: 'Verify Read Task',
            user: user._id
        });

        const message = await TaskMessage.create({
            task: task._id,
            sender: user._id,
            content: 'Test Message',
            sequenceNumber: 1
        });

        console.log('Simulating concurrent markAsRead calls...');
        // This simulates the race condition where both requests try to upsert at the same time
        const results = await Promise.allSettled([
            chatService.markAsRead(task._id, user._id, false),
            chatService.markAsRead(task._id, user._id, false)
        ]);

        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                console.log(`Call ${i + 1} succeeded:`, res.value);
            } else {
                console.error(`Call ${i + 1} FAILED:`, res.reason);
            }
        });

        const successfulCount = results.filter(r => r.status === 'fulfilled').length;
        if (successfulCount === 2) {
            console.log('\nFINAL VERIFICATION PASSED: Both concurrent calls finished successfully!');
        } else {
            console.log('\nFAILURE: One or more calls failed.');
        }

        const readState = await ChatReadState.findOne({ user: user._id, task: task._id });
        console.log('Read State in DB:', readState);

        // Cleanup
        await ChatReadState.deleteOne({ _id: readState?._id });
        await TaskMessage.deleteOne({ _id: message._id });
        await Task.deleteOne({ _id: task._id });
        await User.deleteOne({ _id: user._id });
        console.log('Cleanup done');

        if (successfulCount === 2) {
            console.log('EXITING_WITH_SUCCESS');
            process.exit(0);
        } else {
            console.log('EXITING_WITH_FAILURE');
            process.exit(1);
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        process.exit(1);
    }
};

run();
