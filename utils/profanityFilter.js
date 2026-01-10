/**
 * Profanity Filter Utility
 * Supports English and Hindi slangs + AI Moderation
 */

import openai from '../config/openai.js';
import Logger from '../config/logger.js';

const BAD_WORDS = [
  // English (Common)
  'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'nigger', 'cunt', 'dick', 'pussy',
  // Hindi (Common/Slangs)
  'gaali', 'harami', 'kamina', 'saala', 'chutiya', 'bhanchod', 'madarchod', 'gand', 'gaand', 'lodu', 'betichod'
  // Note: This is an illustrative list. In production, consider a much larger curated list or external dataset.
];

class ProfanityFilter {
  constructor() {
    this.words = new Set(BAD_WORDS);
    // Create a regex for faster matching (case-insensitive)
    this.regex = new RegExp(`\\b(${BAD_WORDS.join('|')})\\b`, 'gi');
  }

  /**
   * Replace profanity with asterisks
   */
  clean(text) {
    if (!text || typeof text !== 'string') return text;
    
    return text.replace(this.regex, (match) => {
      return '*'.repeat(match.length);
    });
  }

  /**
   * Check if text violates safety policies using AI
   * (OpenAI Moderation Endpoint)
   */
  async isFlaggedByAI(text) {
    if (!text || typeof text !== 'string') return false;

    try {
      const response = await openai.moderations.create({ input: text });
      const results = response.results[0];
      
      if (results.flagged) {
        Logger.warn('AI Moderation Flagged Content', { 
          categories: results.categories,
          scores: results.category_scores 
        });
      }

      return results.flagged;
    } catch (error) {
      Logger.error('AI Moderation Check Failed', { error: error.message });
      // In case of AI failure, we fall back to false (allow) or true (block)
      // Usually better to allow and rely on static list to avoid service disruption
      return false;
    }
  }

  /**
   * Custom add/remove words if needed dynamically
   */
  addWords(newWords) {
    if (Array.isArray(newWords)) {
      newWords.forEach(w => this.words.add(w.toLowerCase()));
      this.regex = new RegExp(`\\b(${Array.from(this.words).join('|')})\\b`, 'gi');
    }
  }
}

export default new ProfanityFilter();
