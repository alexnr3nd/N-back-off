/* src/hooks/useAutoHideCursor.js */
/**
 * Custom hook to auto-hide the cursor during active gameplay.
 * When enabled, hides the cursor immediately when gameplay starts.
 * Moving the mouse temporarily shows the cursor, then hides again after a delay.
 */
import { useRef, useState, useEffect, useCallback } from 'react';

export function useAutoHideCursor({
    enabled = false,
    isActive = false,
    isOverlayVisible = false,
    hideDelayMs = 2500
}) {
    const containerRef = useRef(null);
    const [cursorHidden, setCursorHidden] = useState(false);
    const hideTimeoutRef = useRef(null);

    // Determine if cursor hiding should be active
    const shouldHideCursor = enabled && isActive && !isOverlayVisible;

    // Clear any pending hide timeout
    const clearHideTimeout = useCallback(() => {
        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }
    }, []);

    // Schedule cursor to hide after delay
    const scheduleHide = useCallback(() => {
        clearHideTimeout();
        hideTimeoutRef.current = setTimeout(() => {
            setCursorHidden(true);
        }, hideDelayMs);
    }, [clearHideTimeout, hideDelayMs]);

    // Handle mouse movement - show cursor and reschedule hide
    const handleMouseMove = useCallback(() => {
        setCursorHidden(false);
        scheduleHide();
    }, [scheduleHide]);

    // Main effect: attach/detach listener based on shouldHideCursor
    useEffect(() => {
        const container = containerRef.current;

        if (shouldHideCursor && container) {
            // Hide cursor immediately when gameplay starts
            setCursorHidden(true);

            // Listen for mouse movement on the container
            container.addEventListener('mousemove', handleMouseMove);

            return () => {
                clearHideTimeout();
                container.removeEventListener('mousemove', handleMouseMove);
                setCursorHidden(false); // Reset on cleanup
            };
        } else {
            // Feature inactive - ensure cursor is visible
            clearHideTimeout();
            setCursorHidden(false);
        }
    }, [shouldHideCursor, scheduleHide, handleMouseMove, clearHideTimeout]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => clearHideTimeout();
    }, [clearHideTimeout]);

    return { containerRef, cursorHidden };
}

export default useAutoHideCursor;
