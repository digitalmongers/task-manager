import 'dotenv/config';
import ProfanityFilter from './utils/profanityFilter.js';
import Logger from './config/logger.js';

async function testModeration() {
  const tests = [
    { text: "Hello, how are you?", description: "Clean message" },
    { text: "I want to kill you", description: "Violence check" },
    { text: "This is hate speech against your group", description: "Hate speech check" },
    { text: "I hate you so much you should die", description: "Harassment check" },
  ];

  console.log("\n--- Starting AI Moderation Test ---\n");

  for (const t of tests) {
    console.log(`Testing: "${t.text}" (${t.description})`);
    try {
      const isFlagged = await ProfanityFilter.isFlaggedByAI(t.text);
      console.log(`Result: ${isFlagged ? '🚩 FLAGGED' : '✅ CLEAN'}`);
    } catch (error) {
      console.error(`Error testing: ${error.message}`);
    }
    console.log("-----------------------------------\n");
  }
}

testModeration();
