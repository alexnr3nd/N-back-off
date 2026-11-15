/* src/components/tutorial/WelcomeModal.js */
/* Protocol Guide - Welcome Modal for First-Time Users */
/* Updated: Added experience question and level picker for experienced n-backers */

import React, { useEffect, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

// Available n-back levels for experienced users
const NBACK_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * WelcomeModal - First-login prompt with experience-based onboarding
 *
 * Flow:
 * 1. Experience Question: "Have you done n-back before?"
 *    - "I'm new" → go to Protocol Guide offer (stay at 2-back)
 *    - "I have experience" → go to Level Picker
 * 2. Level Picker (experienced only): Select starting level 1-9
 * 3. Protocol Guide offer: Start tutorial or skip
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {string} displayName - User's display name (optional)
 * @param {function} onStartTutorial - Called when user wants to start tutorial
 * @param {function} onSkip - Called when user wants to skip
 * @param {function} onSetStartingLevel - Called with selected n-back level (optional)
 */
const WelcomeModal = ({ isOpen, displayName, onStartTutorial, onSkip, onSetStartingLevel }) => {
  // Use display name if provided, otherwise fallback to "Subject"
  const greeting = displayName ? displayName : 'Subject';

  // Step management: 'experience' | 'levelPicker' | 'protocolGuide'
  const [step, setStep] = useState('experience');
  const [selectedLevel, setSelectedLevel] = useState(2);
  const [isExperienced, setIsExperienced] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('experience');
      setSelectedLevel(2);
      setIsExperienced(false);
    }
  }, [isOpen]);

  // Handle "I'm new to this" selection
  const handleNewUser = useCallback(() => {
    setIsExperienced(false);
    setSelectedLevel(2);
    setStep('protocolGuide');
  }, []);

  // Handle "I have experience" selection
  const handleExperiencedUser = useCallback(() => {
    setIsExperienced(true);
    setStep('levelPicker');
  }, []);

  // Handle level selection confirmation
  const handleLevelConfirm = useCallback(async () => {
    // 2 is the account default — only persist a selection that differs from it
    if (selectedLevel !== 2 && onSetStartingLevel) {
      await onSetStartingLevel(selectedLevel);
    }
    setStep('protocolGuide');
  }, [selectedLevel, onSetStartingLevel]);

  // Handle back button from level picker
  const handleBackToExperience = useCallback(() => {
    setStep('experience');
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key - only allow escape on protocolGuide step
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen && step === 'protocolGuide') {
        onSkip();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onSkip, step]);

  if (!isOpen) return null;

  // Render Step 1: Experience Question
  const renderExperienceStep = () => (
    <>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-4">
          {/* Echo Mark Logo */}
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 bg-theme-accent/10 border border-theme-accent/30">
            <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#D4A855" strokeWidth="3" opacity="0.4" />
              <rect x="28" y="28" width="48" height="48" rx="8" fill="#D4A855" />
            </svg>
          </div>

          <div className="flex-1">
            <h2 id="welcome-modal-title" className="text-xl font-serif text-theme-text mb-2">
              Welcome, {greeting}
            </h2>
            <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-4">
              Dual N-Back Training Lab
            </p>
            <p className="text-sm text-theme-text-secondary font-mono">
              Have you done dual n-back training before?
            </p>
          </div>
        </div>
      </div>

      <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line space-y-3">
        <button
          type="button"
          onClick={handleNewUser}
          className="w-full px-5 py-3 rounded-lab text-sm font-mono uppercase tracking-wider
            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text
            border border-theme-line hover:border-theme-accent/50
            transition-all duration-200 text-left
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent"
        >
          I'm new to this
        </button>

        <button
          type="button"
          onClick={handleExperiencedUser}
          className="w-full px-5 py-3 rounded-lab text-sm font-mono uppercase tracking-wider
            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text
            border border-theme-line hover:border-theme-accent/50
            transition-all duration-200 text-left
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent"
        >
          I have experience
        </button>
      </div>
    </>
  );

  // Render Step 1b: Level Picker (experienced users only)
  const renderLevelPickerStep = () => (
    <>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 bg-theme-accent/10 border border-theme-accent/30">
            <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#D4A855" strokeWidth="3" opacity="0.4" />
              <rect x="28" y="28" width="48" height="48" rx="8" fill="#D4A855" />
            </svg>
          </div>

          <div className="flex-1">
            <h2 id="welcome-modal-title" className="text-xl font-serif text-theme-text mb-2">
              Set Your Level
            </h2>
            <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-4">
              Starting N-Back Level
            </p>
            <p className="text-sm text-theme-text-secondary font-mono">
              What level would you like to start at?
            </p>
          </div>
        </div>
      </div>

      <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line">
        {/* Level grid */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {NBACK_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setSelectedLevel(level)}
              className={`px-3 py-3 rounded-lab text-lg font-mono font-medium
                transition-all duration-200 border
                focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-charcoal-surface focus:ring-theme-accent
                ${selectedLevel === level
                  ? 'bg-theme-accent text-theme-bg border-theme-accent ring-1 ring-amber-accent'
                  : 'bg-theme-bg-secondary text-theme-text-secondary border-theme-line hover:border-theme-accent/50 hover:text-theme-text'
                }`}
            >
              {level}
            </button>
          ))}
        </div>

        <p className="text-xs text-theme-text-muted text-center font-mono mb-4">
          Selected: <span className="text-theme-accent">{selectedLevel}-back</span>
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleBackToExperience}
            className="px-4 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
              bg-transparent hover:bg-theme-bg-surface text-theme-text-muted hover:text-theme-text-secondary
              border border-theme-line transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent
              flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            Back
          </button>

          <button
            type="button"
            onClick={handleLevelConfirm}
            className="flex-1 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
              bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
              transition-all duration-200 flex items-center justify-center gap-2
              focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent"
          >
            <span>Continue</span>
            <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  // Render Step 2: Protocol Guide Offer
  const renderProtocolGuideStep = () => (
    <>
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 bg-theme-accent/10 border border-theme-accent/30">
            <svg width="32" height="32" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#D4A855" strokeWidth="3" opacity="0.4" />
              <rect x="28" y="28" width="48" height="48" rx="8" fill="#D4A855" />
            </svg>
          </div>

          <div className="flex-1">
            <h2 id="welcome-modal-title" className="text-xl font-serif text-theme-text mb-2">
              {isExperienced ? "You're All Set" : "Get Started"}
            </h2>
            <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-4">
              Dual N-Back Training Lab
            </p>

            {isExperienced && (
              <p className="text-sm text-theme-accent font-mono mb-3">
                Starting level: {selectedLevel}-back
              </p>
            )}

            <div className="text-sm text-theme-text-secondary font-mono space-y-3">
              <p>
                {isExperienced
                  ? "The Protocol Guide offers a quick refresher on this app's features."
                  : "Dual N-Back training strengthens working memory through systematic cognitive exercise."
                }
              </p>
              <p>
                The <span className="text-theme-accent">Protocol Guide</span> will orient you to the training system in about 5-10 minutes.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line space-y-3">
        <button
          type="button"
          onClick={onStartTutorial}
          className="w-full px-5 py-3 rounded-lab text-sm font-mono uppercase tracking-wider
            bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
            transition-all duration-200 flex items-center justify-center gap-2
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent"
        >
          <span>Begin Protocol Guide</span>
          <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={onSkip}
          className="w-full px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
            bg-transparent hover:bg-theme-bg-surface text-theme-text-muted hover:text-theme-text-secondary
            border border-theme-line transition-all duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent"
        >
          Skip for Now
        </button>

        <p className="text-xs text-theme-text-muted text-center font-mono pt-1">
          Available anytime from your dashboard
        </p>
      </div>
    </>
  );

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={step === 'protocolGuide' ? onSkip : undefined}
    >
      {/* Background overlay - pointer-events:none so touches pass through to modal */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      {/* Modal panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '28rem',
          backgroundColor: 'rgb(var(--color-bg-secondary))',
          border: '1px solid rgb(var(--color-line))',
          borderRadius: '2px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="animate-fadeIn"
      >
        {step === 'experience' && renderExperienceStep()}
        {step === 'levelPicker' && renderLevelPickerStep()}
        {step === 'protocolGuide' && renderProtocolGuideStep()}
      </div>
    </div>
  );

  // Use React Portal to render at document body level
  return ReactDOM.createPortal(modalContent, document.body);
};

export default WelcomeModal;
