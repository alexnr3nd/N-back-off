/* src/components/insights/strengths/responseTimeShared.js */
/* Shared constants and helpers used by both the overview and drilldown
 * Response Time charts. */

import { MODE_MODALITIES as SHARED_MODE_MODALITIES } from '../../../constants/modeStyles';

// Extend the shared mode→modalities map with the 'single' aggregate (all 4
// modalities) so the Strengths filter can show all modality pills when the
// Single parent is active.
export const MODE_MODALITIES = {
    ...SHARED_MODE_MODALITIES,
    single: ['visual', 'audio', 'color', 'shape'],
};

export const MODALITY_LABELS = { visual: 'Position', audio: 'Audio', color: 'Color', shape: 'Shape' };

export const MODALITY_COLORS = {
    visual: 'rgb(var(--color-accent))',
    audio: '#60a5fa',
    color: '#c084fc',
    shape: '#22d3ee',
};

export const dotRadius = (count) => {
    if (count >= 10) return 6;
    if (count >= 5) return 5;
    if (count >= 3) return 4;
    return 3;
};
