/* src/components/tutorial/tourSteps.js */
/* Protocol Guide - Dashboard Tour Step Definitions */

/**
 * Dashboard tour step structure:
 * - id: Unique identifier
 * - target: CSS selector for the element to highlight (data-tour attribute)
 * - title: Step header text
 * - content: Explanation text
 * - position: Where to place tooltip relative to target ('top' | 'bottom' | 'left' | 'right')
 *
 * Order follows top-to-bottom dashboard layout so scrolling feels natural:
 *   Mode Selector  →  Choose Your Protocol  →  Training Intensity
 */

export const getDashboardTourSteps = (isAdaptiveUser, hasClassicAccess = true) => [
  {
    id: 'mode-selector',
    target: '[data-tour="mode-selector"]',
    title: 'Pick What to Track',
    content: 'Dual tracks position + audio. Triple adds color. Quad adds a poker card. Most people start with Dual — add modalities as you get comfortable.',
    position: 'bottom',
  },
  {
    id: 'choose-protocol',
    target: '[data-tour="start-training"]',
    // Cohorts without Classic access have no protocol to choose — the card still
    // renders for them, so this is a content swap rather than a removed step.
    title: hasClassicAccess ? 'Choose Your Protocol' : 'Start Training',
    content: !hasClassicAccess
      ? 'Adaptive fine-tunes precision difficulty (N.DD) to your exact level every session. Tap Start Session when you\'re ready.'
      : isAdaptiveUser
        ? 'Classic runs at fixed N-back levels — steady challenge, 90%+ accuracy to advance. Adaptive fine-tunes precision difficulty (N.DD) to your exact level every session. Tap Start Session when you\'re ready.'
        : 'Classic runs at fixed N-back levels — steady challenge, 90%+ accuracy to advance. Adaptive fine-tunes precision difficulty (N.DD) to your exact level every session. Tap Start Session to begin.',
    position: 'bottom',
  },
  {
    id: 'training-intensity',
    target: '[data-tour="training-intensity"]',
    title: isAdaptiveUser ? 'Your Training Level (N.DD)' : 'Your N-Back Level',
    content: isAdaptiveUser
      ? 'Your current level — the first number is N-back (2-9), the second is difficulty (00-99). Adaptive training nudges this automatically after each session.'
      : 'Your current N-back level. In Classic, score 90%+ on both position and audio to advance to the next level.',
    position: 'top',
  },
];

// Total tour step count (same for both modes)
export const TOTAL_TOUR_STEPS = 3;
