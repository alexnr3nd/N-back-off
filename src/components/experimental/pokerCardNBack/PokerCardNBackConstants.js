// src/components/experimental/pokerCardNBack/PokerCardNBackConstants.js
export const SUITS = ['♥', '♦', '♣', '♠'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Options similar to AudioNBackGamePage, can be adjusted
export const N_BACK_OPTIONS = [1, 2, 3, 4, 5]; // Simplified for card game
export const DURATION_OPTIONS = [
    { value: 1, label: '1 Min' },
    { value: 2, label: '2 Min' },
    { value: 3, label: '3 Min' }, // Shorter typical duration
    { value: 5, label: '5 Min' },
];
export const ISI_OPTIONS = [ // Inter-Stimulus Interval
    { value: 3.5, label: '3.5s' },
    { value: 3.0, label: '3.0s' },
    { value: 2.5, label: '2.5s' },
    { value: 2.0, label: '2.0s' },
    { value: 1.5, label: '1.5s' },
];
export const MATCH_FREQUENCY_OPTIONS = [ // Target probability for a match (either suit or rank)
    { value: 0.15, label: 'Low' },      // Lower than audio due to two match types
    { value: 0.25, label: 'Medium' },
    { value: 0.35, label: 'High' },
];

export const FEEDBACK_DURATION_MS = 500; // How long feedback (correct/incorrect) is shown
export const STIMULUS_DURATION_MS = 1000; // How long the card is visible if ISI is longer

export const INITIAL_N_BACK = 2;
export const INITIAL_DURATION_MINUTES = DURATION_OPTIONS[1].value;
export const INITIAL_ISI_OPTION = ISI_OPTIONS[1];
export const INITIAL_MATCH_FREQUENCY_OPTION = MATCH_FREQUENCY_OPTIONS[1];