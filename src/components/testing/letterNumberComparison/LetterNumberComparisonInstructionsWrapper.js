/* src/components/testing/letterNumberComparison/LetterNumberComparisonInstructionsWrapper.js */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import LetterNumberComparisonInstructions from './LetterNumberComparisonInstructions';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faStopwatch } from '@fortawesome/free-solid-svg-icons';

const LetterNumberComparisonInstructionsWrapper = () => {
    const navigate = useNavigate();
    const { userId, markTutorialCompleted, isLoading } = useUser();

    const handleTutorialComplete = useCallback(async () => {
        if (userId) {
            try {
                await markTutorialCompleted(userId, CST_TEST_TYPES.LETTER_NUMBER_COMPARISON);
            } catch (error) {
                console.error('Failed to mark Letter & Number Comparison tutorial complete:', error);
            }
        }
        navigate('/testing/letter-number-comparison', { replace: true });
    }, [navigate, userId, markTutorialCompleted]);

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
                            <FontAwesomeIcon icon={faStopwatch} className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[0.6875rem] text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol LNC-01</p>
                            <h1 className="text-lg font-serif italic text-theme-text">Letter &amp; Number Comparison Tutorial</h1>
                        </div>
                    </div>
                    <button
                        onClick={handleTutorialComplete}
                        className="h-10 w-10 bg-theme-bg-secondary border border-theme-line hover:border-theme-accent text-theme-text-muted hover:text-theme-accent flex items-center justify-center transition-colors"
                        aria-label="Exit Tutorial"
                        title="Exit Tutorial"
                    >
                        <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                    </button>
                </div>

                <div className="specimen-card overflow-hidden">
                    <LetterNumberComparisonInstructions onComplete={handleTutorialComplete} />
                </div>
            </div>
        </div>
    );
};

export default LetterNumberComparisonInstructionsWrapper;
