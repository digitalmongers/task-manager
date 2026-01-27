/**
 * AI Helper Functions
 * Utility functions for AI processing
 */

import Logger from '../../config/logger.js';

/**
 * Parse JSON response from OpenAI
 */
export const parseJSONResponse = (response) => {
  try {
    // Remove markdown code blocks if present
    let cleaned = response.trim();
    cleaned = cleaned.replace(/```json\n?/g, '');
    cleaned = cleaned.replace(/```\n?/g, '');
    cleaned = cleaned.trim();
    
    return JSON.parse(cleaned);
  } catch (error) {
    Logger.error('Failed to parse AI response', { 
      error: error.message,
      responseLength: response.length,
      responseEnd: response.substring(response.length - 100), // Log the end of string to see if it's truncated
      fullResponse: response // Adding full response for debugging as it's usually not that large (~1kb)
    });
    throw new Error('Invalid AI response format');
  }
};

/**
 * Sanitize user input for AI prompts
 */
export const sanitizeInput = (input) => {
  if (!input) return '';
  
  // Remove excessive whitespace
  let sanitized = input.trim().replace(/\s+/g, ' ');
  
  // Limit length
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }
  
  return sanitized;
};

/**
 * Format user context for AI
 */
export const formatUserContext = (categories, priorities, statuses) => {
  return {
    categories: categories?.map(c => c.title || c.name) || [],
    priorities: priorities?.map(p => p.name) || [],
    statuses: statuses?.map(s => s.name) || [],
  };
};

/**
 * Validate AI suggestions
 * @param {Object|Array} suggestions - The suggestions to validate
 * @param {string} type - The type of suggestion (task, category, priority, status)
 * @returns {boolean} - Whether the suggestions are valid
 */
export const validateSuggestions = (suggestions, type) => {
  if (!suggestions) {
    Logger.error('Validation failed: Suggestions object is empty');
    return false;
  }

  // Handle array of suggestions (e.g. for tasks)
  if (Array.isArray(suggestions)) {
    if (suggestions.length === 0) {
      Logger.error('Validation failed: Suggestions array is empty');
      return false;
    }
    return suggestions.every((s, index) => {
      const isValid = validateSingleSuggestion(s, type);
      if (!isValid) {
        Logger.error(`Validation failed for suggestion at index ${index}`, { suggestion: s, type });
      }
      return isValid;
    });
  }

  // Handle single suggestion object
  const isValid = validateSingleSuggestion(suggestions, type);
  if (!isValid) {
    Logger.error('Validation failed for single suggestion', { suggestion: suggestions, type });
  }
  return isValid;
};

/**
 * Internal helper to validate a single suggestion object
 */
const validateSingleSuggestion = (s, type) => {
  if (!s || typeof s !== 'object') return false;

  switch (type) {
    case 'task':
      return typeof s.title === 'string' && s.title.length > 0;
    
    case 'category':
      // The prompt says "title" can be null if invalid, but for a valid suggestion we expect it.
      // However, the prompts define the schema as "string or null".
      // Let's be flexible: if it has the key, it's structurally valid.
      return 'title' in s && 'color' in s;
    
    case 'priority':
      // Structurally check if fields exist as per PRIORITY_PROMPTS
      return 'name' in s && 'color' in s;
    
    case 'status':
      return 'name' in s && 'color' in s;
    
    default:
      return true;
  }
};


/**
 * Handle AI errors gracefully
 */
export const handleAIError = (error, context) => {
  Logger.error('AI Service Error', {
    error: error.message,
    errorType: error.constructor.name,
    statusCode: error.status || error.statusCode,
    errorCode: error.code,
    context,
    stack: error.stack,
  });
  
  // Return user-friendly error message based on error type
  const errorMessage = error.message?.toLowerCase() || '';
  
  // Check for API key issues
  if (errorMessage.includes('api key') || errorMessage.includes('invalid_api_key') || error.status === 401) {
    return { error: 'AI service not configured properly. Please contact administrator.' };
  }
  
  // Check for rate limiting
  if (errorMessage.includes('rate limit') || errorMessage.includes('rate_limit_exceeded') || error.status === 429) {
    return { error: 'AI service rate limit exceeded. Please try again in a few moments.' };
  }
  
  // Check for quota/billing issues
  if (errorMessage.includes('quota') || errorMessage.includes('insufficient_quota') || errorMessage.includes('billing')) {
    return { error: 'AI service quota exceeded. Please contact administrator to upgrade plan.' };
  }
  
  // Check for model not found
  if (errorMessage.includes('model') && errorMessage.includes('not found')) {
    return { error: 'AI model not available. Please contact administrator.' };
  }
  
  // Check for timeout
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return { error: 'AI service timeout. Please try again.' };
  }
  
  // Generic error with actual error message for debugging
  Logger.warn('Unhandled AI error type', { 
    message: error.message,
    status: error.status,
    code: error.code 
  });
  
  return { error: `Failed to generate AI suggestions: ${error.message || 'Please try again.'}` };
};

/**
 * Cache key generator
 */
export const generateCacheKey = (type, data) => {
  const key = `ai:${type}:${JSON.stringify(data)}`;
  return key.substring(0, 200); // Limit key length
};

/**
 * Extract keywords from text
 */
export const extractKeywords = (text) => {
  if (!text) return [];
  
  // Simple keyword extraction (can be enhanced)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Remove duplicates
  return [...new Set(words)].slice(0, 5);
};

/**
 * Calculate similarity score between two texts
 */
export const calculateSimilarity = (text1, text2) => {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
};

/**
 * Format date for AI
 */
export const formatDateForAI = (date) => {
  if (!date) return null;
  
  try {
    const d = new Date(date);
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  } catch (error) {
    return null;
  }
};

/**
 * Parse AI date response
 */
export const parseAIDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    // Handle various date formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date;
  } catch (error) {
    return null;
  }
};

/**
 * Truncate text for AI input
 */
export const truncateText = (text, maxLength = 200) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

/**
 * Merge AI suggestions with user data
 */
export const mergeSuggestions = (userData, aiSuggestions) => {
  return {
    ...aiSuggestions,
    ...userData, // User data takes precedence
  };
};
