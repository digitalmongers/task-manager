export const PLAN_LIMITS = {
  FREE: {
    monthlyBoosts: 100,
    maxBoostsPerRequest: 1,
    maxOutputTokens: 1000, // Increased from 300 to 1000 to prevent truncation
    aiFeatures: ["TASK_SUGGESTION", "VOICE_TASK", "AI_INSIGHTS", "AI_PLANNER"],
    maxCollaborators: 1,
    pricing: { monthly: 0, yearly: 0 }
  },

  STARTER: {
    monthlyBoosts: 1000,
    maxBoostsPerRequest: 1,
    maxOutputTokens: 1000, // Increased from 600 to 1000
    aiFeatures: ["TASK_SUGGESTION", "VOICE_TASK", "CHAT"],
    maxCollaborators: 5,
    pricing: { monthly: 12, yearly: 120 }
  },

  PRO: {
    monthlyBoosts: 2000,
    maxBoostsPerRequest: 2,
    maxOutputTokens: 1000,
    aiFeatures: ["TASK_SUGGESTION", "VOICE_TASK", "AI_INSIGHTS", "AI_PLANNER", "CHAT"],
    maxCollaborators: 25,
    pricing: { monthly: 29, yearly: 290 }
  },

  TEAM: {
    monthlyBoosts: 4500,
    maxBoostsPerRequest: 3,
    maxOutputTokens: 1500,
    aiFeatures: ["ALL"],
    maxCollaborators: 50,
    pricing: { monthly: 49, yearly: 490 }
  }
};

export const AI_CONSTANTS = {
  MODEL: 'gpt-4o',
  BOOST_TOKEN_VALUE: 2000,
  MAX_INPUT_TOKENS: 2000,
  COMPRESS_THRESHOLD_TOKENS: 1200,
  ABSOLUTE_FAILSAFE_TOKENS: 4000
};
export const RAZORPAY_PLANS = {
  STARTER: {
    MONTHLY: 'plan_S0ZzfdHQXxmTz4',
    YEARLY: 'plan_S0a8hfrbEqtlwA'
  },
  PRO: {
    MONTHLY: 'plan_S0a0PjKXU7bdfy',
    YEARLY: 'plan_S0a9RW9UJcMsP1'
  },
  TEAM: {
    MONTHLY: 'plan_S0a0tJ2nJDmv50',
    YEARLY: 'plan_S0aB2BETGdvfgQ'
  }
};

// Top-up packages for purchasing additional boosts
// These are one-time purchases that add boosts to user's current plan
export const TOPUP_PACKAGES = {
  SMALL: {
    boosts: 200,
    price: 5,
    currency: 'USD',
    name: 'Small Boost Pack',
    description: '200 AI Boosts'
  },
  MEDIUM: {
    boosts: 500,
    price: 10,
    currency: 'USD',
    name: 'Medium Boost Pack',
    description: '500 AI Boosts'
  },
  LARGE: {
    boosts: 1500,
    price: 25,
    currency: 'USD',
    name: 'Large Boost Pack',
    description: '1500 AI Boosts'
  },
  XLARGE: {
    boosts: 3500,
    price: 49,
    currency: 'USD',
    name: 'XLarge Boost Pack',
    description: '3500 AI Boosts'
  }
};

// ========== ENTERPRISE WHITELIST ==========
// Users in this list get unlimited AI access and auto-creation
export const WHITELISTED_EMAILS = [
  "parasmourya288@gmail.com"
];

// Default password for auto-created enterprise users
export const DEFAULT_ENTERPRISE_PASSWORD = "Enterprise@123";

