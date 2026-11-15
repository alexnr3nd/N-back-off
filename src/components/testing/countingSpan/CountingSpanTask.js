/* src/components/testing/countingSpan/CountingSpanTask.js */
/* Redesigned with Cognitive Lab aesthetic */
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { usePresence } from '../../../contexts/PresenceContext';
import useCountingSpanLogic from './hooks/useCountingSpanLogic';
import useCountingSpanTimer from './hooks/useCountingSpanTimer';
import { TASK_PHASES } from '../../../constants/cstConstants';

// Import UI Sub-components
import StimulusDisplay from './StimulusDisplay';
import RecallInterface from './RecallInterface';
import CountingSpanResults from './CountingSpanResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faCalculator } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

/**
 * Main component orchestrating the Counting Span assessment task.
 * Integrates logic (useCountingSpanLogic), timing (useCountingSpanTimer),
 * and UI components (Stimulus, Recall, Results).
 * Redesigned with Cognitive Lab aesthetic.
 */
const CountingSpanTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const { setCstProgress } = usePresence();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const earlyRetake = location.state?.earlyRetake || false;

    // --- State for Exit Confirmation ---
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);

    // --- Instantiate Hooks ---
    const advancePhaseRef = useRef(() => { console.warn("advancePhase called before logic hook initialized"); });

    // Timer hook
    const { clearStimulusJudgmentTimer, clearRecallTimer } = useCountingSpanTimer(
        null,
        (...args) => advancePhaseRef.current(...args),
        null,
        null
    );

    // Logic hook
    const {
        currentPhase, currentSet, currentTrialIndexInSet, currentStimulus,
        isLoading, error, isPractice, setSize,
        testStructure, currentSetIndex, feedback,
        intermediateRecallSequence,
        finalScorePCU, finalProcessingAccuracy, flaggedLowAccuracy, isFamiliarization,
        startAssessment, recordJudgment, submitRecall,
        advancePhase: actualAdvancePhase,
        handleRecallChange, handleDevSkipTask,
        handleExitAssessment,
    } = useCountingSpanLogic(
        () => {
            refreshUserData();
        },
        clearStimulusJudgmentTimer,
        clearRecallTimer,
        { earlyRetake }
    );

    // --- Effect Hooks ---
    useEffect(() => {
        if (currentPhase === TASK_PHASES.INSTRUCTIONS) {
            startAssessment();
        }
    }, [startAssessment, currentPhase]);

    useEffect(() => {
        advancePhaseRef.current = actualAdvancePhase;
    }, [actualAdvancePhase]);

    // Sync CST progress to presence for admin tracking
    useEffect(() => {
        if (!setCstProgress) return;
        if (currentPhase === TASK_PHASES.RESULTS || currentPhase === TASK_PHASES.INSTRUCTIONS || currentPhase === TASK_PHASES.SAVING) {
            setCstProgress(null);
            return;
        }
        setCstProgress({
            currentSet: (currentSetIndex || 0) + 1,
            totalSets: testStructure?.length || 15,
            currentTrialInSet: (currentTrialIndexInSet || 0) + 1,
            setSize: currentSet?.setSize || 0,
            phase: currentPhase,
            isFamiliarization: isFamiliarization || false,
            isPractice: isPractice || false,
        });
    }, [setCstProgress, currentPhase, currentSetIndex, currentTrialIndexInSet, currentSet, testStructure, isFamiliarization, isPractice]);

    // Clear CST presence on unmount
    useEffect(() => {
        return () => { if (setCstProgress) setCstProgress(null); };
    }, [setCstProgress]);

    useCountingSpanTimer(
        currentPhase,
        actualAdvancePhase,
        currentTrialIndexInSet,
        setSize
    );

    // --- UI Event Handlers ---
    const handleJudgmentClick = useCallback((userJudgmentIsOdd) => {
        if (currentPhase !== TASK_PHASES.ODD_EVEN_JUDGMENT || !currentStimulus) {
            console.warn("Judgment click ignored: Incorrect phase or no stimulus.");
            return;
        }
        const correctCount = currentStimulus.targetCount;
        const isCorrect = (correctCount % 2 !== 0) === userJudgmentIsOdd;
        const responseTime = performance.now();
        recordJudgment(isCorrect, responseTime);
    }, [currentPhase, currentStimulus, recordJudgment]);

    const handleRecallSubmit = useCallback(() => {
         if (currentPhase !== TASK_PHASES.RECALL) {
             console.warn("Recall submission ignored: Incorrect phase.");
             return;
         }
         if (clearRecallTimer) clearRecallTimer();
         submitRecall();
     }, [currentPhase, submitRecall, clearRecallTimer]);

    // --- Exit Handlers ---
    const openExitModal = useCallback(() => {
        setIsExitModalOpen(true);
    }, []);

    const closeExitModal = useCallback(() => {
        setIsExitModalOpen(false);
    }, []);

    const confirmExit = useCallback(() => {
        closeExitModal();
        handleExitAssessment();
    }, [closeExitModal, handleExitAssessment]);


    // --- Render Logic ---
    const renderContent = () => {
        if (isLoading) {
            const message = currentPhase === TASK_PHASES.SAVING ? "Saving results..." : "Loading assessment...";
            return <LoadingSpinner message={message} theme="auto" />;
        }
        if (error && currentPhase !== TASK_PHASES.RESULTS) {
             return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button
                        onClick={() => navigate('/testing/counting-span')}
                        className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider"
                    >
                         Return to Summary
                    </button>
                </div>
             );
        }

        switch (currentPhase) {
             case TASK_PHASES.READY_ASSESSMENT:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-6">Get Ready</p>
                        <LoadingSpinner message="Starting..." theme="auto" />
                        {feedback && <p className="mt-4 text-sm text-theme-text-muted">{feedback}</p>}
                    </div>
                );

            case TASK_PHASES.FIXATION:
                return (
                    <div className="h-80 flex items-center justify-center">
                        <span className="text-5xl font-mono text-theme-accent animate-pulse">+</span>
                    </div>
                );

            case TASK_PHASES.ODD_EVEN_JUDGMENT:
                return (
                    <div className="flex flex-col items-center w-full">
                        <div className="w-full min-h-[300px] mb-6 flex items-center justify-center">
                             {currentStimulus?.items ? (
                                <StimulusDisplay items={currentStimulus.items} />
                             ) : (
                                <LoadingSpinner message="Loading stimulus..." theme="auto" />
                             )}
                        </div>
                        <p className="mb-4 text-sm font-mono text-theme-text-muted uppercase tracking-wider">
                            Is the count of <span className="text-theme-accent font-medium">BLUE CIRCLES</span> Odd or Even?
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => handleJudgmentClick(true)}
                                disabled={currentPhase !== TASK_PHASES.ODD_EVEN_JUDGMENT}
                                className="px-8 py-3 text-lg font-mono uppercase tracking-wider
                                    bg-theme-bg-elevated border border-theme-line text-theme-text
                                    hover:border-theme-accent hover:text-theme-accent
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-colors duration-150"
                            >
                                Odd
                            </button>
                            <button
                                onClick={() => handleJudgmentClick(false)}
                                disabled={currentPhase !== TASK_PHASES.ODD_EVEN_JUDGMENT}
                                className="px-8 py-3 text-lg font-mono uppercase tracking-wider
                                    bg-theme-bg-elevated border border-theme-line text-theme-text
                                    hover:border-theme-accent hover:text-theme-accent
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    transition-colors duration-150"
                            >
                                Even
                            </button>
                        </div>
                    </div>
                );

            case TASK_PHASES.PROCESSING_TRANSITION:
                return <div className="h-80 w-full"></div>;

            case TASK_PHASES.RECALL:
                if (setSize > 0) {
                    return <RecallInterface
                                setSize={setSize}
                                onSubmit={handleRecallSubmit}
                                value={intermediateRecallSequence}
                                onChange={handleRecallChange}
                           />;
                }
                console.error(`Cannot render RecallInterface: Invalid set size (${setSize}) in phase ${currentPhase}`);
                return ( <p className="text-status-error">Error: Cannot display recall interface.</p> );

            case TASK_PHASES.SAVING:
                 return <LoadingSpinner message="Saving results..." theme="auto" />;

            case TASK_PHASES.RESULTS:
                const resultsData = {
                    scorePCU: finalScorePCU,
                    maxScorePCU: 75,
                    processingAccuracy: finalProcessingAccuracy,
                    accuracyThreshold: 85,
                    flaggedLowAccuracy: flaggedLowAccuracy,
                    isFamiliarization: isFamiliarization,
                    error: error,
                };
                return <CountingSpanResults
                            results={resultsData}
                            onDone={() => navigate('/testing/counting-span', { state: { justUpdatedCst: true } })}
                       />;

            default:
                console.warn(`Rendering fallback for phase: ${currentPhase}`);
                return (
                    <div className="text-center py-8">
                        <p className="text-theme-text-muted mb-4">Initializing Task...</p>
                        <LoadingSpinner theme="auto" />
                    </div>
                );
        }
    };

    // Determine if exit button should be shown
    const showExitButton = !isLoading && currentPhase !== TASK_PHASES.RESULTS && currentPhase !== TASK_PHASES.SAVING && currentPhase !== TASK_PHASES.INSTRUCTIONS && currentPhase !== TASK_PHASES.READY_ASSESSMENT;

    // Protect active assessment phases from auto-refresh on version updates
    const isActiveAssessment = currentPhase !== TASK_PHASES.RESULTS && currentPhase !== TASK_PHASES.INSTRUCTIONS;

    return (
        <>
            <div
                data-game-active={isActiveAssessment}
                className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial"
            >
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faCalculator} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {isFamiliarization ? 'Familiarization' : 'Monthly Assessment'}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Counting Span</h1>
                            </div>
                        </div>

                        {/* Exit Button */}
                        {showExitButton && (
                            <button
                                onClick={openExitModal}
                                title="Exit Assessment Early"
                                className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Main Card - simplified, no left accent */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {/* Progress Header */}
                        {(currentPhase !== TASK_PHASES.READY_ASSESSMENT &&
                          currentPhase !== TASK_PHASES.RESULTS &&
                          currentPhase !== TASK_PHASES.SAVING &&
                          !isPractice) && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {testStructure && testStructure.length > 0 && currentSetIndex >= 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Set</span>
                                            <span className="text-sm font-mono text-theme-text">{currentSetIndex + 1}/{testStructure.length}</span>
                                        </div>
                                    )}
                                    {setSize > 0 && currentTrialIndexInSet >= 0 &&
                                     (currentPhase === TASK_PHASES.ODD_EVEN_JUDGMENT || currentPhase === TASK_PHASES.PROCESSING_TRANSITION || currentPhase === TASK_PHASES.FIXATION) && (
                                        <div className="flex items-center gap-2 pl-4 border-l border-theme-line">
                                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Trial</span>
                                            <span className="text-sm font-mono text-theme-text">{currentTrialIndexInSet + 1}/{setSize}</span>
                                        </div>
                                    )}
                                    {currentPhase === TASK_PHASES.RECALL && (
                                        <span className="text-sm sm:text-xs font-mono text-theme-accent uppercase tracking-wider">Recall {setSize} items</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">
                            {renderContent()}
                        </div>
                    </div>

                    {/* Dev Skip Button */}
                    {isDevelopment && showExitButton && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={handleDevSkipTask}
                                disabled={isLoading}
                                title="DEV ONLY: Skip to Results"
                                className="px-4 py-2 bg-status-error text-white text-xs font-mono uppercase tracking-wider hover:bg-status-error/80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faForward} />
                                Skip to Results (DEV)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Render the Feedback Button */}
            <FeedbackButton />

            {/* Exit Confirmation Modal */}
            <ConfirmationModal
                isOpen={isExitModalOpen}
                onClose={closeExitModal}
                onConfirm={confirmExit}
                title="Confirm Exit"
                confirmText="Confirm Exit"
                cancelText="Cancel"
                confirmColor="danger"
                isDestructive={true}
                requiredInputText={null}
            >
                <div className="space-y-3">
                    <p className="text-sm text-theme-text-secondary">
                        Are you sure you want to exit the assessment?
                    </p>
                    <p className="text-sm text-status-error font-medium">
                        Your current progress will be saved as your final score for this session, and you will not be able to resume or retake it immediately.
                    </p>
                    {isFamiliarization ? (
                         <p className="text-sm text-theme-text-muted">
                             This is a <span className="text-theme-text">familiarization session</span>. Exiting early will still consume this practice attempt.
                         </p>
                     ) : (
                         <p className="text-sm text-theme-text-muted">
                             This is your <span className="text-theme-text">monthly assessment</span>. Exiting early will record your current score and you won't be able to take another assessment this month.
                         </p>
                     )}
                </div>
            </ConfirmationModal>
        </>
    );
};

export default CountingSpanTask;
