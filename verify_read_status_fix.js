import 'dotenv/config';
import mongoose from 'mongoose';
import ChatService from './services/chatService.js';
import ChatReadState from './models/ChatReadState.js';
import TaskMessage from './models/TaskMessage.js';
import Task from './models/Task.js';
import User from './models/User.js';
import chatService from './services/chatService.js';

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

        console.log('Simulating 20 concurrent markAsRead calls...');
        // This simulates the race condition where both requests try to upsert at the same time
        const concurrentCalls = Array(20).fill().map(() => chatService.markAsRead(task._id, user._id, false));
        const results = await Promise.allSettled(concurrentCalls);

        let failed = false;
        results.forEach((res, i) => {
            if (res.status === 'rejected') {
                console.error(`Call ${i} failed:`, res.reason.message);
                failed = true;
            }
        });

        if (failed) {
            console.error('VERIFICATION FAILED: Some concurrent calls failed');
            process.exit(1);
        }

        const successfulCount = results.filter(r => r.status === 'fulfilled').length;
        if (successfulCount === 20) {
            console.log(`\nFINAL VERIFICATION PASSED: All ${successfulCount} concurrent calls finished successfully!`);
        } else {
            console.log(`\nFAILURE: Only ${successfulCount} calls succeeded out of 20.`);
            process.exit(1);
        }

        const finalState = await ChatReadState.findOne({ user: user._id, task: task._id });
        console.log('Final Read State:', finalState);
        process.exit(0);
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
