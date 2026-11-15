/* src/components/game/LevelStepper.js */
/* Cognitive Lab theme — presentational -/+ stepper for a combined N.DD level.
 * Mirrors the visual language of StepperControl in
 * src/components/dashboard/TrainingIntensity.js. No state, no context. */
import React from 'react';

const LevelStepper = ({
    displayValue,
    valueClassName = '',
    onDecrement,
    onIncrement,
    canDecrement,
    canIncrement,
}) => {
    return (
        <div className="flex items-center justify-center gap-1.5">
            <button
                type="button"
                onClick={onDecrement}
                disabled={!canDecrement}
                aria-label="Decrease level"
                className="w-5 h-5 text-xs font-mono bg-theme-bg-secondary border border-theme-line
                    text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent/50
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary disabled:hover:border-theme-line
                    transition-colors flex items-center justify-center"
            >
                −
            </button>
            <span className={`${valueClassName} text-center leading-none`}>
                {displayValue}
            </span>
            <button
                type="button"
                onClick={onIncrement}
                disabled={!canIncrement}
                aria-label="Increase level"
                className="w-5 h-5 text-xs font-mono bg-theme-bg-secondary border border-theme-line
                    text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent/50
                    disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary disabled:hover:border-theme-line
                    transition-colors flex items-center justify-center"
            >
                +
            </button>
        </div>
    );
};

export default LevelStepper;
