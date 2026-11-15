/**
 * Name validation utilities
 * Shared validation logic for display name fields
 */

// Allowed characters: letters (including accented), spaces, hyphens, apostrophes, periods
// Uses Unicode property escapes to support international characters
const NAME_PATTERN = /^[\p{L}\p{M}'\-.\s]+$/u;

// Suspicious patterns that might indicate injection attempts
const SUSPICIOUS_PATTERNS = [
    /<[^>]*>/,           // HTML tags
    /javascript:/i,       // JavaScript protocol
    /on\w+\s*=/i,        // Event handlers like onclick=
    /&#/,                 // HTML entities
    /%3C|%3E/i,          // URL encoded < >
    /\{\{|\}\}/,         // Template injection
    /\$\{/,              // Template literals
    /<script/i,          // Script tags
    /\balert\s*\(/i,     // alert() calls
    /\beval\s*\(/i,      // eval() calls
];

export const NAME_MAX_LENGTH = 50;

/**
 * Validates a display name
 * @param {string} name - The name to validate
 * @returns {{ isValid: boolean, error: string | null }}
 */
export const validateName = (name) => {
    if (!name || typeof name !== 'string') {
        return { isValid: false, error: 'Name is required.' };
    }

    const trimmed = name.trim();

    if (trimmed.length === 0) {
        return { isValid: false, error: 'Name cannot be empty.' };
    }

    if (trimmed.length > NAME_MAX_LENGTH) {
        return { isValid: false, error: `Name cannot exceed ${NAME_MAX_LENGTH} characters.` };
    }

    // Check for suspicious patterns first
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { isValid: false, error: 'Name contains invalid characters.' };
        }
    }

    // Check allowed character pattern
    if (!NAME_PATTERN.test(trimmed)) {
        return {
            isValid: false,
            error: 'Only letters, spaces, hyphens, apostrophes, and periods are allowed.'
        };
    }

    return { isValid: true, error: null };
};

/**
 * Sanitizes a name by trimming whitespace
 * Note: Full sanitization happens on the backend
 * @param {string} name - The name to sanitize
 * @returns {string}
 */
export const sanitizeName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name.trim();
};

/**
 * Checks if a character is valid for a name
 * Used for real-time input filtering
 * @param {string} char - Single character to check
 * @returns {boolean}
 */
export const isValidNameChar = (char) => {
    return NAME_PATTERN.test(char);
};
