/* src/components/testing/antisaccade/trainer/AntisaccadeTrainerTask.js */
/**
 * Full-screen player for one ~1-minute Antisaccade Trainer round. Reuses the
 * shared AntisaccadeStimulus / ResponseButtons / orientation helpers; the
 * staircase + session flow live in useAntisaccadeTrainerLogic. "Play Again"
 * remounts the inner round (fresh hook) via a key bump.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAntisaccadeTrainerLogic from './hooks/useAntisaccadeTrainerLogic';
import AntisaccadeTrainerResults from './AntisaccadeTrainerResults';
import { isPhone, isPortrait, subscribeOrientation } from '../hooks/antisaccadeHelpers';
import { ANTISACCADE_PHASES as P, MAX_LEVEL } from '../../../../constants/antisaccadeTrainerConstants';
import AntisaccadeStimulus from '../AntisaccadeStimulus';
import ResponseButtons from '../ResponseButtons';
import LoadingSpinner from '../../../ui/LoadingSpinner';
import ConfirmationModal from '../../../ui/ConfirmationModal';
import FeedbackButton from '../../../feedback/FeedbackButton';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faDumbbell, faFire, faMobileScreenButton, faCheck, faRotateRight } from '@fortawesome/free-solid-svg-icons';

const TRIAL_PHASES = [P.FIXATION, P.TONE, P.CUE, P.TARGET, P.MASK, P.RESPONSE, P.TRIAL_FEEDBACK];

const TrainerRound = ({ autoStart, onExit, onPlayAgain }) => {
    const {
        currentPhase, currentTrialSpec, currentLevers, responseEnabled, lastFeedbackCorrect,
        trialNumber, totalTrials, currentLevel, roundStreak,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, handleRespond, handleExitTrainer,
        voidCurrentTrialForOrientation, setOrientationBlocked,
    } = useAntisaccadeTrainerLogic({ onExit });

    const [isExitOpen, setIsExitOpen] = useState(false);

    // Initialize once on mount (the hook guards re-init).
    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) initializeSession();
    }, [initializeSession, currentPhase]);

    // Warm the Rubik target face so the first flash never falls back to a more
    // peripherally-discriminable font (see AntisaccadeStimulus).
    useEffect(() => {
        try { document.fonts?.load('400 1rem Rubik')?.catch(() => {}); } catch (e) { /* unsupported */ }
    }, []);

    // Auto-start once the structure is loaded (the Panel's Start click unlocked audio).
    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (isReadyToStart && autoStart && !autoStartedRef.current) {
            autoStartedRef.current = true;
            startSession();
        }
    }, [isReadyToStart, autoStart, startSession]);

    // Orientation gate (phone + portrait blocks the lateral glyphs).
    const [portraitBlocked, setPortraitBlocked] = useState(() => isPhone() && isPortrait());
    useEffect(() => subscribeOrientation((portrait) => setPortraitBlocked(portrait && isPhone())), []);
    useEffect(() => {
        setOrientationBlocked(portraitBlocked);
        if (portraitBlocked) voidCurrentTrialForOrientation();
    }, [portraitBlocked, setOrientationBlocked, voidCurrentTrialForOrientation]);

    const openExit = useCallback(() => setIsExitOpen(true), []);
    const closeExit = useCallback(() => setIsExitOpen(false), []);
    const confirmExit = useCallback(() => { closeExit(); handleExitTrainer(); }, [closeExit, handleExitTrainer]);

    const isTrialPhase = TRIAL_PHASES.includes(currentPhase);
    const isActive = isTrialPhase || currentPhase === P.SAVING;
    const showFeedback = currentPhase === P.TRIAL_FEEDBACK && lastFeedbackCorrect !== null;
    const showOrientationOverlay = portraitBlocked && currentPhase !== P.RESULTS;
    const showExit = currentPhase !== P.RESULTS && currentPhase !== P.SAVING && !isReadyToStart;

    const renderScreen = () => {
        if (isLoading && currentPhase !== P.RESULTS) {
            return <LoadingSpinner message={currentPhase === P.SAVING ? 'Saving session...' : 'Loading trainer...'} theme="auto" />;
        }
        if (error && currentPhase !== P.RESULTS) {
            return (
                <div className="text-center p-6">
                    <div className="h-12 w-12 mx-auto mb-4 bg-status-error/20 border border-status-error flex items-center justify-center">
                        <FontAwesomeIcon icon={faTimes} className="h-5 w-5 text-status-error" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">Can't Start the Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">{error}</p>
                    <button onClick={onExit} className="btn-primary-lab px-6 py-2 text-sm font-mono uppercase tracking-wider">Back</button>
                </div>
            );
        }
        if (isReadyToStart) {
            // autoStart path shows loading; cold URL gets a one-tap start.
            if (autoStart) return <LoadingSpinner message="Loading trainer..." theme="auto" />;
            return (
                <div className="text-center py-8">
                    <p className="text-xl font-serif italic text-theme-text mb-4">Antisaccade Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                        A short session of about a minute. When the asterisk flashes to one side, look the other way and catch the
                        letter (Q or O). Difficulty rises and falls to keep you near your edge.
                    </p>
                    <button onClick={startSession} className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider">Start Session</button>
                </div>
            );
        }
        if (currentPhase === P.INTERRUPTED) {
            return (
                <div className="h-72 flex flex-col items-center justify-center text-center">
                    <div className="h-12 w-12 mb-4 bg-theme-accent/10 border border-theme-accent flex items-center justify-center">
                        <FontAwesomeIcon icon={faRotateRight} className="h-5 w-5 text-theme-accent" />
                    </div>
                    <p className="font-serif italic text-theme-text mb-2">Trial Interrupted</p>
                    <p className="text-sm text-theme-text-secondary max-w-xs">This trial will be redone. Keep the screen visible and in landscape.</p>
                </div>
            );
        }
        if (currentPhase === P.RESULTS) {
            return <AntisaccadeTrainerResults results={finalResults} onPlayAgain={onPlayAgain} onDone={onExit} />;
        }
        return <LoadingSpinner theme="auto" />;
    };

    return (
        <>
            <div data-game-active={isActive} className="min-h-screen bg-theme-bg-base py-6 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto px-4">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent text-theme-accent flex items-center justify-center">
                                <FontAwesomeIcon icon={faDumbbell} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Trainer</p>
                                <h1 className="text-lg font-serif italic text-theme-text">Antisaccade</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">Level {currentLevel}{currentLevel >= MAX_LEVEL ? ' · MAX' : ` / ${MAX_LEVEL}`}</p>
                                <p className="text-xs font-mono text-theme-accent flex items-center justify-end gap-1" title="Correct in a row">
                                    <FontAwesomeIcon icon={faFire} className="h-2.5 w-2.5" />{roundStreak}
                                </p>
                            </div>
                            {showExit && (
                                <button onClick={openExit} title="Exit Session" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {isTrialPhase ? (
                    <div className="w-full">
                        <div className="max-w-3xl mx-auto px-4">
                            <div className="px-6 py-3 bg-theme-bg-elevated border border-theme-line flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">Trial</span>
                                    <span className="text-sm font-mono text-theme-text">{trialNumber}/{totalTrials}</span>
                                </div>
                                {responseEnabled && (
                                    <span className="hidden sm:inline text-xs font-mono text-theme-accent uppercase tracking-wider">Which letter appeared?</span>
                                )}
                            </div>
                        </div>

                        <div className="relative w-full mt-4">
                            <AntisaccadeStimulus
                                phase={currentPhase}
                                cueSide={currentTrialSpec?.cueSide}
                                targetSide={currentTrialSpec?.targetSide}
                                letter={currentTrialSpec?.letter}
                                eccentricityVw={currentLevers?.eccentricityVw}
                                fixationThroughTarget={currentLevers?.fixationThroughTarget}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: showFeedback ? 1 : 0 }}>
                                <div className={`h-12 w-12 border flex items-center justify-center ${lastFeedbackCorrect ? 'bg-status-success/20 border-status-success' : 'bg-status-error/20 border-status-error'}`}>
                                    <FontAwesomeIcon icon={lastFeedbackCorrect ? faCheck : faTimes} className={`h-5 w-5 ${lastFeedbackCorrect ? 'text-status-success' : 'text-status-error'}`} />
                                </div>
                            </div>
                        </div>

                        <div style={{ visibility: responseEnabled ? 'visible' : 'hidden' }} className="w-full max-w-3xl mx-auto px-4 mt-4">
                            <ResponseButtons onRespond={handleRespond} responseEnabled={responseEnabled && !isExitOpen && !portraitBlocked} useArrowKeys />
                        </div>
                    </div>
                ) : (
                    <div className="w-full max-w-3xl mx-auto px-4">
                        <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                            <div className="p-6 min-h-[420px] flex flex-col justify-center items-center">{renderScreen()}</div>
                        </div>
                    </div>
                )}
            </div>

            {showOrientationOverlay && (
                <div data-testid="orientation-overlay" className="fixed inset-0 z-[99998] bg-theme-bg flex flex-col items-center justify-center text-center"
                    style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))', paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
                    <FontAwesomeIcon icon={faMobileScreenButton} className="h-14 w-14 text-theme-accent rotate-90 mb-6" />
                    <p className="text-xl font-serif italic text-theme-text mb-3">Rotate to Landscape</p>
                    <p className="text-sm font-mono text-theme-text-secondary max-w-xs">Hold the device in landscape to continue.</p>
                    {showExit && (
                        <button onClick={openExit} className="mt-6 text-sm font-mono text-theme-text-secondary underline underline-offset-4 hover:text-theme-accent transition-colors">Exit session</button>
                    )}
                </div>
            )}

            <FeedbackButton />

            <ConfirmationModal
                isOpen={isExitOpen}
                onClose={closeExit}
                onConfirm={confirmExit}
                title="Exit Session"
                confirmText="Exit"
                cancelText="Keep Going"
                confirmColor="amber"
                isDestructive={false}
            >
                <p className="text-sm text-theme-text-secondary">Exit this session? It won't be saved and your level stays where it is. You can start a new session anytime.</p>
            </ConfirmationModal>
        </>
    );
};

const AntisaccadeTrainerTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [roundKey, setRoundKey] = useState(0);
    const autoStart = location.state?.autoStart === true || roundKey > 0;

    const handleExit = useCallback(() => {
        navigate('/testing/antisaccade', { state: { mode: 'trainer' } });
    }, [navigate]);

    return (
        <TrainerRound
            key={roundKey}
            autoStart={autoStart}
            onExit={handleExit}
            onPlayAgain={() => setRoundKey((k) => k + 1)}
        />
    );
};

export default AntisaccadeTrainerTask;
