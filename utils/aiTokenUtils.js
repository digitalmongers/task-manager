import { encoding_for_model } from "@dqbd/tiktoken";
import Logger from '../config/logger.js';

/**
 * Count tokens for a given text using gpt-4o-mini encoding
 * @param {string} text 
 * @returns {number}
 */
export const countTokens = (text) => {
  if (!text) return 0;
  
  let enc;
  try {
    // Attempt to get encoding for gpt-4o-mini
    // If not supported, fallback to cl100k_base (standard for GPT-3.5/4)
    try {
      enc = encoding_for_model("gpt-4o-mini");
    } catch (e) {
      enc = encoding_for_model("gpt-4");
    }
    
    const tokens = enc.encode(text);
    const count = tokens.length;
    
    // Crucial: Free the memory as tiktoken uses WASM
    enc.free();
    
    return count;
  } catch (error) {
    Logger.error('Token counting failed', { error: error.message });
    // Safety fallback: roughly 4 characters per token
    return Math.ceil(text.length / 4);
  }
};

/**
 * Compresses the prompt if it exceeds the threshold
 * @param {string} prompt 
 * @returns {string}
 */
export const compressPrompt = (prompt) => {
  return `Summarize the following context briefly and then complete the task.\n\nContext:\n${prompt}`;
};
