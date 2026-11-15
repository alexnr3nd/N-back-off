/* src/utils/weeklyTrackerUtils.js */
import { isSameDay } from './dateUtils';

/**
 * Calculate which days of the current week have sessions
 * @param {Array} sessions - Array of session objects with date property
 * @returns {Array} - Array of boolean values indicating activity for each day (Monday to Sunday)
 */
export const calculateWeeklyActivity = (sessions) => {
  // Return empty array if no sessions
  if (!sessions || sessions.length === 0) return Array(7).fill(false);
  
  // Get current date and calculate the start of the week (Monday)
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  
  // Adjust for our display where Monday is first (0) and Sunday is last (6)
  const displayCurrentDay = currentDay === 0 ? 6 : currentDay - 1;
  
  // Calculate the date for Monday of this week
  const monday = new Date(today);
  monday.setDate(today.getDate() - displayCurrentDay);
  monday.setHours(0, 0, 0, 0);
  
  // Create array of dates for this week
  const weekDates = Array(7).fill().map((_, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return date;
  });
  
  // Check which days have sessions
  return weekDates.map(date => {
    // Find if there's any session on this date
    return sessions.some(session => {
      if (!session.date) return false;
      const sessionDate = new Date(session.date);
      return isSameDay(sessionDate, date);
    });
  });
};

/**
 * Get the count of days with activity in the current week
 * @param {Array} sessions - Array of session objects with date property
 * @returns {number} - Number of days with activity
 */
export const getWeeklyCompletionCount = (sessions) => {
  const weeklyActivity = calculateWeeklyActivity(sessions);
  return weeklyActivity.filter(Boolean).length;
};

/**
 * Get today's index in our week display (0 = Monday, 6 = Sunday)
 * @returns {number} - Index of today in the week (0-6)
 */
export const getTodayIndex = () => {
  const today = new Date();
  return today.getDay() === 0 ? 6 : today.getDay() - 1;
};