/* src/components/testing/icar16/ReasoningCheckTask.js */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faBrain, faForward, faChevronRight } from '@fortawesome/free-solid-svg-icons';

import { useUser } from '../../../contexts/UserContext';
import useReasoningCheckLogic from './hooks/useReasoningCheckLogic';
import ReasoningCheckResults from './ReasoningCheckResults';
import VerbalItem from './items/VerbalItem';
import SeriesItem from './items/SeriesItem';
import MatrixItem from './items/MatrixItem';
import RotationItem from './items/RotationItem';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { TASK_PHASES, ICAR_SUBTEST } from '../../../constants/icarConstants';

const SUMMARY_ROUTE = '/testing/reasoning';

/**
 * Picks the right item-type renderer for the current item.
 */
const ItemRenderer = ({ item, onResponse, disabled }) => {
    if (!item) return null;
    switch (item.subtest) {
        case ICAR_SUBTEST.VERBAL:   return <VerbalItem item={item} onResponse={onResponse} disabled={disabled} />;
        case ICAR_SUBTEST.SERIES:   return <SeriesItem item={item} onResponse={onResponse} disabled={disabled} />;
        case ICAR_SUBTEST.MATRIX:   return <MatrixItem item={item} onResponse={onResponse} disabled={disabled} />;
        case ICAR_SUBTEST.ROTATION: return <RotationItem item={item} onResponse={onResponse} disabled={disabled} />;
        default:
            return <p className="text-status-error font-mono">Unknown item type: {item.subtest}</p>;
    }
};

const ReasoningCheckTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    // Set when arriving via the summary page's confirm modal — an explicit
    // commitment, so the READY interstitial is skipped. Direct/deep-link
    // entry (no state) still gets the READY gate.
    const confirmedEntryRef = useRef(!!location.state?.confirmed);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const [isResponseInFlight, setIsResponseInFlight] = useState(false);
    const isDevelopment = process.env.NODE_ENV === 'development';

    const {
        currentPhase,
        currentItem,
        currentItemIndex,
        totalItems,
        isLoading,
        error,
        finalResults,
        pendingSaveBanner,
        initializeSession,
        startTask,
        recordResponse,
        skipItem,
        exitEarly,
        devSkipToResults,
    } = useReasoningCheckLogic({
        onExit: () => navigate(SUMMARY_ROUTE),
    });

    // Fetch items + transition to READY on mount.
    useEffect(() => {
        if (currentPhase === TASK_PHASES.INSTRUCTIONS) {
            initializeSession();
        }
    }, [currentPhase, initializeSession]);

    // Confirmed entries start as soon as items are loaded.
    useEffect(() => {
        if (currentPhase === TASK_PHASES.READY && confirmedEntryRef.current) {
            confirmedEntryRef.current = false;
            startTask();
        }
    }, [currentPhase, startTask]);

    // Wrap recordResponse so the same item can't be answered twice while
    // the state update is in flight (defensive — fast double-taps).
    const handleResponse = useCallback((choiceIndex) => {
        if (isResponseInFlight) return;
        setIsResponseInFlight(true);
        recordResponse(choiceIndex);
        // Brief lock; state advances in the same tick so this is mostly
        // belt-and-suspenders.
        setTimeout(() => setIsResponseInFlight(false), 200);
    }, [recordResponse, isResponseInFlight]);

    const handleSkip = useCallback(() => {
        if (isResponseInFlight) return;
        setIsResponseInFlight(true);
        skipItem();
        setTimeout(() => setIsResponseInFlight(false), 200);
    }, [skipItem, isResponseInFlight]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => {
        closeExitModal();
        exitEarly();
    }, [closeExitModal, exitEarly]);

    const isActiveAssessment =
        currentPhase === TASK_PHASES.READY ||
        currentPhase === TASK_PHASES.ITEM ||
        currentPhase === TASK_PHASES.SAVING;

    const showExitButton =
        currentPhase === TASK_PHASES.READY || currentPhase === TASK_PHASES.ITEM;

    // ---- Content per phase ----
    const renderContent = () => {
        if (isLoading && currentPhase !== TASK_PHASES.RESULTS && currentPhase !== TASK_PHASES.ITEM) {
            const message = currentPhase === TASK_PHASES.SAVING ? 'Scoring your responses…' : 'Loading test items…';
            return <LoadingSpinner message={message} theme="auto" />;
        }

        if (error && currentPhase !== TASK_PHASES.RESULTS && currentPhase !== TASK_PHASES.ITEM) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">Couldn't start the test</p>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <button
                        onClick={() => navigate(SUMMARY_ROUTE)}
                        className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider"
                    >
                        Return
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case TASK_PHASES.READY:
                return (
                    <div className="text-center py-8 max-w-xl mx-auto">
                        <p className="text-xl font-serif italic text-theme-text mb-3">Ready to begin</p>
                        <p className="text-sm text-theme-text-secondary mb-6">
                            You'll see <span className="text-theme-text font-mono">{totalItems}</span> items
                            covering verbal reasoning, letter/number series, matrix patterns, and 3-D rotation.
                            There is no time limit per question. Take your time and answer each as best you can.
                        </p>
                        <p className="text-xs text-theme-text-muted mb-6">
                            Once you begin, you cannot pause — leaving or refreshing the page discards progress.
                        </p>
                        <button
                            onClick={startTask}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider inline-flex items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faChevronRight} className="h-3 w-3" />
                            Begin Test
                        </button>
                    </div>
                );

            case TASK_PHASES.ITEM:
                return (
                    <ItemRenderer
                        item={currentItem}
                        onResponse={handleResponse}
                        disabled={isResponseInFlight}
                    />
                );

            case TASK_PHASES.SAVING:
                return <LoadingSpinner message="Scoring your responses…" theme="auto" />;

            case TASK_PHASES.RESULTS:
                return (
                    <ReasoningCheckResults
                        results={finalResults}
                        error={error}
                        pendingSaveBanner={pendingSaveBanner}
                        onDone={() => {
                            // Refresh here (not at save-success) so the results screen
                            // isn't unmounted by AuthGuard's loading state mid-view
                            refreshUserData();
                            navigate(SUMMARY_ROUTE, { state: { justUpdated: true } });
                        }}
                    />
                );

            default:
                return (
                    <div className="text-center py-8">
                        <LoadingSpinner theme="auto" />
                    </div>
                );
        }
    };

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
                            <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faBrain} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    Protocol ICAR-16
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Reasoning Check</h1>
                            </div>
                        </div>

                        {showExitButton && (
                            <button
                                onClick={openExitModal}
                                title="Exit Test Early"
                                aria-label="Exit Test"
                                className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors"
                            >
                                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        {/* Progress header (only during ITEM phase) */}
                        {currentPhase === TASK_PHASES.ITEM && currentItem && (
                            <div className="px-6 py-3 bg-theme-bg-elevated border-b border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                            Item
                                        </span>
                                        <span className="text-sm font-mono text-theme-text">
                                            {currentItemIndex + 1}/{totalItems}
                                        </span>
                                    </div>
                                    <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-theme-line">
                                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                            Type
                                        </span>
                                        <span className="text-sm font-mono text-theme-accent capitalize">
                                            {currentItem.subtest}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={handleSkip}
                                    disabled={isResponseInFlight}
                                    className="text-xs font-mono text-theme-text-muted hover:text-theme-accent uppercase tracking-wider transition-colors disabled:opacity-50"
                                >
                                    Skip
                                </button>
                            </div>
                        )}

                        {/* Progress bar */}
                        {currentPhase === TASK_PHASES.ITEM && (
                            <div className="w-full h-1 bg-theme-bg-surface">
                                <div
                                    className="h-1 bg-theme-accent transition-all duration-300"
                                    style={{ width: `${((currentItemIndex) / totalItems) * 100}%` }}
                                />
                            </div>
                        )}

                        {/* Content */}
                        <div className="p-6 min-h-[450px] flex flex-col justify-center">
                            {renderContent()}
                        </div>
                    </div>

                    {/* Dev Skip */}
                    {isDevelopment && currentPhase === TASK_PHASES.ITEM && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={devSkipToResults}
                                className="px-4 py-2 bg-status-error text-white text-xs font-mono uppercase tracking-wider hover:bg-status-error/80 flex items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faForward} />
                                Skip to Results (DEV)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={isExitModalOpen}
                onClose={closeExitModal}
                onConfirm={confirmExit}
                title="Exit the test?"
                confirmText="Exit"
                cancelText="Continue"
                confirmColor="danger"
                isDestructive={true}
                requiredInputText={null}
            >
                <div className="space-y-3">
                    <p className="text-sm text-theme-text-secondary">
                        Your progress so far won't be saved. You'll need to start the
                        test from the beginning if you come back.
                    </p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export default ReasoningCheckTask;
