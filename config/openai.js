import OpenAI from 'openai';
import Logger from './logger.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Test connection on startup
const testConnection = async () => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      Logger.warn('OPENAI_API_KEY not configured - AI features will be disabled');
      return false;
    }

    await openai.models.list();
    Logger.info('✅ OpenAI connection successful', {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });
    return true;
  } catch (error) {
    Logger.error('❌ OpenAI connection failed', { 
      error: error.message,
      hint: 'Check OPENAI_API_KEY in .env file'
    });
    return false;
  }
};

// Get OpenAI configuration
const getConfig = () => ({
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 500,
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
});

export { openai, testConnection, getConfig };
export default openai;
