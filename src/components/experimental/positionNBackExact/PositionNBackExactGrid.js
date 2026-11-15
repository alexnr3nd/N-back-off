// src/components/experimental/positionNBackExact/PositionNBackExactGrid.js
import React, { useState, useEffect } from 'react';

const PositionNBackExactGrid = ({
  currentStimulusPosition, // number | null (0-8)
  onCellClick, // function(positionIndex)
  feedback, // { position: number, type: 'correct' | 'incorrect' } | null
  missedTargetFeedback, // number | null (positionIndex of the missed N-back target)
  disabled, // boolean
}) => {
  const [localFeedback, setLocalFeedback] = useState(null);
  const [localMissedFeedback, setLocalMissedFeedback] = useState(null);

  useEffect(() => {
    if (feedback) {
      setLocalFeedback(feedback);
      const timer = setTimeout(() => setLocalFeedback(null), 300); // Feedback display duration
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  useEffect(() => {
    // Only set localMissedFeedback if it's a new miss (not null)
    if (missedTargetFeedback !== null) {
      setLocalMissedFeedback(missedTargetFeedback);
      const timer = setTimeout(() => setLocalMissedFeedback(null), 400); // Missed feedback display duration
      return () => clearTimeout(timer);
    } else {
      // If missedTargetFeedback becomes null (e.g. cleared by logic), ensure local is also cleared
      setLocalMissedFeedback(null);
    }
  }, [missedTargetFeedback]);

  return (
    <div className="grid grid-cols-3 gap-2 w-60 h-60 sm:w-64 sm:h-64 mx-auto select-none">
      {Array.from({ length: 9 }).map((_, index) => {
        const isCurrentStimulus = index === currentStimulusPosition;
        let cellClasses = "flex items-center justify-center border rounded-md aspect-square transition-colors duration-150 ";
        let stimulusDotClasses = "w-3/5 h-3/5 bg-blue-500 rounded-md";

        if (disabled) {
          cellClasses += "bg-gray-200 cursor-not-allowed ";
        } else {
          cellClasses += "bg-white hover:bg-gray-100 cursor-pointer ";
        }

        if (localFeedback && localFeedback.position === index) {
          cellClasses += localFeedback.type === 'correct' ? 'bg-green-200 border-green-400 ' : 'bg-red-200 border-red-400 ';
          if (localFeedback.type === 'correct') stimulusDotClasses = "w-3/5 h-3/5 bg-green-500 rounded-md";
          if (localFeedback.type === 'incorrect') stimulusDotClasses = "w-3/5 h-3/5 bg-red-500 rounded-md";
        } else if (localMissedFeedback === index) {
          cellClasses += 'bg-red-200 border-red-400 animate-pulse '; // Simple pulse for miss
          stimulusDotClasses = "w-3/5 h-3/5 bg-red-500 rounded-md";
        } else {
          cellClasses += "border-gray-300 ";
        }

        return (
          <button
            key={index}
            className={cellClasses}
            onClick={() => !disabled && onCellClick(index)}
            disabled={disabled}
            aria-label={`Grid cell ${index + 1}`}
          >
            {(isCurrentStimulus || (localFeedback && localFeedback.position === index) || localMissedFeedback === index) && (
              <div className={stimulusDotClasses}></div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PositionNBackExactGrid;