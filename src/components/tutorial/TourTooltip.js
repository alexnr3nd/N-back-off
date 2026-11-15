/* src/components/tutorial/TourTooltip.js */
/* Protocol Guide - Positioned Tooltip with Arrow */

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faArrowRight, faXmark } from '@fortawesome/free-solid-svg-icons';

/**
 * TourTooltip - Positioned tooltip for dashboard tour
 *
 * @param {string} title - Tooltip header
 * @param {string} content - Tooltip body text
 * @param {object} targetRect - Rectangle of the target element { top, left, width, height, element }
 * @param {string} position - Where to place tooltip ('top' | 'bottom' | 'left' | 'right')
 * @param {number} currentStep - Current step index
 * @param {number} totalSteps - Total number of steps
 * @param {function} onNext - Called when user clicks next
 * @param {function} onPrev - Called when user clicks previous
 * @param {function} onSkip - Called when user skips tour
 * @param {boolean} isComplete - Whether this is the completion step
 */
const TourTooltip = ({
  title,
  content,
  targetRect,
  position = 'bottom',
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  isComplete = false,
}) => {
  const tooltipRef = useRef(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState({ top: 0, left: 0 });

  // Calculate tooltip position based on target rect
  useEffect(() => {
    if (!tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16; // Margin from viewport edges

    let top, left, arrowTop, arrowLeft;

    if (!targetRect || isComplete) {
      // Center in viewport for completion step
      top = (viewportHeight - tooltipRect.height) / 2;
      left = (viewportWidth - tooltipRect.width) / 2;
      setTooltipPosition({ top, left });
      setArrowPosition({ top: 0, left: 0 }); // No arrow for centered tooltip
      return;
    }

    const targetCenter = {
      x: targetRect.left + targetRect.width / 2,
      y: targetRect.top + targetRect.height / 2,
    };

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - 12;
        left = targetCenter.x - tooltipRect.width / 2;
        arrowTop = tooltipRect.height - 1;
        arrowLeft = tooltipRect.width / 2 - 8;
        break;

      case 'bottom':
        top = targetRect.top + targetRect.height + 12;
        left = targetCenter.x - tooltipRect.width / 2;
        arrowTop = -8;
        arrowLeft = tooltipRect.width / 2 - 8;
        break;

      case 'left':
        top = targetCenter.y - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - 12;
        arrowTop = tooltipRect.height / 2 - 8;
        arrowLeft = tooltipRect.width - 1;
        break;

      case 'right':
        top = targetCenter.y - tooltipRect.height / 2;
        left = targetRect.left + targetRect.width + 12;
        arrowTop = tooltipRect.height / 2 - 8;
        arrowLeft = -8;
        break;

      default:
        top = targetRect.top + targetRect.height + 12;
        left = targetCenter.x - tooltipRect.width / 2;
        arrowTop = -8;
        arrowLeft = tooltipRect.width / 2 - 8;
    }

    // Clamp to viewport bounds
    if (left < margin) {
      arrowLeft += left - margin;
      left = margin;
    }
    if (left + tooltipRect.width > viewportWidth - margin) {
      const overflow = left + tooltipRect.width - (viewportWidth - margin);
      arrowLeft += overflow;
      left = viewportWidth - margin - tooltipRect.width;
    }
    if (top < margin) {
      top = margin;
    }
    if (top + tooltipRect.height > viewportHeight - margin) {
      top = viewportHeight - margin - tooltipRect.height;
    }

    // Clamp arrow position - only clamp the axis that can move
    // For top/bottom positions: arrow is at fixed vertical edge, horizontal can move
    // For left/right positions: arrow is at fixed horizontal edge, vertical can move
    if (position === 'top' || position === 'bottom') {
      arrowLeft = Math.max(16, Math.min(tooltipRect.width - 24, arrowLeft));
      // arrowTop stays fixed at edge
    } else {
      arrowTop = Math.max(16, Math.min(tooltipRect.height - 24, arrowTop));
      // arrowLeft stays fixed at edge
    }

    setTooltipPosition({ top, left });
    setArrowPosition({ top: arrowTop, left: arrowLeft });
  }, [targetRect, position, isComplete]);

  // Arrow direction based on position
  const getArrowRotation = () => {
    switch (position) {
      case 'top': return 'rotate-180';
      case 'bottom': return '';
      case 'left': return 'rotate-90';
      case 'right': return '-rotate-90';
      default: return '';
    }
  };

  const showArrow = targetRect && !isComplete;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[99999] w-80 max-w-[calc(100vw-2rem)] animate-fadeIn"
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
      }}
    >
      {/* Tooltip container */}
      <div className="relative bg-theme-bg-secondary border border-theme-line shadow-lab-elevated">
        {/* Header */}
        <div className="flex items-start justify-between px-4 pt-4 pb-2">
          <h3 className="text-base font-serif text-theme-text pr-4">
            {title}
          </h3>
          <button
            onClick={onSkip}
            className="flex-shrink-0 p-1 text-theme-text-muted hover:text-theme-text transition-colors"
            aria-label="Skip tour"
          >
            <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <p className="text-sm text-theme-text-secondary font-mono leading-relaxed">
            {content}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-theme-line bg-theme-bg-elevated">
          {/* Step indicator */}
          <span className="text-xs font-mono text-theme-text-muted">
            {currentStep + 1} / {totalSteps}
          </span>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={onPrev}
                className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider
                  text-theme-text-muted hover:text-theme-text border border-theme-line
                  hover:border-theme-accent/50 rounded-lab transition-all"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
              </button>
            )}

            <button
              onClick={onNext}
              className="px-4 py-1.5 text-xs font-mono uppercase tracking-wider
                bg-theme-accent hover:bg-amber-highlight text-theme-bg
                border border-theme-accent rounded-lab transition-all
                flex items-center gap-1.5"
            >
              <span>{(isComplete || currentStep === totalSteps - 1) ? 'Finish' : 'Next'}</span>
              <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Arrow pointer */}
        {showArrow && (
          <div
            className={`absolute w-4 h-4 ${getArrowRotation()}`}
            style={{
              top: arrowPosition.top,
              left: arrowPosition.left,
            }}
          >
            <svg viewBox="0 0 16 8" className="w-full h-full">
              <path
                d="M0 8 L8 0 L16 8 Z"
                fill="#151311"
                stroke="#3A352F"
                strokeWidth="1"
              />
              {/* Cover the stroke at the base */}
              <path
                d="M1 8 L15 8"
                stroke="#151311"
                strokeWidth="2"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

export default TourTooltip;
