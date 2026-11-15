// src/utils/logInterceptor.js

const MAX_LOGS = 4000; // Limit the number of logs stored in memory
const capturedLogs = [];
const originalConsole = {};

const methodsToOverride = ['log', 'warn', 'error', 'info', 'debug'];

/**
 * Formats console arguments into a readable string.
 * Handles objects and arrays reasonably well.
 */
function formatArgs(args) {
    return args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                // Attempt to stringify, handle circular references
                return JSON.stringify(arg, (key, value) => {
                    if (typeof value === 'object' && value !== null) {
                        if (seen.has(value)) {
                            return '[Circular Reference]';
                        }
                        seen.add(value);
                    }
                    return value;
                }, 2); // Use indentation for readability
            } catch (e) {
                return '[Unstringifiable Object]';
            } finally {
                // Clean up Set for next stringify call if needed (or manage 'seen' differently)
                // For simplicity here, we assume a new Set per call implicit in the try scope
                var seen = new Set(); // Define 'seen' here for correct scope
            }
        }
        // Handle BigInt separately as JSON.stringify doesn't support it by default
        if (typeof arg === 'bigint') {
            return arg.toString() + 'n';
        }
        return String(arg); // Convert other types to string
    }).join(' '); // Join multiple arguments with a space
}


/**
 * Overrides console methods to capture logs.
 */
export function initializeLogInterceptor() {
    methodsToOverride.forEach(method => {
        if (typeof console[method] === 'function') {
            originalConsole[method] = console[method]; // Store original

            console[method] = (...args) => {
                try {
                    const timestamp = new Date().toISOString();
                    const message = formatArgs(args);
                    const logEntry = { timestamp, level: method.toUpperCase(), message };

                    capturedLogs.push(logEntry);

                    // Trim logs if exceeding max count
                    if (capturedLogs.length > MAX_LOGS) {
                        capturedLogs.shift(); // Remove the oldest log
                    }

                    // Call the original console method
                    originalConsole[method].apply(console, args);
                } catch (error) {
                    // Log interception error to the original console to avoid loops
                    originalConsole.error?.('Error in console interceptor:', error);
                }
            };
        }
    });
}

/**
 * Retrieves the captured logs, formatted as a string.
 * @param {number} [maxLength=50000] - Optional max length for the log string.
 * @returns {string | null} Formatted log string or null if no logs.
 */
export function getFormattedCapturedLogs(maxLength = 300000) {
    if (capturedLogs.length === 0) {
        return null;
    }

    let logString = capturedLogs.map(log =>
        `${log.timestamp} [${log.level}] ${log.message}`
    ).join('\n');

    let truncated = false;
    if (logString.length > maxLength) {
        logString = logString.substring(logString.length - maxLength);
        // Find the first newline to avoid cutting mid-line
        const firstNewline = logString.indexOf('\n');
        if (firstNewline !== -1) {
            logString = logString.substring(firstNewline + 1);
        }
        truncated = true;
    }

    const header = `--- Captured Console Logs (Last ${capturedLogs.length} entries, max ${MAX_LOGS}) ${truncated ? '[Truncated]' : ''} ---\n`;
    return header + logString;
}

/**
 * Clears the captured logs array.
 */
export function clearCapturedLogs() {
    capturedLogs.length = 0; // Efficient way to clear the array
}

// Optional: Restore original console methods if needed (e.g., for testing)
export function restoreConsoleMethods() {
    methodsToOverride.forEach(method => {
        if (originalConsole[method]) {
            console[method] = originalConsole[method];
        }
    });
}