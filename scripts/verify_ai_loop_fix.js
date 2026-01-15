
process.env.OPENAI_API_KEY = 'sk-test-dummy-key-for-verification';
process.env.MONGO_URI = 'mongodb://localhost:27017/task-manager-test';

async function runtest() {
    const mongoose = (await import('mongoose')).default;
    const { default: AIService } = await import('../services/ai/aiService.js');
    const { default: cacheService } = await import('../services/cacheService.js');

    // Mock AI Run to return predictable suggestions
    // We mock the 'run' method which calls OpenAI
    AIService.run = async () => {
        return JSON.stringify([
            { title: "Buy milk", description: "Get 2% milk" },
            { title: "Walk the dog", description: "In the park" }
        ]);
    };

    // We also need to mock cacheService because we don't want to rely on real Redis if not needed,
    // BUT the fix relies on cacheService.get/set.
    // So we will use the REAL cacheService but assumes Redis is running or it fails gracefully?
    // The previous error was OpenAI config. Redis might be fine or fail.
    // If Redis fails, cacheService logs error and returns null.
    // So we might need to MOCK cacheService to make this test robust without Redis.
    
    // In-memory cache mock
    const store = new Map();
    
    cacheService.get = async (key) => {
        const val = store.get(key);
        return val ? JSON.parse(val) : null;
    };
    
    cacheService.set = async (key, value) => {
        store.set(key, JSON.stringify(value));
        return true;
    };
    
    cacheService.remember = async (key, ttl, cb) => {
        // Simple passthrough since we are testing the logic OUTSIDE remember
        return await cb();
    };


    console.log('--- Verifying AI Loop Fix (Mocked Environment) ---');
    const userId = new mongoose.Types.ObjectId(); 

    // 1. First Call
    console.log('1. Simulating initial typing: "Buy"');
    const Result1 = await AIService.generateTaskSuggestions({ 
        title: "Buy", 
        description: "", 
        userId: userId 
    });
    
    console.log('Result 1 Count:', Result1.count);
    if (Result1.suggestions) {
        console.log('Result 1 Suggestions:', Result1.suggestions.map(s => s.title));
    }

    if (Result1.count === 0) {
        console.error('FAIL: Initial call returned no suggestions.');
        return;
    }

    // 2. Select one suggestion
    const selectedTitle = Result1.suggestions[0].title; // "Buy milk"
    console.log(`\n2. Simulating selection: "${selectedTitle}"`);

    // 3. Second Call - Should be BLOCKED
    console.log(`3. Making request with title: "${selectedTitle}"`);
    const Result2 = await AIService.generateTaskSuggestions({ 
        title: selectedTitle, 
        description: "", 
        userId: userId 
    });

    console.log('Result 2 Count:', Result2.count);

    if (Result2.count === 0 && Array.isArray(Result2.suggestions) && Result2.suggestions.length === 0) {
        console.log('SUCCESS: Recursive suggestion was blocked!');
    } else {
        console.error('FAIL: Suggestion was NOT blocked. Loop continues.');
        console.log('Result 2 Suggestions:', Result2.suggestions);
    }
}

runtest().catch(err => console.error(err));
