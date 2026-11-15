/* src/components/testing/antisaccade/AntisaccadeTask.js */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useAntisaccadeLogic from './hooks/useAntisaccadeLogic';
import { isPhone, isPortrait, subscribeOrientation } from './hooks/antisaccadeHelpers';
import { ANTISACCADE_PHASES } from '../../../constants/antisaccadeConstants';

import AntisaccadeStimulus from './AntisaccadeStimulus';
import ResponseButtons from './ResponseButtons';
import AntisaccadeResults from './AntisaccadeResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faForward, faTimes, faEye, faRotateRight, faMugHot,
    faMobileScreenButton, faCheck,
} from '@fortawesome/free-solid-svg-icons';
import FeedbackButton from '../../feedback/FeedbackButton';

const P = ANTISACCADE_PHASES;

// Phases rendered as the in-trial layout (full-bleed stimulus band + response
// row). The stimulus and buttons stay MOUNTED across all of these — phase
// flips toggle opacity/visibility only (AntisaccadeStimulus timing contract).
const TRIAL_PHASES = [P.FIXATION, P.TONE, P.CUE, P.TARGET, P.MASK, P.RESPONSE, P.TRIAL_FEEDBACK];

const AntisaccadeTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const isDevelopment = process.env.NODE_ENV === 'development';
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);
    const earlyRetake = location.state?.earlyRetake || false;
    // Summary page passes autoStart with its typed-START confirm (max-2-press
    // flow): the confirm click already unlocked audio app-wide, so the in-task
    // start screen is only the cold-URL fallback. Captured into a ref at mount
    // because the strip effect below rewrites history state — this load's
    // behavior (auto-start, no start-screen flash) must not change mid-session.
    const autoStartRef = useRef(location.state?.autoStart === true);
    const autoStart = autoStartRef.current;

    const {
        currentPhase, currentTrialSpec, isPractice, practiceNumber, practiceTotal,
        trialNumber, totalTrials, completedTrialCount, canSavePartial,
        lastFeedbackCorrect, isFamiliarization, responseEnabled,
        notEligibleMessage, finalScores, isLoading, isReadyToStart, error,
        initializeSession, startSession, startScoredBlock, continueFromBreak,
        skipPractice, handleRespond, handleExitAssessment, handleDevSkipTask,
        voidCurrentTrialForOrientation, setOrientationBlocked,
    } = useAntisaccadeLogic({
        earlyRetake,
        onExit: () => navigate('/testing/antisaccade'),
    });

    // Initialize session on mount (idempotent via didInitRef in the logic hook)
    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) {
            initializeSession();
        }
    }, [initializeSession, currentPhase]);

    // Warm the stimulus typeface at mount. The fonts load with display=swap,
    // so on a cold cache the first practice flashes could otherwise render in
    // a fallback font whose O/Q are peripherally discriminable — exactly what
    // Rubik is there to prevent (see LATERAL_LETTER_CLASS in
    // AntisaccadeStimulus.js). Mount → first target is several seconds
    // (ready screen + 2-3s fixation), plenty for the ~15KB face.
    useEffect(() => {
        try {
            document.fonts?.load('400 1rem Rubik')?.catch(() => {});
        } catch (e) {
            // FontFaceSet unsupported (jsdom, old WebViews) — swap still applies
        }
    }, []);

    // Consume the autoStart flag from history state at mount: location.state
    // persists across reloads and tab restores, but the summary confirm's
    // audio unlock does not — a restored load that auto-started would run
    // startSession's unlock await with no gesture available (the deadlock
    // behind the stuck "Initializing Task..." screen; the hook's 500ms unlock
    // race is the second guard). Stripping the flag makes any LATER load fall
    // back to the Begin Practice screen, a real gesture that restores the
    // beep. autoStartRef above keeps THIS load auto-starting.
    useEffect(() => {
        if (location.state?.autoStart) {
            navigate(location.pathname, {
                replace: true,
                state: { ...location.state, autoStart: false },
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-start once the structure is loaded when the summary page requested
    // it. Fires exactly once (ref cleared before the call; the hook's
    // didStartRef double-guards). startSession's audio-unlock attempt outside
    // a gesture is non-blocking (500ms race in the hook).
    const autoStartPendingRef = useRef(autoStart);
    useEffect(() => {
        if (isReadyToStart && autoStartPendingRef.current) {
            autoStartPendingRef.current = false;
            startSession();
        }
    }, [isReadyToStart, startSession]);

    // --- Orientation gate (phone + portrait blocks the task) ---
    // The ±28vw lateral glyphs need landscape width on phones; portrait would
    // shrink the saccade to a trivial excursion.
    const [portraitBlocked, setPortraitBlocked] = useState(() => isPhone() && isPortrait());
    useEffect(() => subscribeOrientation((portrait) => {
        // isPhone() re-evaluated at change time: media queries reflect the
        // post-rotation dimensions, and rotating OUT of portrait must always
        // clear the overlay regardless of the width check.
        setPortraitBlocked(portrait && isPhone());
    }), []);

    // Hook wiring (order-insensitive per the hook's contract): while blocked,
    // trial starts are deferred; the transition INTO portrait also voids an
    // in-flight presentation (during MASK/RESPONSE it flags instead — the
    // target was already shown). Both calls are idempotent, so a re-run from
    // callback-identity churn is safe.
    useEffect(() => {
        setOrientationBlocked(portraitBlocked);
        if (portraitBlocked) {
            voidCurrentTrialForOrientation();
        }
    }, [portraitBlocked, setOrientationBlocked, voidCurrentTrialForOrientation]);

    const openExitModal = useCallback(() => setIsExitModalOpen(true), []);
    const closeExitModal = useCallback(() => setIsExitModalOpen(false), []);
    const confirmExit = useCallback(() => { closeExitModal(); handleExitAssessment(); }, [closeExitModal, handleExitAssessment]);

    const handleDone = useCallback(() => {
        // Refresh AFTER the task is finished (Done press), never at save-success
        // — refreshing earlier unmounts the in-task results screen.
        refreshUserData();
        navigate('/testing/antisaccade', { state: { justUpdatedAntisaccade: true } });
    }, [refreshUserData, navigate]);

    const isTrialPhase = TRIAL_PHASES.includes(currentPhase);
    const showFeedback = currentPhase === P.TRIAL_FEEDBACK && lastFeedbackCorrect !== null;

    // --- Render: non-trial screens (inside the standard card) ---
    const renderScreenContent = () => {
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
                    <button onClick={() => navigate('/testing/antisaccade')} className="px-6 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors text-sm font-mono uppercase tracking-wider">
                        Return to Summary
                    </button>
                </div>
            );
        }

        // Cold-URL fallback start screen (audio-unlock gesture). With
        // autoStart the effect above starts the session — show the loading
        // state instead so the start screen never flashes.
        if (isReadyToStart) {
            if (autoStart) {
                return <LoadingSpinner message="Loading assessment..." theme="auto" />;
            }
            return (
                <div className="text-center py-8">
                    <p className="text-xl font-serif italic text-theme-text mb-4">Practice First</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                        The {practiceTotal} practice trials run at a slower pace. Keep your
                        eyes on the center cross — when the asterisk flashes to one side,
                        look to the opposite side and catch the letter. A short beep sounds
                        before each trial.
                    </p>
                    <button
                        onClick={startSession}
                        className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                    >
                        Begin Practice
                    </button>
                </div>
            );
        }

        switch (currentPhase) {
            case P.READY:
                return (
                    <div className="text-center py-8">
                        <p className="text-xl font-serif italic text-theme-text mb-4">Practice Complete</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            The {totalTrials} scored trials start now, with a short break at
                            the halfway point. The letter flashes much faster from here —
                            accuracy matters, not speed.
                        </p>
                        <button
                            onClick={startScoredBlock}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Begin Scored Trials
                        </button>
                    </div>
                );

            case P.BREAK:
                return (
                    <div className="text-center py-8">
                        <div className="h-12 w-12 mx-auto mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faMugHot} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="text-xl font-serif italic text-theme-text mb-4">Halfway There</p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Take a short break. Continue whenever you're ready — the remaining
                            {' '}{totalTrials - completedTrialCount} trials work exactly the same way.
                        </p>
                        <button
                            onClick={continueFromBreak}
                            className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider"
                        >
                            Continue
                        </button>
                    </div>
                );

            case P.INTERRUPTED:
                return (
                    <div className="h-80 flex flex-col items-center justify-center text-center">
                        <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                            <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                        </div>
                        <p className="font-serif italic text-theme-text mb-2">Trial Interrupted</p>
                        <p className="text-sm text-theme-text-secondary max-w-xs">
                            This trial doesn't count and will be redone. Keep this screen
                            visible and the device in landscape while the stimuli are flashing.
                        </p>
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
                            <button onClick={() => navigate('/testing/antisaccade')} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">
                                Return to Summary
                            </button>
                        </div>
                    );
                }
                return (
                    <AntisaccadeResults
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
        && (currentPhase !== P.INSTRUCTIONS || isReadyToStart);

    const isActiveAssessment = currentPhase !== P.RESULTS && currentPhase !== P.INSTRUCTIONS;

    // The overlay never covers RESULTS — scores stay readable in portrait and
    // the Done button stays pressable. (setOrientationBlocked stays wired
    // regardless; with no trial in flight it has no effect.)
    const showOrientationOverlay = portraitBlocked && currentPhase !== P.RESULTS;

    const headerLabel = isPractice
        ? 'Practice'
        : (isFamiliarization ? 'Familiarization' : 'Monthly Assessment');

    return (
        <>
            {/* px-4 lives on the inner sections (not the root) so the trial
                stimulus band can run full-bleed without an overflow wrapper */}
            <div data-game-active={isActiveAssessment} className="min-h-screen bg-theme-bg-base py-6 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto px-4">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`h-10 w-10 bg-theme-bg-secondary border flex items-center justify-center ${isFamiliarization || isPractice ? 'border-theme-accent text-theme-accent' : 'border-warm-muted text-theme-text-muted'}`}>
                                <FontAwesomeIcon icon={faEye} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">
                                    {headerLabel}
                                </p>
                                <h1 className="text-lg font-serif italic text-theme-text">Antisaccade</h1>
                            </div>
                        </div>

                        {showExitButton && (
                            <button onClick={openExitModal} title="Exit Assessment Early" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </div>

                {isTrialPhase ? (
                    /* In-trial layout. The stimulus band is FULL-BLEED: the
                       lateral glyphs sit at ±28vw from viewport center, so it
                       must never go inside the max-w-3xl / overflow-hidden
                       card (the VA pattern would clip it on desktop). */
                    <div className="w-full">
                        {/* Progress strip — static through the whole trial
                            (numbers change only at trial start; the hint only
                            at mask onset, after the target is gone), so unlike
                            VA there is no mid-presentation blanking needed. */}
                        <div className="max-w-3xl mx-auto px-4">
                            <div className="px-6 py-3 bg-theme-bg-elevated border border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                        {isPractice ? 'Practice' : 'Trial'}
                                    </span>
                                    <span className="text-sm font-mono text-theme-text">
                                        {isPractice ? `${practiceNumber}/${practiceTotal}` : `${trialNumber}/${totalTrials}`}
                                    </span>
                                </div>
                                {responseEnabled && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">
                                        Which letter appeared?
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Stimulus band (provides its own height + background) */}
                        <div className="relative w-full mt-4">
                            <AntisaccadeStimulus
                                phase={currentPhase}
                                cueSide={currentTrialSpec?.cueSide}
                                targetSide={currentTrialSpec?.targetSide}
                                letter={currentTrialSpec?.letter}
                            />
                            {/* Trial feedback overlay — band is blank during
                                TRIAL_FEEDBACK; opacity toggle only (mirrors
                                the stimulus contract: no mounting churn) */}
                            <div
                                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                                style={{ opacity: showFeedback ? 1 : 0 }}
                            >
                                <div className={`border flex items-center justify-center ${isPractice ? 'h-14 w-14' : 'h-10 w-10'} ${
                                    lastFeedbackCorrect
                                        ? 'bg-status-success/20 border-status-success'
                                        : 'bg-status-error/20 border-status-error'
                                }`}>
                                    <FontAwesomeIcon
                                        icon={lastFeedbackCorrect ? faCheck : faTimes}
                                        className={`${isPractice ? 'h-6 w-6' : 'h-4 w-4'} ${lastFeedbackCorrect ? 'text-status-success' : 'text-status-error'}`}
                                    />
                                </div>
                                {/* Practice spells it out; scored keeps the brief chip */}
                                {isPractice && (
                                    <p className={`mt-3 text-lg font-serif italic ${lastFeedbackCorrect ? 'text-status-success' : 'text-status-error'}`}>
                                        {lastFeedbackCorrect ? 'Correct' : 'Incorrect'}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Mounted through all trial phases so mask onset causes
                            no layout shift; shown when the response window opens */}
                        <div
                            style={{ visibility: responseEnabled ? 'visible' : 'hidden' }}
                            className="w-full max-w-3xl mx-auto px-4 mt-4"
                        >
                            <ResponseButtons
                                onRespond={handleRespond}
                                responseEnabled={responseEnabled && !isExitModalOpen && !portraitBlocked}
                                useArrowKeys
                            />
                        </div>

                        {/* Skip practice — scored sessions only. Sits below the
                            response row, outside the full-bleed stimulus band;
                            the portrait overlay replaces it with its own exit
                            affordance, so it hides while that overlay shows. */}
                        {isPractice && !isFamiliarization && !isLoading && !showOrientationOverlay && (
                            <div className="w-full max-w-3xl mx-auto px-4 mt-4 flex justify-center">
                                <button
                                    onClick={skipPractice}
                                    className="font-mono text-xs uppercase tracking-wider text-theme-text-secondary hover:text-theme-accent transition-colors"
                                >
                                    Skip practice →
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Screen layout (VA main-card pattern) for everything else */
                    <div className="w-full max-w-3xl mx-auto px-4">
                        <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                            <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">
                                {renderScreenContent()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Dev Skip */}
                {isDevelopment && showExitButton && (
                    <div className="max-w-3xl mx-auto px-4 mt-4 flex justify-center">
                        <button onClick={handleDevSkipTask} disabled={isLoading} className="px-4 py-2 bg-status-error text-white text-xs font-mono uppercase tracking-wider hover:bg-status-error/80 disabled:opacity-50 flex items-center gap-2">
                            <FontAwesomeIcon icon={faForward} />
                            Skip to Results (DEV)
                        </button>
                    </div>
                )}
            </div>

            {/* Orientation gate — full-bleed, above the task but BELOW the
                exit ConfirmationModal (z 99999) so exiting stays possible in
                portrait. Safe-area padding for Android 15/16 edge-to-edge. */}
            {showOrientationOverlay && (
                <div
                    data-testid="orientation-overlay"
                    className="fixed inset-0 z-[99998] bg-theme-bg flex flex-col items-center justify-center text-center"
                    style={{
                        paddingTop: 'max(2rem, env(safe-area-inset-top))',
                        paddingRight: 'max(2rem, env(safe-area-inset-right))',
                        paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
                        paddingLeft: 'max(2rem, env(safe-area-inset-left))',
                    }}
                >
                    <FontAwesomeIcon icon={faMobileScreenButton} className="h-14 w-14 text-theme-accent rotate-90 mb-6" />
                    <p className="text-xl font-serif italic text-theme-text mb-3">Rotate to Landscape</p>
                    <p className="text-sm font-mono text-theme-text-secondary max-w-xs">
                        The stimuli use the full width of the screen. Hold the device in
                        landscape to continue.
                    </p>
                    {/* Explicit exit path for portrait-locked users (C6 review):
                        same confirm-modal flow as the header exit button — the
                        modal renders at z-[99999], above this overlay. Same
                        visibility rule as the header button. */}
                    {showExitButton && (
                        <button
                            onClick={openExitModal}
                            className="mt-6 text-sm font-mono text-theme-text-secondary underline underline-offset-4 hover:text-theme-accent transition-colors"
                        >
                            Exit assessment
                        </button>
                    )}
                </div>
            )}

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
                                : <>Not enough trials are completed to produce a score, so your progress will be discarded. You can start the assessment again whenever you're ready.</>
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

export default AntisaccadeTask;
