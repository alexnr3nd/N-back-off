/* src/components/dashboard/StartFailureNotice.js */
/* Dashboard notice for a session that could not be started (GameContext feedbackMessage) */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faXmark } from '@fortawesome/free-solid-svg-icons';

/**
 * Surfaces a failed start. A start that fails sends the user straight back to the
 * dashboard, so without this the only signal is the bounce itself.
 *
 * Purely presentational — the dashboard decides when to render it (idle only) and
 * owns the dismiss. Amber, not red: red is reserved for destructive actions.
 *
 * @param {string} message - text to show; nothing renders when empty
 * @param {Function} onDismiss - called when the dismiss control is activated
 */
const StartFailureNotice = ({ message, onDismiss }) => {
    if (!message) return null;

    return (
        <div
            role="status"
            data-testid="start-failure-notice"
            className="mb-4 rounded-lg border border-amber-700/40 bg-amber-900/20 px-4 py-3"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-amber-400">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="mt-0.5 shrink-0" />
                    <span>{message}</span>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss"
                    className="shrink-0 rounded px-2 py-1 text-amber-400/60 hover:text-amber-400 hover:bg-amber-800/20 transition-colors"
                >
                    <FontAwesomeIcon icon={faXmark} className="text-xs" />
                </button>
            </div>
        </div>
    );
};

export default StartFailureNotice;
