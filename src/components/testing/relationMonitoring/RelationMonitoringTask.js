/* src/components/testing/relationMonitoring/RelationMonitoringTask.js */
import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useRelationMonitoringLogic from './hooks/useRelationMonitoringLogic';
import { RELATION_MONITORING_PHASES } from '../../../constants/relationMonitoringConstants';

import RelationMonitoringGrid from './RelationMonitoringGrid';
import MatchButton from './MatchButton';
import RelationMonitoringResults from './RelationMonitoringResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faForward, faTimes, faTableCells, faMugHot } from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const P = RELATION_MONITORING_PHASES;

// Phases rendered inside the stimulus field
const STIMULUS_PHASES = [P.ARRAY, P.BLINK, P.TRIAL_FEEDBACK];

const computeContainerSize = () =>
    Math.round(Math.min(window.innerWidth * 0.85, window.innerHeight * 0.5, 480));

const RelationMonitoringTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [containerSize, setContainerSize] = useState(computeContainerSize);
    const earlyRetake = location.state?.earlyRetake || false;

    const {
        currentPhase, currentTrialSpec, isPractice, practiceNumber, practiceTotal,
        trialNumber, totalTrials, blockNumber, totalBlocks,
        respondedCurrent, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, hasScoredData,
        notEligibleMessage, finalScores, isLoading, error,
        initializeSession, startScoredBlock, continueFromBreak, skipPractice,
        handleRespond, handleExitAssessment, handleDevSkipTask,
        setResponseBlocked,
    } = useRelationMonitoringLogic({
        earlyRetake,
        onExit: () => navigate('/testing/relation-monitoring'),
    });

    // Initialize session on mount (idempotent via didInitRef in the logic hook)
    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    useEffect(() => {
        const onResize = () => setContainerSize(computeContainerSize());
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    // The stream keeps its protocol pace while the exit modal is up, so the
    // hook must know to flag arrays the user couldn't respond to.
    useEffect(() => {
        setResponseBlocked(isExitModalOpen);
    }, [isExitModalOpen, setResponseBlocked]);

    // If the session finishes while the exit modal is open (block 3 ended ->
    // auto-submit), the modal must not sit on top of the results screen.
    useEffect(() => {
        if ((currentPhase === P.SAVING || currentPhase === P.RESULTS) && isExitModalOpen) {
            setIsExitModalOpen(false);
        }
    }, [currentPhase, isExitModalOpen]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const handleDone = useCallback(() => {
        // Refresh AFTER the task is finished (Done press), never at save-success
        // — refreshing earlier unmounts the in-task results screen.
        refreshUserData();
        navigate('/testing/relation-monitoring', { state: { justUpdatedRelationMonitoring: true } });
    }, [refreshUserData, navigate]);

    // --- Render ---
    const renderContent = () => {
        if (isLoading && currentPhase !== P.RESULTS) {
            const message = currentPhase === P.SAVING ? 'Saving results...' : 'Loading assessment...';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== P.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">An Error Occurred</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button onClick={() => navigate('/testing/relation-monitoring')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        if (STIMULUS_PHASES.includes(currentPhase)) {
            return (
                <div className="w-full flex flex-col items-center gap-4">
                    <RelationMonitoringGrid
                        phase={currentPhase}
                        trialSpec={currentTrialSpec}
                        feedbackCorrect={lastFeedbackCorrect}
                        containerSize={containerSize}
                    />
                    {/* Mounted through all stimulus phases so the response row
                        causes no layout shift; interactive only while an array
                        is on screen */}
                    <MatchButton
                        onRespond={handleRespond}
                        disabled={currentPhase !== P.ARRAY || isExitModalOpen}
                        responded={respondedCurrent}
                    />
                    {/* Skip practice — scored sessions only. Mounted through
                        all practice stimulus phases (same no-layout-shift rule
                        as the Match button). */}
                    {isPractice && !isFamiliarization && !isLoading && (
                        <button
                            onClick={skipPractice}
                            className="font-mono text-xs uppercase tracking-wider text-theme-text-secondary hover:text-theme-accent transition-colors"
                        >
                            Skip practice →
                        </button>
                    )}
                </div>
            );
        }

        switch (currentPhase) {
            case P.READY:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            The scored arrays start now: {totalBlocks} blocks of 36, with a
                            self-paced break between blocks. The grids keep their own pace —
                            a new one every 5.5 seconds — and there is no more feedback after
                            each array. That's normal.
                        </p>
                        <button
                            onClick={startScoredBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Block 1
                        </button>
                    </div>
                );

            case P.BREAK:
                return (
                    <div className="text-center py-8">
                        <div className="h-12 w-12 mx-auto mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faMugHot} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="text-xl font-serif italic text-theme-text mb-4">Block {blockNumber} of {totalBlocks} Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Take a short break. Continue whenever you're ready — the next
                            block works exactly the same way.
                        </p>
                        <button
                            onClick={continueFromBreak}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Block {blockNumber + 1}
                        </button>
                    </div>
                );

            case P.SAVING:
                return <LoadingSpinner message="Saving results..." theme="auto" />;

            case P.RESULTS:
                if (notEligibleMessage && !error) {
                    return (
                        <div className="text-center p-6">
                            <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center">
                                <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-theme-text-muted" />
                            </div>
                            <p className="font-serif italic text-lg text-theme-text mb-2">Not Eligible Yet</p>
                            <p className="text-sm text-theme-text-secondary mb-6">Next available: {notEligibleMessage}</p>
                            <button onClick={() => navigate('/testing/relation-monitoring')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <RelationMonitoringResults
                        results={{
                            ...(finalScores || {}),
                            isFamiliarization,
                            error,
                            completedTrialCount,
                            totalTrials,
                        }}
                        onDone={handleDone}
                    />
                );

            default:
                return (
                    <div className="text-center py-8">
                        <p className="text-theme-text-muted mb-4">Initializing Task...</p>
                        <LoadingSpinner theme="auto" />
                    </div>
                );
        }
    };

    const showExitButton = !isLoading
        && currentPhase !== P.RESULTS
        && currentPhase !== P.SAVING
        && currentPhase !== P.INSTRUCTIONS;

    const isActiveAssessment = currentPhase !== P.RESULTS && currentPhase !== P.INSTRUCTIONS;

    const showProgressStrip = STIMULUS_PHASES.includes(currentPhase);

    const headerLabel = isPractice
        ? 'Practice'
        : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment');

    return (
        <>
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faTableCells} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Relation Monitoring</h1>
                            </div>
                        </div>

                        {showExitButton && (
                            <button onClick={openExitModal} title="Exit Assessment Early" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {/* Progress Strip */}
                        {showProgressStrip && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                        {isPractice ? 'Practice' : `Block ${blockNumber}/${totalBlocks} · Trial`}
                                    </span>
                                    <span className="text-sm font-mono text-theme-text">
                                        {isPractice ? `${practiceNumber}/${practiceTotal}` : `${trialNumber}/${totalTrials}`}
                                    </span>
                                </div>
                                <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                    Row or column ends the same? Match
                                </span>
                            </div>
                        )}

                        {/* Content Area */}
                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">
                            {renderContent()}
                        </div>
                    </div>

                    {/* Dev Skip */}
                    {isDevelopment && showExitButton && (
                        <div className="mt-4 flex justify-center">
                            <button onClick={handleDevSkipTask} disabled={isLoading} className="px-4 py-2 bg-status-error text-white text-xs font-mono uppercase tracking-wider hover:bg-status-error/80 disabled:opacity-50 flex items-center gap-2">
                                <FontAwesomeIcon icon={faForward} />
                                Skip to Results (DEV)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <FeedbackButton />

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
                    <p className="text-sm text-theme-text-secondary">Are you sure you want to exit?</p>
                    {(isFamiliarization || !canSavePartial) ? (
                        <p className="text-sm text-theme-text-muted">
                            {isFamiliarization
                                ? <>This <span className="text-theme-text">familiarization session</span> will be discarded. You can retake it anytime.</>
                                : <>Not enough arrays are completed to produce a score, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
                            }
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-status-error font-medium">Your progress so far will be saved as your final score.</p>
                            <p className="text-sm text-theme-text-muted">This is your <span className="text-theme-text">monthly assessment</span>. Waiting 30 days before retaking is recommended for reliable tracking.</p>
                        </>
                    )}
                </div>
            </ConfirmationModal>
        </>
    );
};

export default RelationMonitoringTask;
