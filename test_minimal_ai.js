
import dotenv from 'dotenv';
import AIService from './services/ai/aiService.js';

dotenv.config();

console.log('--- AIService Integration Test ---');
try {
  console.log('AIService.isEnabled():', AIService.isEnabled());
  console.log('AIService.openai exists:', !!AIService.openai);
  console.log('--- TEST PASSED ---');
} catch (e) {
  console.error('--- TEST FAILED ---');
  console.error(e);
}
process.exit(0);
