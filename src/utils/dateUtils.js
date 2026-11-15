/* src/utils/dateUtils.js */

/**
 * Checks if two Date objects represent the same calendar day (ignores time).
 * @param {Date} date1 - First date object.
 * @param {Date} date2 - Second date object.
 * @returns {boolean} True if they are the same day, false otherwise.
 */
export const isSameDay = (date1, date2) => {
    // No changes to this function
    if (!(date1 instanceof Date) || isNaN(date1) || !(date2 instanceof Date) || isNaN(date2)) {
        return false; // Handle invalid inputs
    }
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
};

/**
 * Checks if a date object or string represents today's date.
 * @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
 * @returns {boolean} True if the date is today, false otherwise.
 */
export const isDateToday = (dateInput) => {
    // No changes to this function
    if (!dateInput) return false;
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (!(date instanceof Date) || isNaN(date.getTime())) return false; // Invalid date
        return isSameDay(date, new Date());
    } catch (error) {
        console.error("Error checking date in isDateToday:", dateInput, error);
        return false;
    }
};

/**
 * Checks if a date object or string represents yesterday's date.
 * @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
 * @returns {boolean} True if the date is yesterday, false otherwise.
 */
export const isDateYesterday = (dateInput) => {
    // No changes to this function
    if (!dateInput) return false;
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (!(date instanceof Date) || isNaN(date.getTime())) return false; // Invalid date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(date, yesterday);
    } catch (error) {
        console.error("Error checking date in isDateYesterday:", dateInput, error);
        return false;
    }
};

/**
 * Calculates the difference in days between two Date objects.
 * Returns a positive integer if date2 is after date1, negative if before.
 * Handles same-day comparison correctly (returns 0).
 * @param {Date} date1 - The earlier date.
 * @param {Date} date2 - The later date.
 * @returns {number} The difference in days, or NaN if inputs are invalid.
 */
export const differenceInDays = (date1, date2) => {
    // No changes to this function
    if (!(date1 instanceof Date) || isNaN(date1) || !(date2 instanceof Date) || isNaN(date2)) {
        return NaN; // Handle invalid inputs
    }
    // Create dates at midnight UTC to avoid DST issues with day calculation
    const utcDate1 = Date.UTC(date1.getFullYear(), date1.getMonth(), date1.getDate());
    const utcDate2 = Date.UTC(date2.getFullYear(), date2.getMonth(), date2.getDate());
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    return Math.floor((utcDate2 - utcDate1) / MS_PER_DAY);
};

/**
 * Formats an ISO timestamp string or Date object into a relative time string.
 * @param {string | Date | null | undefined} timestampInput - ISO date string or Date object.
 * @returns {string} A relative time string (e.g., "Today", "Yesterday", "X days ago", "Never", "Invalid Date").
 */
export const formatRelativeTime = (timestampInput) => {
    // *** THIS FUNCTION WAS ALREADY PRESENT BEFORE THE CURRENT REQUEST ***
    if (!timestampInput) return "Never"; // Handle case where there's no timestamp (e.g., no assessments yet)

    try {
        const pastDate = typeof timestampInput === 'string' ? new Date(timestampInput) : timestampInput;
        // Check if the conversion resulted in a valid Date object
        if (!(pastDate instanceof Date) || isNaN(pastDate.getTime())) {
            console.warn("formatRelativeTime received invalid date:", timestampInput);
            return "Invalid Date"; // Return specific string for invalid dates
        }

        const now = new Date();

        // Check for Today and Yesterday first for common, clear cases
        if (isSameDay(pastDate, now)) {
            return "Today";
        }
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (isSameDay(pastDate, yesterday)) {
            return "Yesterday";
        }

        // Calculate difference in days using the existing utility function
        const daysDiff = differenceInDays(pastDate, now);

        // Handle different time ranges
        if (daysDiff < 0) {
            // This case means the timestamp is in the future, which shouldn't happen for "Last Assessment"
            console.warn("formatRelativeTime encountered a future date:", timestampInput);
            return "In the future"; // Or handle as an error/invalid case
        } else if (daysDiff < 7) {
            // Less than a week ago
            return `${daysDiff} day${daysDiff === 1 ? '' : 's'} ago`;
        } else if (daysDiff < 30) {
            // Less than a month ago (approx)
            const weeks = Math.floor(daysDiff / 7);
            return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
        } else if (daysDiff < 365) {
            // Less than a year ago (approx)
            const months = Math.floor(daysDiff / 30); // Approximation
            return `${months} month${months === 1 ? '' : 's'} ago`;
        } else {
            // A year or more ago
            const years = Math.floor(daysDiff / 365);
            return `${years} year${years === 1 ? '' : 's'} ago`;
        }
    } catch (error) {
        // Catch any unexpected errors during date processing
        console.error("Error formatting relative time:", timestampInput, error);
        return "Error"; // Return a generic error string
    }
};

/**
 * Checks if a date falls on today's calendar day in the given IANA timezone.
 * Uses Intl.DateTimeFormat.formatToParts to extract Y/M/D in the target zone
 * without relying on locale-specific separators or spacing.
 * @param {string | Date | null | undefined} dateInput - ISO string or Date object.
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York'). Defaults to 'UTC'.
 * @returns {boolean} True if the date is today in the given timezone, false otherwise.
 */
export const isDateTodayInTimezone = (dateInput, timezone = 'UTC') => {
    if (!dateInput) return false;
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (!(date instanceof Date) || isNaN(date.getTime())) return false;

        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        const extractYMD = (d) => {
            const parts = formatter.formatToParts(d);
            const get = (type) => parts.find(p => p.type === type)?.value || '';
            return `${get('year')}-${get('month')}-${get('day')}`;
        };

        return extractYMD(date) === extractYMD(new Date());
    } catch (error) {
        console.error('Error in isDateTodayInTimezone:', dateInput, timezone, error);
        return false;
    }
};

/**
 * Returns today's date as a "YYYY-MM-DD" string in the given IANA timezone.
 * Mirrors the backend functions/timezoneUtils.js getDateInTimezone() so the client
 * and server agree on when the local day rolls over — used by the daily Adaptive
 * cap reset (useDailyCapStatus). Compare this against a stored local-date string
 * (e.g. dailyAdaptiveCountDate) with `===`; do NOT use isDateTodayInTimezone for
 * that, since it re-localizes a UTC instant and shifts the day in western zones.
 * Falls back to UTC on a missing/invalid timezone.
 * @param {string} timezone - IANA timezone (e.g., 'America/New_York').
 * @returns {string} Today's date in YYYY-MM-DD format.
 */
export const getTodayStringInTimezone = (timezone) => {
    const format = (tz) => new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
    try {
        return format(timezone || 'UTC');
    } catch (error) {
        return format('UTC');
    }
};

/**
 * Checks if a date object or string falls within the current calendar month.
 * @param {string | Date | null | undefined} dateInput - ISO date string or Date object.
 * @returns {boolean} True if the date is in the current month, false otherwise.
 */
export const isDateInCurrentMonth = (dateInput) => {
    // *** THIS IS THE NEWLY ADDED FUNCTION ***
    if (!dateInput) return false;
    try {
        const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
        if (!(date instanceof Date) || isNaN(date.getTime())) return false; // Invalid date
        const now = new Date();
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    } catch (error) {
        console.error("Error checking date in isDateInCurrentMonth:", dateInput, error);
        return false;
    }
};