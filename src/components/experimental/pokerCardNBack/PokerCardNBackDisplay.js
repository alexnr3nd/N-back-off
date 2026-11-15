// src/components/experimental/pokerCardNBack/PokerCardNBackDisplay.js
import React, { useEffect, useState } from 'react';
import './PokerCardStyles.css';

const PokerCardNBackDisplay = ({ suit, rank, feedbackSuit, feedbackRank, isVisible, gameState }) => {
    // State to track card content
    const [cardContent, setCardContent] = useState({ suit: '', rank: '' });
    
    // Effect to update card content when it should be visible
    useEffect(() => {
        if (isVisible && suit && rank) {
            // When card becomes visible, update the content
            setCardContent({ suit, rank });
        }
    }, [isVisible, suit, rank]);
    
    // Get feedback classes for visual feedback
    const getFeedbackClasses = () => {
        const feedbackClasses = [];
        
        if (feedbackSuit === 'correct') {
            feedbackClasses.push('suit-correct-feedback');
        } else if (feedbackSuit === 'incorrect') {
            feedbackClasses.push('suit-incorrect-feedback');
        } else if (feedbackSuit === 'missed') {
            feedbackClasses.push('suit-missed-feedback');
        }
        
        if (feedbackRank === 'correct') {
            feedbackClasses.push('rank-correct-feedback');
        } else if (feedbackRank === 'incorrect') {
            feedbackClasses.push('rank-incorrect-feedback');
        } else if (feedbackRank === 'missed') {
            feedbackClasses.push('rank-missed-feedback');
        }
        
        return feedbackClasses.join(' ');
    };

    // Determine card color based on suit
    const isRedSuit = cardContent.suit === '♥' || cardContent.suit === '♦';
    const cardColor = isRedSuit ? 'text-red-600' : 'text-gray-900';
    
    // Simplified single class for card visibility state
    const cardVisibilityClass = isVisible ? 'face-up' : 'face-down';

    return (
        <div className="card-container">
            {/* Card deck (decorative) */}
            <div className="card-deck"></div>
            
            {/* The actual playing card with simplified CSS classes */}
            <div className={`playing-card ${cardVisibilityClass} ${getFeedbackClasses()}`}>
                <div className="card-inner">
                    {/* Card Back */}
                    <div className="card-back">
                        <div className="card-back-pattern"></div>
                    </div>
                    
                    {/* Card Front */}
                    <div className="card-front">
                        {/* Top left corner */}
                        <div className={`card-corner top-left ${cardColor}`}>
                            <div className="corner-rank">{cardContent.rank}</div>
                            <div className="corner-suit">{cardContent.suit}</div>
                        </div>
                        
                        {/* Center suit & rank */}
                        <div className={`card-center ${cardColor}`}>
                            <div className="center-rank">{cardContent.rank}</div>
                            <div className="center-suit">{cardContent.suit}</div>
                        </div>
                        
                        {/* Bottom right corner */}
                        <div className={`card-corner bottom-right ${cardColor}`}>
                            <div className="corner-rank">{cardContent.rank}</div>
                            <div className="corner-suit">{cardContent.suit}</div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Trial indicator below the card */}
            {gameState === 'playing' && (
                <div className="trial-indicator mt-2 text-center text-sm text-gray-600">
                    {isVisible ? "" : ""}
                </div>
            )}
            {gameState === 'paused' && (
                <div className="trial-indicator mt-2 text-center text-sm font-medium text-yellow-600">
                    Game Paused
                </div>
            )}
        </div>
    );
};

export default PokerCardNBackDisplay;