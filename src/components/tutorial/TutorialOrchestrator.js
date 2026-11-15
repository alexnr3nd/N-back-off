/* src/components/tutorial/TutorialOrchestrator.js */
/* Protocol Guide - Main Controller Component */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useUser } from '../../contexts/UserContext';

import WelcomeModal from './WelcomeModal';
import ProtocolGuideModal from './ProtocolGuideModal';
import DashboardTourOverlay from './DashboardTourOverlay';

/**
 * TutorialOrchestrator - Controls the Protocol Guide flow
 *
 * Flow:
 * 1. New users see WelcomeModal first
 * 2. WelcomeModal "Start" → opens ProtocolGuideModal
 * 3. ProtocolGuideModal has all sections (intro, visual, audio, dual, progression)
 * 4. Selecting "Dashboard Tour" closes modal and starts DashboardTourOverlay
 * 5. Manual access via showProtocolGuide prop (from dashboard header button)
 *
 * @param {boolean} showProtocolGuide - External trigger to open Protocol Guide
 * @param {function} onProtocolGuideClose - Called when Protocol Guide closes
 */
const TutorialOrchestrator = ({ showProtocolGuide = false, onProtocolGuideClose }) => {
  const { userData, markTutorialCompleted, userId, isDataReady, updateProfileProgress, activeSessions, isAdaptiveUser, hasClassicAccess } = useUser();

  // Modal states - showGuide and showTour are user-triggered transitions
  const [showGuide, setShowGuide] = useState(false);
  const [showTour, setShowTour] = useState(false);

  // Track if welcome was dismissed/completed this session (for state transitions)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Get completion status from userData
  const tutorialsCompleted = useMemo(() => {
    return userData?.tutorialsCompleted || {};
  }, [userData?.tutorialsCompleted]);

  const hasCompletedWelcome = tutorialsCompleted.welcome === true;

  // Secondary guard: if user has played sessions, they're not new — skip welcome
  const hasExistingProgress = activeSessions && activeSessions.length > 0;

  // Compute showWelcome SYNCHRONOUSLY - no useEffect delay!
  // This ensures the modal renders in the same cycle as the dashboard
  const showWelcome = isDataReady && !welcomeDismissed && !hasCompletedWelcome
    && !hasExistingProgress && !showGuide && !showTour;

  // Handle external trigger to open Protocol Guide
  useEffect(() => {
    if (showProtocolGuide && !showGuide && !showWelcome && !showTour) {
      setShowGuide(true);
    }
  }, [showProtocolGuide, showGuide, showWelcome, showTour]);

  // Handle starting tutorial from welcome modal
  const handleStartFromWelcome = useCallback(async () => {
    // Mark welcome as seen
    if (userId) {
      await markTutorialCompleted(userId, 'welcome');
    }
    setWelcomeDismissed(true);
    setShowGuide(true);
  }, [userId, markTutorialCompleted]);

  // Handle skipping from welcome modal
  const handleSkipWelcome = useCallback(async () => {
    // Mark welcome as seen even if skipped
    if (userId) {
      await markTutorialCompleted(userId, 'welcome');
    }
    setWelcomeDismissed(true);
  }, [userId, markTutorialCompleted]);

  // Handle setting starting level for experienced users
  const handleSetStartingLevel = useCallback(async (nBackLevel) => {
    if (!userId || !updateProfileProgress) {
      console.error('[TutorialOrchestrator] Cannot set starting level: missing userId or updateProfileProgress');
      return;
    }

    try {
      await updateProfileProgress(userId, {
        currentNBack: nBackLevel,
        currentDifficulty: 0, // Start at difficulty 0 for the new level
        highestNBack: nBackLevel, // Set highest to match starting level
        consecutiveSuccesses: 0, // Reset streak
        // Tutorial uses Adaptive-semantics (currentDifficulty: 0 is Adaptive-only)
        trainingMode: 'adaptive',
      });
    } catch (error) {
      console.error('[TutorialOrchestrator] Failed to set starting level:', error);
    }
  }, [userId, updateProfileProgress]);

  // Handle Protocol Guide close
  const handleGuideClose = useCallback(() => {
    setShowGuide(false);
    onProtocolGuideClose?.();
  }, [onProtocolGuideClose]);

  // Handle Dashboard Tour start (called from Protocol Guide modal)
  const handleStartDashboardTour = useCallback(() => {
    setShowGuide(false);
    // Small delay to ensure modal is closed before tour starts
    setTimeout(() => {
      setShowTour(true);
    }, 100);
  }, []);

  // Handle dashboard tour completion
  const handleDashboardTourComplete = useCallback(async () => {
    // Mark dashboard tour as complete
    if (userId) {
      await markTutorialCompleted(userId, 'dashboardTour');
    }
    setShowTour(false);
  }, [userId, markTutorialCompleted]);

  // Handle skipping dashboard tour
  const handleSkipDashboardTour = useCallback(async () => {
    // Mark as complete even if skipped
    if (userId) {
      await markTutorialCompleted(userId, 'dashboardTour');
    }
    setShowTour(false);
  }, [userId, markTutorialCompleted]);

  // Don't render anything if data isn't ready
  if (!isDataReady) return null;

  return (
    <>
      {/* Welcome Modal - First-time users */}
      <WelcomeModal
        isOpen={showWelcome}
        displayName={userData?.displayName}
        onStartTutorial={handleStartFromWelcome}
        onSkip={handleSkipWelcome}
        onSetStartingLevel={handleSetStartingLevel}
      />

      {/* Protocol Guide Modal - Hub with all sections */}
      <ProtocolGuideModal
        isOpen={showGuide}
        onClose={handleGuideClose}
        onStartDashboardTour={handleStartDashboardTour}
      />

      {/* Dashboard Tour Overlay - Spotlight tour of dashboard features */}
      <DashboardTourOverlay
        isOpen={showTour}
        onComplete={handleDashboardTourComplete}
        onSkip={handleSkipDashboardTour}
        isAdaptiveUser={isAdaptiveUser}
        hasClassicAccess={hasClassicAccess}
      />
    </>
  );
};

export default TutorialOrchestrator;
