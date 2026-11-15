// src/contexts/game/replayUtils.js

/**
 * Creates a function to log replay events to a provided ref array.
 * This factory function itself does NOT call any React Hooks.
 *
 * @param {React.MutableRefObject<Array<object>>} replayEventsRef - Ref holding the array where replay events should be stored.
 * @returns {(eventData: object) => void} A function that takes event data and pushes it to the ref array with a timestamp.
 */
export function createLogReplayEvent(replayEventsRef) {

  // Return the actual logging function. This function will be wrapped
  // in useCallback within the component where it's used (e.g., GameProvider).
  return (eventData) => {
    const timestamp = Date.now(); // Capture timestamp when the event is logged

    // Ensure the ref and its current property are valid before pushing
    // Use optional chaining for safety.
    if (replayEventsRef?.current && Array.isArray(replayEventsRef.current)) {
         // Push the new event object (timestamp + event data) into the array
         replayEventsRef.current.push({ timestamp, ...eventData });
    } else {
        // Log an error if the ref is missing or not an array
        console.error("Attempted to log replay event, but replayEventsRef is invalid or not initialized as an array.");
    }
  };
  // NO React Hooks (like useCallback) should be called inside this factory function.
}

// Optional: Default export if needed, though named export is usually sufficient.
// export default { createLogReplayEvent };