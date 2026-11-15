/* src/components/testing/faceNameMemory/FaceNameMemoryInstructionsWrapper.js */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import FaceNameMemoryInstructions from './FaceNameMemoryInstructions';
import { unlockNameAudio } from './hooks/nameAudio';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faAddressCard } from '@fortawesome/free-solid-svg-icons';

const FaceNameMemoryInstructionsWrapper = () => {
    const navigate = useNavigate();
    const { isLoading } = useUser();

    // Familiarization is handled inside the task itself, so no tutorial-completion
    // write is needed here — "Start" simply enters the task.
    const handleStart = useCallback(() => {
        // Unlock audio inside this tap so the study card's auto-played names work
        // on iOS once the task mounts (see nameAudio.js).
        unlockNameAudio();
        navigate('/testing/face-name-memory/run');
    }, [navigate]);

    const handleExit = useCallback(() => {
        navigate('/testing/face-name-memory');
    }, [navigate]);

    if (isLoading) {
        return (
            <div className="w-full min-h-screen lab-grid flex items-center justify-center">
                <LoadingSpinner message="Loading profile..." theme="auto" />
            </div>
        );
    }

    return (
        <div className="w-full min-h-screen lab-grid py-6 px-4">
            <div className="w-full max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faAddressCard} className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[0.6875rem] text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol FNAME-01</p>
                            <h1 className="text-lg font-serif italic text-theme-text">Face-Name Memory Tutorial</h1>
                        </div>
                    </div>
                    <button
                        onClick={handleExit}
                        className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-theme-accent text-theme-text-muted hover:text-theme-accent flex items-center justify-center transition-colors"
                        aria-label="Exit Tutorial"
                        title="Exit Tutorial"
                    >
                        <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                    </button>
                </div>

                <div className="specimen-card overflow-hidden">
                    <FaceNameMemoryInstructions onComplete={handleStart} />
                </div>
            </div>
        </div>
    );
};

export default FaceNameMemoryInstructionsWrapper;
