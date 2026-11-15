/* src/components/tutorial/ProtocolGuideModal.js */
/* Protocol Guide - Main Modal with Hub + Section Content */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { useUser } from '../../contexts/UserContext';
import { usePresence } from '../../contexts/PresenceContext';
import { db } from '../../firebaseConfig';
import { SAFE_AREA_TOP, SAFE_AREA_BOTTOM } from '../../utils/safeArea';
import { getTutorialSections } from './tutorialSections';
import { getStepsByPhase } from './tutorialSteps';
import SectionHub from './SectionHub';
import TrialSection from './TrialSection';

/**
 * ProtocolGuideModal - Main modal for the Protocol Guide
 *
 * @param {boolean} isOpen - Whether modal is visible
 * @param {function} onClose - Close the modal
 * @param {function} onStartDashboardTour - Trigger dashboard tour (closes modal first)
 * @param {string} initialSection - Optional section to start with
 */
const ProtocolGuideModal = ({ isOpen, onClose, onStartDashboardTour, initialSection = null }) => {
  const { userData, userId, markTutorialCompleted, authUser, hasClassicAccess } = useUser();
  const { updateProtocolGuideState } = usePresence() || {};

  // Cohorts without Classic access get the same sections with Classic-free copy.
  const sections = useMemo(() => getTutorialSections({ hasClassicAccess }), [hasClassicAccess]);

  // View state: 'hub' or 'section'
  const [view, setView] = useState('hub');
  const [currentSectionId, setCurrentSectionId] = useState(null);
  const [localUnchecked, setLocalUnchecked] = useState(new Set()); // Track locally unchecked sections
  const [isPracticing, setIsPracticing] = useState(false); // Track practice mode within TrialSection

  // Get completed sections from user data, minus locally unchecked ones
  const completedSections = userData?.tutorialsCompleted
    ? Object.keys(userData.tutorialsCompleted)
        .filter(key => userData.tutorialsCompleted[key] && !localUnchecked.has(key))
    : [];

  // Reset view when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setLocalUnchecked(new Set()); // Reset local unchecked state
      setIsPracticing(false); // Reset practice mode
      if (initialSection) {
        setCurrentSectionId(initialSection);
        setView('section');
      } else {
        setView('hub');
        setCurrentSectionId(null);
      }
    }
  }, [isOpen, initialSection]);

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

  // Report Protocol Guide state to presence context for admin visibility
  useEffect(() => {
    if (!updateProtocolGuideState) return;

    if (isOpen) {
      const section = currentSectionId ? sections.find(s => s.id === currentSectionId) : null;
      updateProtocolGuideState({
        isOpen: true,
        view: isPracticing ? 'practice' : view,
        sectionId: currentSectionId,
        sectionTitle: section?.title || null,
        isPracticing,
      });
    } else {
      updateProtocolGuideState(null);
    }
  }, [isOpen, view, currentSectionId, isPracticing, updateProtocolGuideState, sections]);

  // Handle section selection
  const handleSelectSection = useCallback((sectionId) => {
    setCurrentSectionId(sectionId);
    setView('section');
  }, []);

  // Handle section completion
  const handleSectionComplete = useCallback(async (sectionId) => {
    // Mark section as complete in Firestore
    if (userId) {
      await markTutorialCompleted(userId, sectionId);
    }

    // Return to hub
    setView('hub');
    setCurrentSectionId(null);
  }, [userId, markTutorialCompleted]);

  // Handle manually checking a section (mark as complete without viewing)
  const handleCheckSection = useCallback(async (sectionId) => {
    if (!userId || !sectionId) return;

    // Remove from local unchecked if it was there
    setLocalUnchecked(prev => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });

    // Mark as complete in Firestore
    await markTutorialCompleted(userId, sectionId);
  }, [userId, markTutorialCompleted]);

  // Handle unchecking a section (set to false in Firestore)
  const handleUncheckSection = useCallback(async (sectionId) => {
    if (!authUser?.uid || !sectionId) return;

    // Update local state immediately for responsive UI
    setLocalUnchecked(prev => new Set(prev).add(sectionId));

    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      await updateDoc(userDocRef, {
        [`tutorialsCompleted.${sectionId}`]: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('[ProtocolGuideModal] Error unchecking section:', error);
      // Revert local state on error
      setLocalUnchecked(prev => {
        const next = new Set(prev);
        next.delete(sectionId);
        return next;
      });
    }
  }, [authUser]);

  // Handle back to hub
  const handleBackToHub = useCallback(() => {
    setView('hub');
    setCurrentSectionId(null);
    setIsPracticing(false);
  }, []);

  // Handle practice mode changes from TrialSection
  const handlePracticeStateChange = useCallback((practicing) => {
    setIsPracticing(practicing);
  }, []);

  // Handle dashboard tour start
  const handleStartDashboardTour = useCallback(() => {
    onClose();
    // Small delay to let modal close animation complete
    setTimeout(() => {
      onStartDashboardTour?.();
    }, 300);
  }, [onClose, onStartDashboardTour]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (view === 'section') {
          handleBackToHub();
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, view, handleBackToHub, onClose]);

  if (!isOpen) return null;

  const currentSection = currentSectionId ? sections.find(s => s.id === currentSectionId) : null;

  // Determine if user is actively going through lessons (not just viewing hub)
  const isActivelyLearning = view === 'section' && currentSectionId;

  const modalContent = (
    <div
      data-game-active={isActivelyLearning}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'rgb(var(--color-bg-primary))',
        // Safe-area padding: fixed overlays ignore #root's inset padding, so the
        // status bar (top) and gesture bar (bottom) need explicit handling here.
        paddingTop: SAFE_AREA_TOP,
        paddingBottom: SAFE_AREA_BOTTOM,
      }}
      className="animate-fadeIn"
    >
      {/* Close button - always visible */}
      <button
        onClick={view === 'section' ? handleBackToHub : onClose}
        style={{ top: `calc(1rem + ${SAFE_AREA_TOP})` }}
        className="absolute right-4 p-2 text-theme-text-muted hover:text-theme-text
          transition-colors z-10"
        aria-label={view === 'section' ? 'Back to menu' : 'Close'}
      >
        <FontAwesomeIcon icon={faXmark} className="h-5 w-5" />
      </button>

      {/* Content */}
      {view === 'hub' ? (
        <SectionHub
          sections={sections}
          completedSections={completedSections}
          onSelectSection={handleSelectSection}
          onCheckSection={handleCheckSection}
          onUncheckSection={handleUncheckSection}
          onStartDashboardTour={handleStartDashboardTour}
          onClose={onClose}
        />
      ) : currentSection ? (
        <SectionContent
          section={currentSection}
          hasClassicAccess={hasClassicAccess}
          onComplete={() => handleSectionComplete(currentSection.id)}
          onBack={handleBackToHub}
          onPracticeStateChange={handlePracticeStateChange}
        />
      ) : null}
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

