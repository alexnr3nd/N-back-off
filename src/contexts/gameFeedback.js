// src/contexts/gameFeedback.js
import { FEEDBACK_MESSAGES, PROTOCOL_TIPS, FEATURE_INTRODUCTION, DIFFICULTY_TIERS } from '../constants/gameConstants';
import { getTierName } from './gameHelpers';

/**
 * Generate a feedback message based on game results
 * @param {Object} results Game results object
 * @param {number} difficulty Previous difficulty level
 * @returns {string} A feedback message
 */
export const generateFeedbackMessage = (results, difficulty) => {
  const { difficultyAdjustment } = results;
  const previousTier = getTierName(difficulty);
  
  // Choose appropriate message based on difficulty adjustment
  if (difficultyAdjustment > 0.0) {
    // Increased difficulty
    const messagePool = difficultyAdjustment >= 0.1 
      ? FEEDBACK_MESSAGES.DIFFICULTY_INCREASE.LARGE 
      : FEEDBACK_MESSAGES.DIFFICULTY_INCREASE.SMALL;
    
    return getRandomMessage(messagePool);
  } else if (difficultyAdjustment < 0.0) {
    // Decreased difficulty
    let messagePool;
    
    if (difficultyAdjustment <= -0.15) {
      messagePool = FEEDBACK_MESSAGES.DIFFICULTY_DECREASE.LARGE;
    } else if (difficultyAdjustment <= -0.1) {
      messagePool = FEEDBACK_MESSAGES.DIFFICULTY_DECREASE.MEDIUM;
    } else {
      messagePool = FEEDBACK_MESSAGES.DIFFICULTY_DECREASE.SMALL;
    }
    
    return getRandomMessage(messagePool);
  } else {
    // Maintained difficulty
    const message = getRandomMessage(FEEDBACK_MESSAGES.DIFFICULTY_MAINTAINED);
    return message.replace('{tierName}', previousTier);
  }
};

/**
 * Get a random protocol tip
 * @returns {string} A random protocol tip
 */
export const getCoachingMessage = () => {
  return getRandomMessage(PROTOCOL_TIPS);
};

/**
 * Get a feature introduction message based on difficulty level
 * @param {number} difficulty Current difficulty level
 * @returns {string|null} Feature introduction message or null if none
 */
export const getFeatureIntroMessage = (difficulty) => {
  // Check if any feature is being introduced at this difficulty level
  for (const [difficultyThreshold, message] of Object.entries(FEATURE_INTRODUCTION)) {
    // Convert string key to number for comparison
    const threshold = parseFloat(difficultyThreshold);
    
    // If difficulty just crossed the threshold, return the message
    if (difficulty >= threshold && difficulty < threshold + 0.05) {
      return message;
    }
  }
  
  return null;
};

/**
 * Get a random message from an array of messages
 * @param {Array} messages Array of message strings
 * @returns {string} A random message
 */
const getRandomMessage = (messages) => {
  if (!messages || messages.length === 0) return '';
  
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
};

export default {
  generateFeedbackMessage,
  getCoachingMessage,
  getFeatureIntroMessage
};