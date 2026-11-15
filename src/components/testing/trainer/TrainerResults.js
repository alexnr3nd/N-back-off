/* src/components/testing/trainer/TrainerResults.js */
/**
 * Generic session-complete screen for adaptive Trainers (shared chassis). Shows
 * accuracy, the level change (delta + new level + /max), the in-session best run,
 * and the all-time best. The level noun + ceiling are parameterized per task via
 * `levelLabel` / `maxLevel` (e.g. "Level"/22 for antisaccade, "Span"/9 for digit
 * span). Honest near-transfer framing — no cognitive/medical claims.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDumbbell, faArrowUp, faArrowDown, faMinus, faFire, faRedo, faArrowLeft } from '@fortawesome/free-solid-svg-icons';

const TrainerResults = ({ results, onPlayAgain, onDone, icon, levelLabel, maxLevel, showMaxBadge }) => {
    const { accuracy, prevLevel, newLevel, bestRun, bestLevel, error } = results || {};

    if (error) {
        return (
            <div className="text-center py-6">
                <p className="font-serif italic text-theme-text mb-2">Session Not Saved</p>
                <p className="text-sm text-theme-text-secondary mb-6 max-w-sm mx-auto">
                    This session could not be saved, so the level is unchanged. Check the connection and try again.
                </p>
                <div className="flex gap-3 justify-center">
                    <button onClick={onPlayAgain} className="btn-primary-lab px-6 py-2.5 text-sm font-mono uppercase tracking-wider">
                        <FontAwesomeIcon icon={faRedo} className="mr-2 h-3 w-3" />Try Again
                    </button>
                    <button onClick={onDone} className="px-6 py-2.5 bg-theme-bg-elevated border border-theme-line text-sm font-mono text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors uppercase tracking-wider">
                        Back
                    </button>
                </div>
            </div>
        );
    }

    const delta = (typeof newLevel === 'number' && typeof prevLevel === 'number') ? newLevel - prevLevel : 0;
    const deltaIcon = delta > 0 ? faArrowUp : (delta < 0 ? faArrowDown : faMinus);
    const deltaColor = delta > 0 ? 'text-status-success' : (delta < 0 ? 'text-status-warning' : 'text-theme-text-muted');
    const accPct = typeof accuracy === 'number' ? `${(accuracy * 100).toFixed(0)}%` : '—';

    return (
        <div className="text-center py-2 w-full max-w-md mx-auto">
            <div className="flex justify-center mb-4">
                <div className="h-14 w-14 bg-theme-bg-elevated border border-theme-accent flex items-center justify-center text-theme-accent">
                    <FontAwesomeIcon icon={icon} className="text-xl" />
                </div>
            </div>
            <p className="text-xs font-mono text-theme-text-muted uppercase tracking-[0.2em] mb-1">Session Complete</p>
            <div className="text-4xl font-mono text-theme-text mb-1">{accPct}</div>
            <p className="text-xs font-mono text-theme-text-muted mb-5">accuracy this session</p>

            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="border border-theme-line bg-theme-bg-elevated/50 p-3">
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mb-1">{levelLabel}</p>
                    <p className={`text-lg font-mono ${deltaColor} flex items-center justify-center gap-1`}>
                        <FontAwesomeIcon icon={deltaIcon} className="h-3 w-3" />{typeof newLevel === 'number' ? newLevel : '—'}
                        {typeof newLevel === 'number' && showMaxBadge && (newLevel >= maxLevel
                            ? <span className="text-[0.625rem] text-status-success">MAX</span>
                            : <span className="text-[0.625rem] text-theme-text-muted">/{maxLevel}</span>)}
                    </p>
                </div>
                <div className="border border-theme-line bg-theme-bg-elevated/50 p-3">
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mb-1">Best Run</p>
                    <p className="text-lg font-mono text-theme-accent flex items-center justify-center gap-1">
                        <FontAwesomeIcon icon={faFire} className="h-3 w-3" />{typeof bestRun === 'number' ? bestRun : '—'}
                    </p>
                </div>
                <div className="border border-theme-line bg-theme-bg-elevated/50 p-3">
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mb-1">Best</p>
                    <p className="text-lg font-mono text-theme-text">{typeof bestLevel === 'number' ? bestLevel : '—'}</p>
                </div>
            </div>

            <div className="flex gap-3 justify-center">
                <button onClick={onPlayAgain} className="btn-primary-lab px-6 py-2.5 text-sm font-mono uppercase tracking-wider flex items-center gap-2">
                    <FontAwesomeIcon icon={faRedo} className="h-3 w-3" />Play Again
                </button>
                <button onClick={onDone} className="px-6 py-2.5 bg-theme-bg-elevated border border-theme-line text-sm font-mono text-theme-text-secondary hover:text-theme-accent hover:border-theme-accent transition-colors uppercase tracking-wider flex items-center gap-2">
                    <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />Back
                </button>
            </div>
        </div>
    );
};

TrainerResults.propTypes = {
    results: PropTypes.object,
    onPlayAgain: PropTypes.func.isRequired,
    onDone: PropTypes.func.isRequired,
    icon: PropTypes.object,
    levelLabel: PropTypes.string,
    maxLevel: PropTypes.number,
    showMaxBadge: PropTypes.bool,
};
TrainerResults.defaultProps = {
    icon: faDumbbell,
    levelLabel: 'Level',
    maxLevel: 99,
    showMaxBadge: true,
};

export default TrainerResults;
