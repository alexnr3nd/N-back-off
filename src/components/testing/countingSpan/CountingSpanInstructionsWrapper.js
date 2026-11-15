/* src/components/testing/countingSpan/CountingSpanInstructionsWrapper.js */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import CountingSpanInstructions from './CountingSpanInstructions';
import { CST_TEST_TYPES } from '../../../constants/cstConstants';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCalculator } from '@fortawesome/free-solid-svg-icons';

/**
 * Wrapper component for the Counting Span Instructions.
 * Renders the instructions and handles the callback when the user finishes
 * interacting with them (e.g., completes the practice steps within).
 * Marks the tutorial as complete and navigates back to the summary page.
 * Includes an Exit button.
 * Redesigned with Cognitive Lab aesthetic.
 */
const CountingSpanInstructionsWrapper = () => {
    const navigate = useNavigate();
    const { userId, markTutorialCompleted, isLoading } = useUser();

    /**
     * Callback function passed to CountingSpanInstructions or used by Exit button.
     * Triggered when the user completes the instruction/practice sequence or exits.
     * Marks the tutorial as seen for this profile and navigates back to the summary.
     */
    const handleTutorialComplete = useCallback(async () => {
        if (userId) {
            try {
                await markTutorialCompleted(userId, CST_TEST_TYPES.COUNTING_SPAN);
            } catch (error) {
                console.error("Failed to mark tutorial complete in background:", error);
            }
        } else {
            console.warn("Cannot mark tutorial complete, no user ID found.");
        }

        navigate('/testing/counting-span', { replace: true });

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
                {/* Header with exit button */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-theme-bg-secondary border border-theme-accent flex items-center justify-center text-theme-accent">
                            <FontAwesomeIcon icon={faCalculator} className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[0.6875rem] text-theme-text-muted uppercase tracking-[0.2em] font-mono">Protocol CST-01</p>
                            <h1 className="text-lg font-serif italic text-theme-text">Counting Span Tutorial</h1>
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

                {/* Main content card */}
                <div className="specimen-card overflow-hidden">
                    <CountingSpanInstructions onStartAssessment={handleTutorialComplete} />
                </div>
            </div>
        </div>
    );
};

export default CountingSpanInstructionsWrapper;
