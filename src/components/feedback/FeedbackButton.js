/* File: src\components\feedback\FeedbackButton.js */

import React, { useState, useCallback } from 'react';
import FeedbackModal from './FeedbackModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCommentDots } from '@fortawesome/free-solid-svg-icons';
// *** ADDED: Import useGame hook to interact with GameContext ***
import { useGame } from '../../contexts/GameContext';
import { SAFE_AREA_BOTTOM } from '../../utils/safeArea';

/**
 * FeedbackButton Component
 * Renders a floating action button to open the feedback modal.
 * Interacts with GameContext to pause the game when the modal is opened
 * (if the game is currently playing) and resumes the game when the modal
 * is closed (only if it was paused by opening this modal).
 */
const FeedbackButton = ({ baseBottomRem = 1.25 }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    // *** ADDED: Get game state and actions from GameContext ***
    const {
        gameState,      // Current state ('idle', 'playing', 'paused', 'results', etc.)
        pauseGame,      // Action to pause the game (accepts an optional reason string)
        resumeGame,     // Action to resume the game
        pauseReason     // The reason the game is currently paused (e.g., 'manual', 'navigation_block', null)
    } = useGame();

    // --- Modal Open Logic ---
    // useCallback ensures function identity stability if needed, though not critical here
    const openModal = useCallback(() => {
        // Check if the game is currently in the 'playing' state
        if (gameState === 'playing') {
             // Pause the game, providing a specific reason 'feedback_modal'
             // This sets gameState to 'paused' and pauseReason to 'feedback_modal' in GameContext
             pauseGame('feedback_modal');
        } else {
             // Log if the modal is opened while the game isn't actively playing
        }
        // Always open the modal visually
        setIsModalOpen(true);
    }, [gameState, pauseGame]); // Dependencies: Recreate if gameState or pauseGame function changes

    // --- Modal Close Logic ---
    // useCallback ensures function identity stability
    const closeModal = useCallback(() => {
        // Capture the current pause reason *before* potential state updates triggered by closing
        const reasonWhenClosing = pauseReason;

        // Close the modal visually first
        setIsModalOpen(false);

        // Check if the game was paused *specifically* because the feedback modal was opened
        if (reasonWhenClosing === 'feedback_modal') {
             // Call the resumeGame action from GameContext
             // This sets gameState back to 'playing' and clears the pauseReason
             resumeGame();
        } else {
             // Log if the modal is closed but the pause reason wasn't 'feedback_modal'
             // This prevents resuming a manually paused game or a game paused for navigation
        }
    }, [pauseReason, resumeGame]); // Dependencies: Recreate if pauseReason or resumeGame function changes

    // --- Render Component ---
    return (
        <>
            {/* Floating Action Button */}
            {/* bottom = base offset + gesture/nav-bar safe-area inset so the button
                clears the Android nav bar on edge-to-edge devices (see safeArea.js) */}
            <button
                onClick={openModal} // Use the updated openModal handler
                style={{ bottom: `calc(${baseBottomRem}rem + ${SAFE_AREA_BOTTOM})` }}
                className={`fixed right-5 z-40 bg-amber-accent hover:bg-amber-highlight text-charcoal rounded-full w-12 h-12 flex items-center justify-center shadow-lg transition-all transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-amber-accent glow-amber`}
                title="Leave Feedback"
                aria-label="Open feedback form"
                // Example: Optionally disable button during specific states like countdown
                // disabled={gameState === 'preparing'}
            >
                <FontAwesomeIcon icon={faCommentDots} size="lg" />
            </button>

            {/* Feedback Modal Component */}
            {/* Pass the updated closeModal handler to the modal */}
            <FeedbackModal isOpen={isModalOpen} onClose={closeModal} />
        </>
    );
};

export default FeedbackButton;