/**
 * SectionContent - Renders the appropriate content for a section
 */
const SectionContent = ({ section, hasClassicAccess = true, onComplete, onBack, onPracticeStateChange }) => {
  // Determine section type and render appropriate content
  const isTrialSection = ['2back-visual', '2back-audio', 'dual'].includes(section.phase);
  const isInfoSection = ['intro', 'progression'].includes(section.phase);

  if (isTrialSection) {
    return (
      <TrialSection
        section={section}
        onComplete={onComplete}
        onBack={onBack}
        onPracticeStateChange={onPracticeStateChange}
      />
    );
  }

  if (isInfoSection) {
    return (
      <InfoSection
        section={section}
        hasClassicAccess={hasClassicAccess}
        onComplete={onComplete}
        onBack={onBack}
      />
    );
  }

  return null;
};

/**
 * InfoSection - Displays info-only sections (intro, progression)
 * Intro: Single scrollable page with all content
 * Progression: Step-by-step navigation
 */
const InfoSection = ({ section, hasClassicAccess = true, onComplete, onBack }) => {
  const steps = getStepsByPhase(section.phase, { hasClassicAccess });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Intro and Progression show all content at once (scrollable)
  if (section.phase === 'intro' || section.phase === 'progression') {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="text-center py-6 px-4 border-b border-theme-line">
          <h2 className="text-2xl font-serif text-theme-text">
            {section.title}
          </h2>
          <p className="text-xs text-theme-text-muted font-mono mt-2 uppercase tracking-wider">
            {section.phase === 'intro' ? 'Cognitive Training Overview' : 'How Training Works'}
          </p>
        </header>

        {/* Scrollable Content - Document Style */}
        <main className="flex-1 overflow-y-auto px-4 py-8">
          <div className="max-w-lg mx-auto space-y-8">
            {steps.map((step, index) => (
              <div key={step.id} className="text-left">
                <h3 className="text-base font-serif text-theme-text mb-3">
                  {step.title}
                </h3>
                <p className="text-sm text-theme-text-secondary leading-relaxed">
                  {step.content}
                </p>
                {index < steps.length - 1 && (
                  <div className="mt-6 border-b border-theme-line/50" />
                )}
              </div>
            ))}
          </div>
        </main>

        {/* Footer Navigation */}
        <footer className="flex items-center justify-between px-4 py-4 border-t border-theme-line">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono
              text-theme-text-muted hover:text-theme-text transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            <span>Back to Menu</span>
          </button>

          <button
            onClick={onComplete}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-mono uppercase tracking-wider
              bg-theme-accent hover:bg-amber-highlight border border-theme-accent text-theme-bg
              rounded-lab transition-all"
          >
            <span>Continue</span>
          </button>
        </footer>
      </div>
    );
  }

  // Fallback for any other info sections (step-by-step navigation)
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="text-center py-4 px-4 border-b border-theme-line">
        <h2 className="text-xl font-serif text-theme-text mb-1">
          {section.title}
        </h2>
        <p className="text-xs text-theme-text-muted font-mono">
          Step {currentStepIndex + 1} of {steps.length}
        </p>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-md mx-auto text-center">
          {/* Step Title */}
          <h3 className="text-lg font-serif text-theme-text mb-4">
            {currentStep?.title}
          </h3>

          {/* Step Content */}
          <p className="text-sm text-theme-text-secondary font-mono leading-relaxed">
            {currentStep?.content}
          </p>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="flex items-center justify-between px-4 py-4 border-t border-theme-line">
        <button
          onClick={currentStepIndex === 0 ? onBack : handlePrev}
          className="flex items-center gap-2 px-4 py-2 text-sm font-mono
            text-theme-text-muted hover:text-theme-text transition-colors"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
          <span>{currentStepIndex === 0 ? 'Back to Menu' : 'Previous'}</span>
        </button>

        <button
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-mono uppercase tracking-wider
            bg-theme-accent hover:bg-amber-highlight border border-theme-accent text-theme-bg
            rounded-lab transition-all"
        >
          <span>{isLastStep ? 'Complete' : 'Next'}</span>
        </button>
      </footer>
    </div>
  );
};

export default ProtocolGuideModal;
