/* src/components/testing/faceNameMemory/trainer/FaceNameMemoryTrainerTask.js */
/**
 * Full-screen player for one Face-Name Memory Trainer session. Reuses the assessment's
 * FaceNameStudyCard / FaceNameRecallGrid UNTOUCHED; the spaced cross-session flow lives
 * in useFaceNameMemoryTrainerLogic. Each session RECALLS last session's batch (skipped
 * on the first session), then STUDIES a new batch for next time. "Play Again" remounts
 * the inner round (fresh hook) via a key bump.
 */
import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useFaceNameMemoryTrainerLogic from './hooks/useFaceNameMemoryTrainerLogic';
import FaceNameStudyCard from '../FaceNameStudyCard';
import FaceNameRecallGrid from '../FaceNameRecallGrid';
import { unlockNameAudio } from '../hooks/nameAudio';
import TrainerResults from '../../trainer/TrainerResults';
import LoadingSpinner from '../../../ui/LoadingSpinner';
import ConfirmationModal from '../../../ui/ConfirmationModal';
import FeedbackButton from '../../../feedback/FeedbackButton';
import { FACE_NAME_TRAINER_PHASES as P, FACE_NAME_TRAINER as T, formatSetSize } from '../../../../constants/faceNameMemoryTrainerConstants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faAddressCard, faRedo, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const TrainerRound = ({ autoStart, onExit, onPlayAgain }) => {
    const {
        currentPhase, studyView, recallView,
        currentLevel, bestLevel, isFirstSession,
        isReadyToStart, isLoading, error, finalResults,
        initializeSession, startSession, handleRecallSelect, handleExitTrainer,
    } = useFaceNameMemoryTrainerLogic({ onExit });

    const [isExitOpen, setIsExitOpen] = useState(false);

    useEffect(() => {
        if (currentPhase === P.INSTRUCTIONS) initializeSession();
    }, [initializeSession, currentPhase]);

    const autoStartedRef = useRef(false);
    useEffect(() => {
        if (isReadyToStart && autoStart && !autoStartedRef.current) {
            autoStartedRef.current = true;
            startSession();
        }
    }, [isReadyToStart, autoStart, startSession]);

    const openExit = useCallback(() => setIsExitOpen(true), []);
    const closeExit = useCallback(() => setIsExitOpen(false), []);
    const confirmExit = useCallback(() => { closeExit(); handleExitTrainer(); }, [closeExit, handleExitTrainer]);

    const isActive = currentPhase === P.RECALL || currentPhase === P.STUDY || currentPhase === P.SAVING;
    const showExit = currentPhase !== P.RESULTS && currentPhase !== P.SAVING && !isReadyToStart;
    const phaseLabel = currentPhase === P.RECALL ? 'Recall' : (currentPhase === P.STUDY ? 'Study' : 'Trainer');

    const renderContent = () => {
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
            if (autoStart) return <LoadingSpinner message="Loading trainer..." theme="auto" />;
            return (
                <div className="text-center py-8">
                    <p className="text-xl font-serif italic text-theme-text mb-4">Face-Name Memory Trainer</p>
                    <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                        {isFirstSession
                            ? 'Study a set of faces with their spoken names. Next session, recall them before studying a new set.'
                            : 'First, recall the faces you studied last session. Then study a new set for next time.'}
                    </p>
                    <button onClick={() => { unlockNameAudio(); startSession(); }} className="btn-primary-lab px-8 py-3 text-sm font-mono uppercase tracking-wider">Start Session</button>
                </div>
            );
        }
        if (currentPhase === P.RESULTS) {
            if (finalResults && finalResults.isFirstSession && !finalResults.error) {
                return (
                    <div className="text-center py-6 w-full max-w-md mx-auto">
                        <div className="flex justify-center mb-4">
                            <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                                <FontAwesomeIcon icon={faAddressCard} className="text-xl" />
                            </div>
                        </div>
                        <p className="text-xs font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-2">Batch Studied</p>
                        <p className="font-serif italic text-theme-text mb-2">
                            {formatSetSize(finalResults.studiedCount || currentLevel)} studied
                        </p>
                        <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                            Come back next session to recall them. The set size adjusts based on how many you recall.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button onClick={onPlayAgain} className="btn-primary-lab px-6 py-2.5 text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                                <FontAwesomeIcon icon={faRedo} className="h-3 w-3" />New Session
                            </button>
                            <button onClick={onExit} className="px-6 py-2.5 bg-theme-bg-elevated border border-theme-line text-sm font-mono text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors uppercase tracking-wider flex items-center gap-2">
                                <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />Back
                            </button>
                        </div>
                    </div>
                );
            }
            return (
                <TrainerResults
                    results={finalResults}
                    onPlayAgain={onPlayAgain}
                    onDone={onExit}
                    icon={faAddressCard}
                    levelLabel="Set"
                    maxLevel={T.MAX_SET}
                    showMaxBadge
                />
            );
        }
        if (currentPhase === P.RECALL && recallView) {
            return (
                <FaceNameRecallGrid
                    face={recallView.face}
                    options={recallView.options}
                    index={recallView.index}
                    total={recallView.total}
                    phase={recallView.phase}
                    onSelect={(name) => handleRecallSelect(name, false)}
                />
            );
        }
        if (currentPhase === P.STUDY && studyView) {
            return (
                <FaceNameStudyCard
                    pair={studyView.pair}
                    index={studyView.index}
                    total={studyView.total}
                    pass={studyView.pass}
                    totalPasses={studyView.totalPasses}
                />
            );
        }
        // Brief inter-item blank (studyView/recallView momentarily null) — keep the frame stable.
        return <div className="h-40" aria-hidden="true" />;
    };

    return (
        <>
            <div data-game-active={isActive} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
                <div className="w-full max-w-3xl mx-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent text-theme-accent flex items-center justify-center">
                                <FontAwesomeIcon icon={faAddressCard} className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted uppercase tracking-[0.2em] font-mono">Trainer · {phaseLabel}</p>
                                <h1 className="text-lg font-serif italic text-theme-text">Face-Name Memory</h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">
                                    Set {currentLevel}{currentLevel >= T.MAX_SET ? ' · MAX' : ` / ${T.MAX_SET}`}
                                </p>
                                <p className="text-xs font-mono text-theme-accent">Best {bestLevel}</p>
                            </div>
                            {showExit && (
                                <button onClick={openExit} title="Exit Session" className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-status-error text-theme-text-muted hover:text-status-error flex items-center justify-center transition-colors">
                                    <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Main Card */}
                    <div className="bg-theme-bg-secondary border border-theme-line overflow-hidden">
                        <div className="p-6 min-h-[450px] flex flex-col justify-center items-center">{renderContent()}</div>
                    </div>
                </div>
            </div>

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
                <p className="text-sm text-theme-text-secondary">Exit this session? It won't be saved and your set size stays where it is. You can start a new session anytime.</p>
            </ConfirmationModal>
        </>
    );
};

const FaceNameMemoryTrainerTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [roundKey, setRoundKey] = useState(0);
    // Auto-start when arriving from the panel (nav-state) or on "New Session"; a direct
    // visit shows the manual Start screen.
    const autoStart = location.state?.autoStart === true || roundKey > 0;

    const handleExit = useCallback(() => {
        navigate('/testing/face-name-memory', { state: { mode: 'trainer' } });
    }, [navigate]);

    return (
        <TrainerRound
            key={roundKey}
            autoStart={autoStart}
            onExit={handleExit}
            onPlayAgain={() => { unlockNameAudio(); setRoundKey((k) => k + 1); }}
        />
    );
};

export default FaceNameMemoryTrainerTask;
