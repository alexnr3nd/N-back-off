// src/components/experimental/pokerCardNBack/PokerCardNBackControls.js
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHeart, faClone, faSortNumericDown, faFont } from '@fortawesome/free-solid-svg-icons';

const PokerCardNBackControls = ({ onSuitMatch, onRankMatch, disabled, feedbackSuit, feedbackRank }) => {
    // Helper functions for button styling based on feedback state
    const getSuitButtonClasses = () => {
        let baseClasses = "w-full px-4 py-3 rounded-lg shadow-sm font-medium text-base flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";
        
        if (disabled) {
            return `${baseClasses} bg-gray-200 text-gray-500 cursor-not-allowed`;
        }
        
        switch (feedbackSuit) {
            case 'correct':
                return `${baseClasses} bg-green-500 hover:bg-green-600 text-white focus:ring-green-500 animate-pulse`;
            case 'incorrect':
                return `${baseClasses} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 animate-pulse`;
            case 'missed':
                return `${baseClasses} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500 animate-pulse`;
            default:
                return `${baseClasses} bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 focus:ring-red-500`;
        }
    };
    
    const getRankButtonClasses = () => {
        let baseClasses = "w-full px-4 py-3 rounded-lg shadow-sm font-medium text-base flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";
        
        if (disabled) {
            return `${baseClasses} bg-gray-200 text-gray-500 cursor-not-allowed`;
        }
        
        switch (feedbackRank) {
            case 'correct':
                return `${baseClasses} bg-green-500 hover:bg-green-600 text-white focus:ring-green-500 animate-pulse`;
            case 'incorrect':
                return `${baseClasses} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 animate-pulse`;
            case 'missed':
                return `${baseClasses} bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-500 animate-pulse`;
            default:
                return `${baseClasses} bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 focus:ring-blue-500`;
        }
    };

    return (
        <div className="w-full max-w-md">
            {/* Hint text removed as per request to remove "Observe" text */}
            
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                    <button
                        onClick={onSuitMatch}
                        disabled={disabled}
                        className={getSuitButtonClasses()}
                        aria-label="Suit Match"
                    >
                        <FontAwesomeIcon icon={faHeart} className="mr-2 h-5 w-5" />
                        <span>Suit Match</span>
                    </button>
                    <div className="mt-1 text-center text-xs text-gray-600">
                        Press when suits match (♥,♦,♣,♠)
                    </div>
                </div>
                
                <div className="flex flex-col">
                    <button
                        onClick={onRankMatch}
                        disabled={disabled}
                        className={getRankButtonClasses()}
                        aria-label="Rank Match"
                    >
                        <FontAwesomeIcon icon={faFont} className="mr-2 h-5 w-5" />
                        <span>Rank Match</span>
                    </button>
                    <div className="mt-1 text-center text-xs text-gray-600">
                        Press when ranks match (A,K,Q,...)
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PokerCardNBackControls;