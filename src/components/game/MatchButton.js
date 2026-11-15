/* File: src/components/game/MatchButton.js */
/* Cognitive Lab Aesthetic - Response Input Button */

import React, { useCallback, useRef } from 'react';
import { isNative } from '../../utils/platform';

/**
 * MatchButton Component - Laboratory-style response button
 * Provides visual feedback with scientific color coding.
 * Includes response lock and validation to prevent phantom button presses
 * that can occur on iOS Chrome/Brave (WKWebView) due to touch event quirks.
 */

// Response lock duration - blocks all events for this period after a response
// This prevents iOS from firing duplicate touch/click events
const RESPONSE_LOCK_MS = 200;

const MatchButton = ({ label, keyHint, onClick, feedbackState, disabled }) => {
  // Ref to track when the last response was registered (for response lock)
  const lastResponseTimeRef = useRef(0);

  // Unified handler for both touch and click events
  // Uses a response lock to prevent duplicate events from registering
  const handleInteraction = useCallback((e, source) => {
    const now = Date.now();

    // Check response lock - block events that come too quickly after the last response
    // This catches iOS phantom click events that fire after touchstart
    if (now - lastResponseTimeRef.current < RESPONSE_LOCK_MS) {
      e.stopPropagation();
      return;
    }

    // Reject untrusted (synthetic) events (additional safety layer)
    if (e && e.isTrusted === false) {
      console.warn(`[MatchButton:${label}] Rejected untrusted ${source} event`);
      return;
    }

    // Set response lock timestamp BEFORE calling onClick
    lastResponseTimeRef.current = now;

    // For touch events: prevent the subsequent click event from firing (avoid double-trigger)
    // For click events: do NOT call preventDefault - it breaks the user gesture context
    // required for audio playback on iOS/Safari
    if (source === 'touch') {
      e.stopPropagation();
    }

    if (!disabled && onClick) {
      // Trigger haptic feedback on native platforms
      if (isNative()) {
        import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
          Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
        }).catch(() => {});
      }
      onClick();
    } else {
    }
  }, [disabled, onClick, label]);

  // Touch handler - fires immediately on touch, critical for dual matches
  const handleTouchStart = useCallback((e) => handleInteraction(e, 'touch'), [handleInteraction]);

  // Click handler - handles mouse clicks and any click events that bypass touch
  const handleClick = useCallback((e) => handleInteraction(e, 'click'), [handleInteraction]);
  // Determine button styling based on state
  let bgColor = 'bg-theme-bg-elevated';
  let borderColor = 'border-theme-line';
  let textColor = 'text-theme-text';
  let hoverBg = 'hover:bg-theme-bg-surface';
  let glowEffect = '';

  if (disabled) {
    bgColor = 'bg-theme-bg-secondary';
    borderColor = 'border-theme-line';
    textColor = 'text-theme-text-muted';
    hoverBg = '';
  } else if (feedbackState === 'correct') {
    bgColor = 'bg-neural-dendrite/20';
    borderColor = 'border-neural-dendrite';
    textColor = 'text-theme-neural-green';
    glowEffect = 'shadow-[0_0_20px_rgba(124,255,180,0.3)]';
  } else if (feedbackState === 'incorrect' || feedbackState === 'missed') {
    bgColor = 'bg-neural-synapse/20';
    borderColor = 'border-neural-synapse';
    textColor = 'text-theme-neural-red';
    glowEffect = 'shadow-[0_0_20px_rgba(255,124,124,0.3)]';
  } else if (feedbackState === 'acknowledged') {
    bgColor = 'bg-theme-accent/20';
    borderColor = 'border-theme-accent';
    textColor = 'text-theme-accent';
    glowEffect = 'shadow-[0_0_15px_rgba(228,184,92,0.2)]';
  } else {
    // Default active state
    bgColor = 'bg-theme-bg-elevated';
    borderColor = 'border-theme-line hover:border-theme-accent/50';
    textColor = 'text-theme-text';
    hoverBg = 'hover:bg-theme-bg-surface';
  }

  return (
    <button
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      disabled={disabled}
      style={{ touchAction: 'manipulation' }}
      className={`
        match-button
        relative w-full py-3 sm:py-4 px-4
        font-mono text-sm sm:text-base uppercase tracking-wider
        border transition-all duration-150
        ${bgColor} ${borderColor} ${textColor} ${hoverBg} ${glowEffect}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-accent/50
        flex flex-col items-center justify-center gap-1
      `}
      aria-label={keyHint ? `${label} (${keyHint})` : label}
      title={keyHint ? `${label} (Key: ${keyHint})` : label}
    >
      {/* Button Label with optional key hint (hidden on mobile) */}
      <div className="flex items-center gap-2">
        {keyHint && (
          <kbd className={`
            hidden sm:inline-block px-1.5 py-0.5 text-xs font-mono border
            ${feedbackState === 'correct' ? 'bg-neural-dendrite/30 border-neural-dendrite/50 text-theme-neural-green' :
              feedbackState === 'incorrect' || feedbackState === 'missed' ? 'bg-neural-synapse/30 border-neural-synapse/50 text-theme-neural-red' :
              feedbackState === 'acknowledged' ? 'bg-amber-accent/30 border-amber-accent/50 text-amber-accent' :
              'bg-theme-bg border-theme-line text-theme-text-muted'}
          `}>
            {keyHint}
          </kbd>
        )}
        <span className="match-button-label font-medium">{label}</span>
      </div>

      {/* Active indicator line */}
      {!disabled && !feedbackState && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-px bg-gradient-to-r from-transparent via-theme-accent/30 to-transparent" />
      )}
    </button>
  );
};

export default MatchButton;
