/* src/components/tutorial/SpotlightHighlight.js */
/* Protocol Guide - Spotlight Overlay with Cutout */

import React, { useState, useEffect, useCallback } from 'react';

/**
 * SpotlightHighlight - Full-screen overlay with transparent cutout around target element
 *
 * @param {string} targetSelector - CSS selector for the element to highlight
 * @param {number} padding - Extra padding around the highlighted element (default: 8)
 * @param {function} onTargetRect - Callback with target rect for tooltip positioning
 */
const SpotlightHighlight = ({ targetSelector, padding = 8, onTargetRect }) => {
  const [targetRect, setTargetRect] = useState(null);

  // Find and measure target element
  const updateTargetRect = useCallback(() => {
    if (!targetSelector) {
      setTargetRect(null);
      if (onTargetRect) onTargetRect(null);
      return;
    }

    const element = document.querySelector(targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      const newRect = {
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        // Original element rect for tooltip positioning
        element: rect,
      };
      setTargetRect(newRect);
      if (onTargetRect) onTargetRect(newRect);
    } else {
      setTargetRect(null);
      if (onTargetRect) onTargetRect(null);
    }
  }, [targetSelector, padding, onTargetRect]);

  // Update on mount and when selector changes.
  // Polls every 100ms (up to 5s) until the target element appears in the DOM,
  // because a tour can activate while the target's parent route is still
  // mounting (e.g., navigating from /settings to /dashboard while
  // ProfileDashboard is in its `isDataReady === false` loading state).
  useEffect(() => {
    updateTargetRect();
    if (!targetSelector) return;
    if (document.querySelector(targetSelector)) return;

    let attempts = 0;
    const maxAttempts = 50;
    const interval = setInterval(() => {
      const found = document.querySelector(targetSelector);
      if (found || attempts++ >= maxAttempts) {
        clearInterval(interval);
        if (found) updateTargetRect();
      }
    }, 100);
    return () => clearInterval(interval);
  }, [updateTargetRect, targetSelector]);

  // Update on scroll and resize
  useEffect(() => {
    const handleUpdate = () => updateTargetRect();

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [updateTargetRect]);

  // If no target, don't render spotlight
  if (!targetRect) {
    return (
      <div
        className="fixed inset-0 bg-black/80 z-[99998]"
        style={{ pointerEvents: 'none' }}
      />
    );
  }

  // Create SVG mask for the spotlight effect
  return (
    <div
      className="fixed inset-0 z-[99998]"
      style={{ pointerEvents: 'none' }}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Mask that reveals the target area */}
          <mask id="spotlight-mask">
            {/* White background (visible area) */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Black rectangle (hidden area - the spotlight cutout) */}
            <rect
              x={targetRect.left}
              y={targetRect.top}
              width={targetRect.width}
              height={targetRect.height}
              fill="black"
              rx="2"
            />
          </mask>
        </defs>

        {/* Dark overlay with mask applied */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.80)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* Highlight border around target */}
      <div
        className="absolute border-2 border-amber-accent rounded-sm transition-all duration-300 ease-out"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          boxShadow: '0 0 0 4px rgba(228, 184, 92, 0.2), 0 0 20px rgba(228, 184, 92, 0.3)',
          pointerEvents: 'auto',
        }}
      />
    </div>
  );
};

export default SpotlightHighlight;
