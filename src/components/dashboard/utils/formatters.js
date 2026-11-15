/* src/components/dashboard/utils/formatters.js */

/**
 * Format date to display in short format (e.g., "Mar 25, 2025")
 * @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
 * @returns {string} Formatted date string or '-'.
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Check if the date is valid
      if (!(date instanceof Date) || isNaN(date.getTime())) {
          console.warn(`formatDate received invalid dateInput: ${dateInput}`);
          return '-';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
  } catch (error) {
      console.error(`Error formatting date: ${dateInput}`, error);
      return '-';
  }
};

/**
* Format full date and time (e.g., "Mar 25, 3:30 PM")
* @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
* @returns {string} Formatted date and time string or '-'.
*/
export const formatDateTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Check if the date is valid
      if (!(date instanceof Date) || isNaN(date.getTime())) {
          console.warn(`formatDateTime received invalid dateInput: ${dateInput}`);
          return '-';
      }
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        // Optionally add hour12: true/false if you want AM/PM or 24-hour format consistently
        hour12: true
      });
  } catch (error) {
      console.error(`Error formatting date/time: ${dateInput}`, error);
      return '-';
  }
};

/**
* Format time only (e.g., "3:30 PM")
* @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
* @returns {string} Formatted time string or '-'.
*/
export const formatTime = (dateInput) => {
  if (!dateInput) return '-';
  try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      // Check if the date is valid
      if (!(date instanceof Date) || isNaN(date.getTime())) {
          console.warn(`formatTime received invalid dateInput: ${dateInput}`);
          return '-';
      }
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        // Optionally add hour12: true/false
        hour12: true
      });
  } catch (error) {
      console.error(`Error formatting time: ${dateInput}`, error);
      return '-';
  }
};

/**
* Format duration from milliseconds to MM:SS format.
* Handles null, undefined, negative, and non-finite values.
* Useful for individual session durations in the table.
* @param {number|null|undefined} durationMs - Duration in milliseconds.
* @returns {string} Formatted duration string (e.g., "02:35") or '-'.
*/
export const formatDuration = (durationMs) => {
  // Check for null, undefined, or negative values
  if (durationMs === null || durationMs === undefined || durationMs < 0) {
    return '-';
  }
  // Check for non-finite numbers (like NaN or Infinity)
  if (!Number.isFinite(durationMs)) {
      console.warn(`formatDuration received non-finite value: ${durationMs}`);
      return '-';
  }

  // Calculate total seconds, minutes, and remaining seconds
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format to "MM:SS" with leading zeros
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};


/**
 * Format total duration from milliseconds into a concise string like "1h 15m", "25m 30s", "45s".
 * Omits zero parts unless it's the only part (e.g., "0s").
 * Useful for summarizing total time spent across multiple sessions.
 * @param {number|null|undefined} totalMs - Total duration in milliseconds.
 * @returns {string} Formatted duration string or '-'.
 */
export const formatTotalDuration = (totalMs) => {
  // Handle null, undefined, or non-finite values
  if (totalMs === null || totalMs === undefined || !Number.isFinite(totalMs)) {
    return '-';
  }
  // Handle zero or negative duration
  if (totalMs <= 0) {
    return '0s';
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  // Only show seconds if hours and minutes are zero, OR if there are remaining seconds
  if ((hours === 0 && minutes === 0 && seconds > 0) || (seconds > 0 && (hours > 0 || minutes > 0))) {
    parts.push(`${seconds}s`);
  }

  // If after all checks, parts is empty (which shouldn't happen if totalMs > 0), default to 0s
  return parts.join(' ') || '0s';
};

/**
 * Long-form, screen-reader-friendly version of a total duration, mirroring
 * formatTotalDuration's numeric breakdown but spelled out with correct
 * singular/plural (e.g. "1 hour 5 minutes", "12 minutes", "45 seconds").
 * Pair with the compact visible value via aria-label so the abbreviated
 * "12m" text isn't read out as letters: <span aria-label={formatTotalDurationAria(ms)}>{formatTotalDuration(ms)}</span>.
 * @param {number|null|undefined} totalMs - Total duration in milliseconds.
 * @returns {string} Spoken duration string, or 'No time recorded' for empty/invalid input.
 */
export const formatTotalDurationAria = (totalMs) => {
  if (totalMs === null || totalMs === undefined || !Number.isFinite(totalMs) || totalMs <= 0) {
    return 'No time recorded';
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  }
  // Match formatTotalDuration: show seconds when they're the only unit, or as a remainder.
  if ((hours === 0 && minutes === 0 && seconds > 0) || (seconds > 0 && (hours > 0 || minutes > 0))) {
    parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`);
  }

  return parts.join(' ') || 'No time recorded';
};