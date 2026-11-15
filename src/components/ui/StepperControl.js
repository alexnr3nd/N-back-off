/* src/components/ui/StepperControl.js */
/* Cognitive Lab Aesthetic - Scientific Instrument Panel */

import React from 'react';

/**
 * StepperControl - Compact +/- control for adjusting values
 *
 * Extracted verbatim from src/components/dashboard/TrainingIntensity.js so the
 * Manual session parameters modal can reuse it. Markup, classes and behavior
 * are unchanged from the dashboard original.
 *
 * @param {string|number} value       - Rendered value between the two buttons.
 * @param {function} onDecrement      - Click handler for the "−" button.
 * @param {function} onIncrement      - Click handler for the "+" button.
 * @param {boolean} canDecrement      - When false the "−" button is disabled.
 * @param {boolean} canIncrement      - When false the "+" button is disabled.
 * @param {'large'|'small'} size      - Button/value scale. Defaults to 'large'.
 */
const StepperControl = ({ value, onDecrement, onIncrement, canDecrement, canIncrement, size = 'large' }) => {
  const buttonClass = size === 'large'
    ? 'w-8 h-8 sm:w-10 sm:h-10 text-lg'
    : 'w-6 h-6 sm:w-7 sm:h-7 text-sm';

  const valueClass = size === 'large'
    ? 'text-4xl sm:text-5xl min-w-[2.5rem] sm:min-w-[3rem]'
    : 'text-2xl sm:text-3xl min-w-[3rem] sm:min-w-[3.5rem]';

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={onDecrement}
        disabled={!canDecrement}
        className={`${buttonClass} font-mono bg-theme-bg-secondary border border-theme-line
          text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent/50
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary disabled:hover:border-theme-line
          transition-colors flex items-center justify-center`}
      >
        −
      </button>
      <span className={`${valueClass} font-mono text-theme-accent text-center leading-none`}>
        {value}
      </span>
      <button
        onClick={onIncrement}
        disabled={!canIncrement}
        className={`${buttonClass} font-mono bg-theme-bg-secondary border border-theme-line
          text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent/50
          disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary disabled:hover:border-theme-line
          transition-colors flex items-center justify-center`}
      >
        +
      </button>
    </div>
  );
};

export default StepperControl;
