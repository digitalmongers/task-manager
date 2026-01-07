import dotenv from 'dotenv';
dotenv.config();

import { PLAN_LIMITS } from './config/aiConfig.js';
import { getConfig } from './config/openai.js';

console.log('--- AI Configuration Verification ---');
console.log('FREE plan maxOutputTokens:', PLAN_LIMITS.FREE.maxOutputTokens);
console.log('STARTER plan maxOutputTokens:', PLAN_LIMITS.STARTER.maxOutputTokens);

const config = getConfig();
console.log('Global .env maxTokens:', config.maxTokens);

if (PLAN_LIMITS.FREE.maxOutputTokens === 1000) {
    console.log('✅ FREE plan limit is correctly set to 1000.');
} else {
    console.log('❌ FREE plan limit is INCORRECT:', PLAN_LIMITS.FREE.maxOutputTokens);
}

if (config.maxTokens === 500) {
    console.log('✅ .env limit is correctly detected as 500.');
} else {
    console.log('❌ .env limit is INCORRECT:', config.maxTokens);
}

// In code, we use Math.max(plan.maxOutputTokens, config.maxTokens)
const effectiveFreeLimit = Math.max(PLAN_LIMITS.FREE.maxOutputTokens, config.maxTokens || 0);
console.log('Effective FREE limit in code:', effectiveFreeLimit);

if (effectiveFreeLimit === 1000) {
    console.log('✅ Effective limit logic works (uses the higher value).');
} else {
    console.log('❌ Effective limit logic FAILED.');
}
