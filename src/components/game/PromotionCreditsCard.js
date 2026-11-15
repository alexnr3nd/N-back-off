import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

/**
 * "Very good at Jaeggi speed: k of 3" progress card (Sept 2026 promotion credits).
 * Purely presentational; each results screen decides visibility.
 *
 * @param {number} credits - post-session credit count (> 0)
 * @param {number} required - credits needed (EARLY_PROMOTION_SESSIONS from the server)
 * @param {number} nBack - the N the credits belong to (floor label renders as `${nBack}.50`)
 * @param {'session'|'block'} unit - noun for the remaining count
 * @param {string} destinationLabel - what the promotion leads to, e.g. "4-back" or "Triple 3.00"
 */
export default function PromotionCreditsCard({ credits, required, nBack, unit = 'session', destinationLabel }) {
    const remaining = Math.max(0, required - credits);
    const noun = remaining === 1 ? unit : `${unit}s`;
    const resetSubject = unit === 'block' ? 'A block' : 'Dropping';
    return (
        <div
            data-testid="promotion-credits"
            className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5 text-xs font-mono text-theme-text-secondary"
        >
            <FontAwesomeIcon icon={faCheck} className="mr-2 text-theme-accent" />
            <span className="text-theme-text">Very good at Jaeggi speed: {credits} of {required}.</span>
            {' '}
            {remaining} more {noun} at {nBack}.50 or faster to advance to {destinationLabel}.
            {' '}
            {resetSubject} below {nBack}.50 resets the count.
        </div>
    );
}
