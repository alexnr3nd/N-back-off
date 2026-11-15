/* src/components/game/ContinuousModeStartModal.js */
/* Pre-start configuration modal for Continuous Mode.
   Asks the user how many sessions to chain together; the chain auto-ends when
   that count is reached. Trials per session use the formula default (same as
   a normal session) — not user-configurable. */

import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink } from '@fortawesome/free-solid-svg-icons';
import ConfirmationModal from '../ui/ConfirmationModal';
import { DAILY_ADAPTIVE_CAP } from '../../constants/gameConstants';

const SESSION_PRESETS = [5, 10, 15, 20];
const DEFAULT_SESSIONS = 5;
const LAST_SESSION_COUNT_KEY = 'continuousModeLastSessionCount';

// Approximate seconds per trial × approximate trials per session at the most
// common starting case (N=2, D=0.50, formula default ≈ 22 trials). Used only
// to give the user a rough sense of total time — actual duration scales with
// their current N.DD.
const APPROX_SECONDS_PER_TRIAL = 3.5;
const APPROX_TRIALS_PER_SESSION = 22;

const formatDurationHint = (sessions) => {
    const totalSeconds = sessions * APPROX_TRIALS_PER_SESSION * APPROX_SECONDS_PER_TRIAL;
    const totalMin = totalSeconds / 60;
    if (totalMin < 1) return `${sessions} sessions · ~${Math.round(totalSeconds)}s`;
    if (totalMin < 10) return `${sessions} sessions · ~${totalMin.toFixed(1)} min`;
    return `${sessions} sessions · ~${Math.round(totalMin)} min`;
};

// Resolve the initial target, in priority order:
//   1) explicit defaultSessionCount prop (e.g. "Start Another Session" passes prev chain count)
//   2) localStorage last-used value (persists across visits)
//   3) DEFAULT_SESSIONS (5)
// Each candidate must be one of SESSION_PRESETS to be honored.
const resolveInitialTarget = (defaultSessionCount) => {
    if (SESSION_PRESETS.includes(defaultSessionCount)) return defaultSessionCount;
    try {
        const stored = parseInt(window.localStorage.getItem(LAST_SESSION_COUNT_KEY), 10);
        if (SESSION_PRESETS.includes(stored)) return stored;
    } catch (_) { /* localStorage unavailable (privacy mode, SSR) — fall through */ }
    return DEFAULT_SESSIONS;
};

const SUB_MODE_LABELS = { dual: 'Dual N-Back', triple: 'Triple N-Back', quad: 'Quad N-Back' };

const ContinuousModeStartModal = ({ isOpen, mode, onClose, onConfirm, defaultSessionCount, overrideLevelLabel, dynamicSubMode, capRemaining }) => {
    const [targetBlocks, setTargetBlocks] = useState(() => resolveInitialTarget(defaultSessionCount));

    // Re-resolve every time the modal opens so a fresh visit picks up the latest
    // localStorage value (and "Start Another Session" pre-selects the prior chain count).
    useEffect(() => {
        if (isOpen) {
            setTargetBlocks(resolveInitialTarget(defaultSessionCount));
        }
    }, [isOpen, defaultSessionCount]);

    const handleConfirm = useCallback(() => {
        try { window.localStorage.setItem(LAST_SESSION_COUNT_KEY, String(targetBlocks)); } catch (_) { /* ignore */ }
        onConfirm({ targetBlocks });
    }, [targetBlocks, onConfirm]);

    const modeLabel = mode === 'classic' ? 'Classic' : 'Adaptive';
    // Capped cohorts only (passed as null for Pro/grandfathered): each chain block
    // spends one Adaptive credit, so a chain can end early at the daily cap.
    const showCapHint = typeof capRemaining === 'number' && Number.isFinite(capRemaining);
    // Dynamic meta-mode: show which sub-mode the whole chain will play (resolved at chain start).
    const subModeLabel = dynamicSubMode ? SUB_MODE_LABELS[dynamicSubMode] : null;

    return (
        <ConfirmationModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            title="Start Chain"
            confirmText="Start Chain"
            cancelText="Cancel"
            showEnterHint={true}
        >
            {/* Mode label */}
            <div className="flex items-center gap-2 mb-2">
                <FontAwesomeIcon icon={faLink} className="h-3 w-3 text-theme-accent" />
                <p className="text-[0.6875rem] font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                    Continuous Mode · {modeLabel}{subModeLabel ? ` · ${subModeLabel}` : ''}
                </p>
            </div>

            {/* Override level confirmation (Continue / Retry / Go-up / Manual N±1) */}
            {overrideLevelLabel && (
                <p className="text-[0.6875rem] font-mono text-theme-accent mb-2">
                    Starting at {overrideLevelLabel}
                </p>
            )}

            {/* Description */}
            <p className="text-xs text-theme-text-secondary mb-4 leading-relaxed">
                Train through several sessions back-to-back, with no breaks between them.
                The chain ends automatically when you reach your target.
            </p>

            {/* Sessions section */}
            <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                    How many sessions?
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    {SESSION_PRESETS.map(n => {
                        const selected = targetBlocks === n;
                        return (
                            <button
                                key={n}
                                type="button"
                                onClick={() => setTargetBlocks(n)}
                                className={`px-4 py-2 text-sm font-mono uppercase tracking-wider border transition-all duration-150 ${
                                    selected
                                        ? 'bg-theme-accent text-theme-bg border-theme-accent'
                                        : 'bg-theme-bg-elevated text-theme-text-secondary border-theme-line hover:border-theme-accent/50 hover:text-theme-text'
                                }`}
                            >
                                {n}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Duration hint */}
            <div className="mt-4 bg-theme-bg-elevated border border-theme-line/60 px-3 py-2 rounded-sm">
                <p className="text-xs font-mono text-theme-text-secondary">
                    <span className="text-theme-text-muted">Estimated:</span> {formatDurationHint(targetBlocks)}
                </p>
                <p className="text-[0.625rem] font-mono text-theme-text-muted mt-0.5">
                    Each session uses your current difficulty's trial count.
                </p>
                {showCapHint && (
                    <p className="text-[0.625rem] font-mono text-theme-text-muted mt-0.5">
                        {capRemaining} of {DAILY_ADAPTIVE_CAP} Adaptive sessions left today. Your chain ends early if you reach the cap.
                    </p>
                )}
            </div>
        </ConfirmationModal>
    );
};

ContinuousModeStartModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    mode: PropTypes.oneOf(['adaptive', 'classic', null]),
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    defaultSessionCount: PropTypes.number,
    overrideLevelLabel: PropTypes.string,
    dynamicSubMode: PropTypes.oneOf(['dual', 'triple', 'quad']),
    // Adaptive sessions the user has left today. Null/undefined for uncapped
    // cohorts (Pro, active-grandfathered) and Classic chains — hides the hint.
    capRemaining: PropTypes.number,
};

export default ContinuousModeStartModal;
