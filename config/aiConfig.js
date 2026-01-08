export const PLAN_LIMITS = {
  FREE: {
    monthlyBoosts: 20,
    maxBoostsPerRequest: 1,
    maxOutputTokens: 1000, // Increased from 300 to 1000 to prevent truncation
    aiFeatures: ["TASK_SUGGESTION"],
    maxCollaborators: 1,
    pricing: { monthly: 0, yearly: 0 }
  },

  STARTER: {
    monthlyBoosts: 200,
    maxBoostsPerRequest: 1,
    maxOutputTokens: 1000, // Increased from 600 to 1000
    aiFeatures: ["TASK_SUGGESTION", "VOICE_TASK", "CHAT"],
    maxCollaborators: 5,
    pricing: { monthly: 12, yearly: 120 }
  },

  PRO: {
    monthlyBoosts: 800,
    maxBoostsPerRequest: 2,
    maxOutputTokens: 1000,
    aiFeatures: ["TASK_SUGGESTION", "VOICE_TASK", "AI_INSIGHTS", "AI_PLANNER", "CHAT"],
    maxCollaborators: 25,
    pricing: { monthly: 29, yearly: 290 }
  },

  TEAM: {
    monthlyBoosts: 3000,
    maxBoostsPerRequest: 3,
    maxOutputTokens: 1500,
    aiFeatures: ["ALL"],
    maxCollaborators: 50,
    pricing: { monthly: 49, yearly: 490 }
  }
};

export const AI_CONSTANTS = {
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
