/* src/components/replay/hooks/useReplayStats.js */
import { useState, useCallback, useMemo } from 'react'; // Added useMemo

/**
 * Initial state structure for replay statistics, aligned with ReplayStatsPanel props.
 */
const initialStatsState = {
    visualAccuracy: 0,     // Accuracy percentage (0-1 scale internally)
    audioAccuracy: 0,      // Accuracy percentage (0-1 scale internally)
    colorAccuracy: 0,      // Accuracy percentage for color (triple/quad modes)
    shapeAccuracy: 0,      // Accuracy percentage for shape (quad mode)
    visualCorrect: 0,      // Number of correct visual hits
    visualTotal: 0,        // Total potential visual matches (hits + misses)
    audioCorrect: 0,       // Number of correct audio hits
    audioTotal: 0,         // Total potential audio matches (hits + misses)
    colorCorrect: 0,       // Number of correct color hits
    colorTotal: 0,         // Total potential color matches (hits + misses)
    shapeCorrect: 0,       // Number of correct shape hits
    shapeTotal: 0,         // Total potential shape matches (hits + misses)
    missedVisual: 0,       // Number of missed visual matches
    missedAudio: 0,        // Number of missed audio matches
    missedColor: 0,        // Number of missed color matches
    missedShape: 0,        // Number of missed shape matches
    falseAlarmVisual: 0,   // Number of visual false alarms
    falseAlarmAudio: 0,    // Number of audio false alarms
    falseAlarmColor: 0,    // Number of color false alarms
    falseAlarmShape: 0,    // Number of shape false alarms
};

/**
 * Hook to calculate and manage live replay statistics based on events up to a specific time.
 *
 * @param {Array<object>} events - The array of replay events from replayData.
 * @param {number} replayStartTime - The absolute start timestamp of the original game session (from replayData.startTime).
 * @returns {object} An object containing the current live statistics (`liveStats`) and memoized functions
 *                   to calculate stats at a time (`calculateStatsAtTime`) and reset stats (`resetStats`).
 */
