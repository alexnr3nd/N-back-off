/* src/components/testing/faceNameMemory/FaceNameMemoryTask.js */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import useFaceNameMemoryLogic from './hooks/useFaceNameMemoryLogic';
import { FACE_NAME_MEMORY_PHASES } from '../../../constants/faceNameMemoryConstants';
import FaceNameStudyCard from './FaceNameStudyCard';
import FaceNameRecallGrid from './FaceNameRecallGrid';
import FaceNameDelayDistractor from './FaceNameDelayDistractor';
import FaceNameMemoryResults from './FaceNameMemoryResults';
import LoadingSpinner from '../../ui/LoadingSpinner';
import ConfirmationModal from '../../ui/ConfirmationModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark } from '@fortawesome/free-solid-svg-icons';

const P = FACE_NAME_MEMORY_PHASES;
const SUMMARY_ROUTE = '/testing/face-name-memory';
// Phases that are active gameplay — auto-refresh must be blocked here
// (data-game-active; see CLAUDE.md Game & Assessment Requirements).
const ACTIVE_PHASES = [P.STUDY, P.IMMEDIATE_RECALL, P.DELAY, P.DELAYED_RECALL, P.SAVING];

const FaceNameMemoryTask = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { refreshUserData } = useUser();
    const earlyRetake = location.state?.earlyRetake === true;
    const [showExit, setShowExit] = useState(false);

    const exitToSummary = useCallback(() => navigate(SUMMARY_ROUTE, { replace: true }), [navigate]);

    const {
        currentPhase, isFamiliarization, studyView, recallView, finalScores,
        notEligibleMessage, isLoading, error, delayMs,
        initializeSession, handleRecallSelect, handleDelayComplete, handleExit,
    } = useFaceNameMemoryLogic({ earlyRetake, onExit: exitToSummary });

    useEffect(() => {
        window.scrollTo(0, 0);
        initializeSession();
    }, [initializeSession]);

    const isActive = ACTIVE_PHASES.includes(currentPhase);

    // Refresh user data on the Done handler (NOT at save-success) to avoid the
    // results-screen unmount bug shared by CST/OSpan.
    const handleDone = useCallback(async () => {
        try { if (typeof refreshUserData === 'function') await refreshUserData(); } catch (e) { /* ignore */ }
        navigate(SUMMARY_ROUTE, { replace: true });
    }, [refreshUserData, navigate]);

    return (
        <div data-game-active={isActive} className="min-h-screen bg-theme-bg-base py-6 px-4 lab-grid lab-grid-radial">
            <div className="max-w-2xl mx-auto">
                {isActive && currentPhase !== P.SAVING && (
                    <div className="flex justify-end mb-2">
                        <button
                            onClick={() => setShowExit(true)}
                            className="text-theme-text-muted hover:text-theme-text text-xs flex items-center gap-1"
                        >
                            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" /> Exit
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-center min-h-[60vh]">
                    {(currentPhase === P.LOADING || (isLoading && currentPhase !== P.RESULTS)) && (
                        <LoadingSpinner message="Preparing assessment" />
                    )}

                    {currentPhase === P.STUDY && studyView && (
                        <FaceNameStudyCard {...studyView} />
                    )}

                    {(currentPhase === P.IMMEDIATE_RECALL || currentPhase === P.DELAYED_RECALL) && recallView && (
                        <FaceNameRecallGrid {...recallView} onSelect={(name) => handleRecallSelect(name, false)} />
                    )}

                    {currentPhase === P.DELAY && (
                        <FaceNameDelayDistractor durationMs={delayMs} onComplete={handleDelayComplete} />
                    )}

                    {currentPhase === P.SAVING && <LoadingSpinner message="Saving your results" />}

                    {currentPhase === P.RESULTS && (
                        <FaceNameMemoryResults
                            finalScores={finalScores}
                            isFamiliarization={isFamiliarization}
                            notEligibleMessage={notEligibleMessage}
                            error={error}
                            onDone={handleDone}
                        />
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={showExit}
                title="Leave the assessment?"
                message="Your progress will be discarded and this session won't be saved."
                confirmText="Leave"
                cancelText="Keep going"
                isDestructive
                onConfirm={() => { setShowExit(false); handleExit(); }}
                onClose={() => setShowExit(false)}
            />
        </div>
    );
};

export default FaceNameMemoryTask;
