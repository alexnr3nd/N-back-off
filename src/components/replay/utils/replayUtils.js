/* src/components/replay/utils/replayUtils.js */

import { colorToHex } from '../../game/stimulusRenderers';

/**
 * Resolve the rendering palette for a session document.
 *
 * Sessions saved AFTER the color customization feature shipped carry a
 * palette snapshot (`session.palette`) — the exact theme-resolved hex map
 * the player saw at play time. Use it directly so replays render with the
 * original colors regardless of the viewer's current preferences/theme.
 *
 * Sessions saved BEFORE the feature have no palette field — fall back to
 * the legacy colorToHex map (which preserves today's behavior, including
 * the theme-aware white slot via CSS var).
 *
 * @param {{ palette?: Object }} session The session document (or replayData).
 * @returns {Object} A color-name -> hex map suitable for renderer lookup.
 */
export const resolvePaletteForSession = (session) => {
    if (session && session.palette && typeof session.palette === 'object') {
        return session.palette;
    }
    return colorToHex;
};

/**
 * Calculates the total duration of the replay based on event timestamps.
 * @param {Array<object>} events - The array of replay events.
 * @returns {number} The duration in milliseconds.
 */
export const getReplayDuration = (events) => {
    if (!Array.isArray(events) || events.length === 0) return 0;
    // Use the first event's timestamp as the baseline, even if it's not exactly 0 relative time
    const firstEventTime = events[0]?.timestamp || 0;
    // Find the timestamp of the very last event
    const lastEventTime = events[events.length - 1]?.timestamp || firstEventTime;
    // Duration is the difference
    return Math.max(0, lastEventTime - firstEventTime);
};

/**
 * Formats milliseconds into a MM:SS.ms string.
 * @param {number | null | undefined} ms - Time in milliseconds.
 * @returns {string} Formatted time string.
 */
export const formatTime = (ms) => {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '00:00.0';
    const totalSeconds = Math.max(0, ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((ms % 1000) / 100); // Get tenths of a second
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${milliseconds}`;
};