export const useReplayStats = (events, replayStartTime) => {
    // State to hold the calculated statistics, matching ReplayStatsPanel structure
    const [liveStats, setLiveStats] = useState(initialStatsState);

    // Memoize events array for stability if passed directly as prop
    const memoizedEvents = useMemo(() => events || [], [events]);

    /**
     * Calculates statistics by processing events up to the specified target time.
     * Wrapped in useCallback to ensure a stable function reference.
     */
    const calculateStatsAtTime = useCallback((targetTime) => {
        // Start with a fresh stats object for each calculation
        let tempStats = { ...initialStatsState }; // Use the new structure
        // Set once a recall (singleColorRecall) feedback event is seen — switches the color
        // totals to the recall denominator below. Stays false for every other mode.
        let hasRecallEvents = false;

        // Iterate through events, stopping when events exceed the target time
        for (let i = 0; i < memoizedEvents.length; i++) {
            const event = memoizedEvents[i];
            // Calculate event time relative to the start of the replay
            const eventRelativeTime = (event.timestamp || 0) - replayStartTime;

            // Stop processing if the event occurred after the target time
            if (eventRelativeTime > targetTime) break;

            // Aggregate stats based on feedback events
            switch (event.type) {
                case 'feedbackVisual':
                    // Only count feedback if it wasn't disabled (e.g., during first N trials)
                    if (!event.disabled) {
                        // Increment counters based on feedback type
                        if (event.feedbackType === 'correct') {
                            tempStats.visualCorrect++;
                        } else if (event.feedbackType === 'missed') {
                            // 'missed' means didn't respond when should have
                            tempStats.missedVisual++;
                        } else if (event.feedbackType === 'incorrect') {
                            // Note: 'incorrect' in replay data usually means a false alarm (responded when shouldn't have)
                            tempStats.falseAlarmVisual++;
                        }
                        // Note: We don't increment visualTotal here anymore. It's calculated after the loop.
                    }
                    break;
                case 'feedbackAudio':
                     // Only count feedback if it wasn't disabled
                    if (!event.disabled) {
                         if (event.feedbackType === 'correct') {
                            tempStats.audioCorrect++;
                         } else if (event.feedbackType === 'missed') {
                            tempStats.missedAudio++;
                         } else if (event.feedbackType === 'incorrect') {
                            tempStats.falseAlarmAudio++;
                         }
                         // Note: We don't increment audioTotal here anymore.
                    }
                    break;
                case 'feedbackColor':
                    // Only count feedback if it wasn't disabled (triple/quad modes)
                    if (!event.disabled) {
                        if (event.feedbackType === 'correct') {
                            tempStats.colorCorrect++;
                        } else if (event.feedbackType === 'missed') {
                            tempStats.missedColor++;
                        } else if (event.feedbackType === 'incorrect') {
                            tempStats.falseAlarmColor++;
                        }
                    }
                    break;
                case 'feedbackShape':
                    // Only count feedback if it wasn't disabled (quad mode)
                    if (!event.disabled) {
                        if (event.feedbackType === 'correct') {
                            tempStats.shapeCorrect++;
                        } else if (event.feedbackType === 'missed') {
                            tempStats.missedShape++;
                        } else if (event.feedbackType === 'incorrect') {
                            tempStats.falseAlarmShape++;
                        }
                    }
                    break;
                case 'feedbackColorRecall':
                    // Recall mode (singleColorRecall) reuses the color stat bucket — a session is
                    // either Recall or color-match, never both.
                    hasRecallEvents = true;
                    if (event.feedbackType === 'missed') {
                        // CONTRACT (see useGameResponses.js blank detector): recall logs a 'missed'
                        // event on EVERY unanswered trial, and `disabled: true` there means only
                        // "miss feedback was suppressed by the player's settings" — NOT "skip when
                        // counting". The blank was still scored by the server, so it is counted
                        // regardless of the flag. Applying the sibling disabled-skip here would
                        // inflate replay recall accuracy to 100% for anyone playing with miss
                        // feedback off.
                        tempStats.missedColor++;
                    } else if (!event.disabled) {
                        if (event.feedbackType === 'correct') {
                            tempStats.colorCorrect++;
                        } else if (event.feedbackType === 'incorrect') {
                            // In recall, 'incorrect' is a WRONG COLOR pick, not a false alarm:
                            // forced choice has no non-target trials to false-alarm on. It lands in
                            // the falseAlarmColor bucket only because that's the existing field; the
                            // recall-aware totals below fold it into the denominator accordingly.
                            tempStats.falseAlarmColor++;
                        }
                        // 'acknowledged' (feedback off) carries no correctness — nothing to count.
                    }
                    break;
                default: break; // Ignore other event types for stats calculation
            }
        }

        // Calculate Total Opportunities (Hits + Misses) and Accuracy after the loop
        tempStats.visualTotal = tempStats.visualCorrect + tempStats.missedVisual;
        tempStats.audioTotal = tempStats.audioCorrect + tempStats.missedAudio;
        // Recall's scorable set is exact + wrong pick + blank — every scorable trial produces
        // exactly one of those. The Match shape (correct + missed) would drop wrong picks from
        // the denominator and report exact/(exact+blanks), overstating accuracy. Non-recall
        // sessions never set the flag, so their math is unchanged.
        tempStats.colorTotal = hasRecallEvents
            ? (tempStats.colorCorrect + tempStats.missedColor + tempStats.falseAlarmColor)
            : (tempStats.colorCorrect + tempStats.missedColor);
        tempStats.shapeTotal = tempStats.shapeCorrect + tempStats.missedShape;

        // Calculate percentage accuracy (handle division by zero), keep as 0-1 for consistency
        tempStats.visualAccuracy = tempStats.visualTotal > 0
            ? (tempStats.visualCorrect / tempStats.visualTotal)
            : 0;
        tempStats.audioAccuracy = tempStats.audioTotal > 0
            ? (tempStats.audioCorrect / tempStats.audioTotal)
            : 0;
        tempStats.colorAccuracy = tempStats.colorTotal > 0
            ? (tempStats.colorCorrect / tempStats.colorTotal)
            : 0;
        tempStats.shapeAccuracy = tempStats.shapeTotal > 0
            ? (tempStats.shapeCorrect / tempStats.shapeTotal)
            : 0;

        // Update the component's state with the newly calculated stats
        setLiveStats(tempStats);

    // Dependencies: The calculation depends on the memoized events array and the replay start time.
    }, [memoizedEvents, replayStartTime]);

    /**
     * Resets the live statistics back to their initial state.
     * Wrapped in useCallback for a stable function reference.
     */
    const resetStats = useCallback(() => {
         setLiveStats(initialStatsState); // Reset state to the initial structure
    }, []); // No dependencies needed as it only calls the setter with a constant value

    // Return the current stats and the memoized control functions
    return {
        liveStats,
        calculateStatsAtTime, // Memoized function
        resetStats // Memoized function
    };
};