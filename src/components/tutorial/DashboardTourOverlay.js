/* src/components/tutorial/DashboardTourOverlay.js */
/* Protocol Guide - Dashboard Spotlight Tour Overlay */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';

import SpotlightHighlight from './SpotlightHighlight';
import TourTooltip from './TourTooltip';
import { getDashboardTourSteps } from './tourSteps';

/**
 * DashboardTourOverlay - Orchestrates a spotlight tour. Used by the welcome/onboarding
 * orchestrator (default steps from `tourSteps.js`) and by feature tours (custom steps).
 *
 * @param {boolean} isOpen - Whether tour is active
 * @param {function} onComplete - Called when tour is finished
 * @param {function} onSkip - Called when user skips tour
 * @param {boolean} isAdaptiveUser - Whether user has Adaptive access (affects default-step content)
 * @param {number} startStep - Optional step to start from (for resume)
 * @param {Array} steps - Optional override step list. If omitted, falls back to the dashboard onboarding steps.
 */
const DashboardTourOverlay = ({ isOpen, onComplete, onSkip, isAdaptiveUser = false, hasClassicAccess = true, startStep = 0, steps: stepsProp }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(startStep);
  const [targetRect, setTargetRect] = useState(null);
  const [isScrolling, setIsScrolling] = useState(false);

  const steps = useMemo(
    () => (stepsProp && stepsProp.length > 0 ? stepsProp : getDashboardTourSteps(isAdaptiveUser, hasClassicAccess)),
    [stepsProp, isAdaptiveUser, hasClassicAccess]
  );
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex];
  const isCompleteStep = currentStep?.type === 'complete';

  // Reset step when tour opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(startStep);
    }
  }, [isOpen, startStep]);

  // Scroll target element into view when step changes. Polls (up to 5s) for the
  // target to appear, since a tour can activate while the surrounding page is
  // still mounting (e.g., dashboard tour fires before the cards render).
  useEffect(() => {
    if (!isOpen || !currentStep?.target || isCompleteStep) return;

    let cancelled = false;
    let scrollTimer = null;
    let attempts = 0;
    const maxAttempts = 50;

    const tryScroll = () => {
      if (cancelled) return;
      const element = document.querySelector(currentStep.target);
      if (element) {
        setIsScrolling(true);

        // Manual scroll instead of element.scrollIntoView. In our layout
        // body has `overflow-y: auto` (so body is the scroll container);
        // smooth scrollIntoView is unreliable on Capacitor / mobile WebKit
        // in that configuration — silently no-ops, leaving the tooltip
        // clamped to the viewport edge with the target off-screen.
        const rect = element.getBoundingClientRect();
        const scroller = document.scrollingElement || document.documentElement;
        const target = scroller.scrollTop + rect.top - (window.innerHeight / 2) + (rect.height / 2);
        const clamped = Math.max(0, Math.min(target, scroller.scrollHeight - window.innerHeight));
        scroller.scrollTo({ top: clamped, behavior: 'smooth' });

        scrollTimer = setTimeout(() => {
          if (!cancelled) setIsScrolling(false);
        }, 600);
        return;
      }
      if (attempts++ < maxAttempts) {
        scrollTimer = setTimeout(tryScroll, 100);
      }
    };

    tryScroll();

    return () => {
      cancelled = true;
      if (scrollTimer) clearTimeout(scrollTimer);
    };
  }, [isOpen, currentStep, isCompleteStep]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        goToNextStep();
      } else if (e.key === 'ArrowLeft') {
        goToPrevStep();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  // Prevent body scroll during tour
  useEffect(() => {
    if (isOpen) {
      // Don't prevent scroll - we need to scroll to elements
      // But we could add a class to indicate tour is active
      document.body.classList.add('tour-active');
    } else {
      document.body.classList.remove('tour-active');
    }
    return () => {
      document.body.classList.remove('tour-active');
    };
  }, [isOpen]);

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      // Tour complete
      onComplete();
    }
  }, [currentStepIndex, totalSteps, onComplete]);

  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const handleTargetRect = useCallback((rect) => {
    setTargetRect(rect);
  }, []);

  if (!isOpen || !currentStep) return null;

  const overlayContent = (
    <>
      {/* Spotlight overlay - only if not complete step and not scrolling */}
      {!isCompleteStep && !isScrolling && (
        <SpotlightHighlight
          targetSelector={currentStep.target}
          padding={12}
          onTargetRect={handleTargetRect}
        />
      )}

      {/* Dark overlay during scroll — non-interactive so it can't trap clicks */}
      {isScrolling && !isCompleteStep && (
        <div className="fixed inset-0 bg-black/80 z-[99998] pointer-events-none" />
      )}

      {/* Dark overlay for complete step — click to dismiss */}
      {isCompleteStep && (
        <div
          className="fixed inset-0 bg-black/80 z-[99998]"
          onClick={onSkip}
        />
      )}

      {/* Tooltip - hide during scrolling */}
      {!isScrolling && (
        <TourTooltip
          title={currentStep.title}
          content={currentStep.content}
          targetRect={targetRect}
          position={currentStep.position}
          currentStep={currentStepIndex}
          totalSteps={totalSteps}
          onNext={goToNextStep}
          onPrev={goToPrevStep}
          onSkip={onSkip}
          isComplete={isCompleteStep}
        />
      )}
    </>
  );

  return ReactDOM.createPortal(overlayContent, document.body);
};

export default DashboardTourOverlay;
