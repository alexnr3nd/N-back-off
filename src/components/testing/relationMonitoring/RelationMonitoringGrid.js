/* src/components/testing/relationMonitoring/RelationMonitoringGrid.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';
import { RELATION_MONITORING_PHASES } from '../../../constants/relationMonitoringConstants';

const P = RELATION_MONITORING_PHASES;

/**
 * The 3x3 stimulus grid of three-digit strings. All nine cells stay mounted
 * across every phase; the 100ms blink and the practice feedback interval
 * only flip the digits' opacity (no DOM mounting at array onset — the same
 * timing contract as the Visual Arrays field). Digits are tabular-figure
 * monospace so string widths are identical and the ending digit always sits
 * in the same column position.
 */
const RelationMonitoringGrid = ({ phase, trialSpec, feedbackCorrect, containerSize }) => {
    const cells = trialSpec?.grid || Array(9).fill('');
    const digitsVisible = phase === P.ARRAY && !!trialSpec;
    const showFeedback = phase === P.TRIAL_FEEDBACK && feedbackCorrect !== null;
    const fontSize = Math.round(containerSize * 0.082);

    return (
        <div
            data-testid="relation-monitoring-grid"
            className="relative bg-theme-bg-elevated border border-theme-line select-none"
            style={{ width: containerSize, height: containerSize }}
            aria-hidden={!digitsVisible}
        >
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-[3%] p-[5%]">
                {cells.map((value, i) => (
                    <div
                        key={i}
                        data-testid={`rm-cell-${i}`}
                        className="flex items-center justify-center border border-theme-line/60 bg-theme-bg-secondary"
                    >
                        <span
                            className="font-mono tabular-nums text-theme-text leading-none transition-none"
                            style={{ fontSize, opacity: digitsVisible ? 1 : 0 }}
                        >
                            {value}
                        </span>
                    </div>
                ))}
            </div>

            {/* Practice feedback overlay (practice gap only — scored blocks get
                a plain 100ms blink with no feedback, per protocol) */}
            {showFeedback && (
                <div data-testid="rm-feedback" className="absolute inset-0 flex flex-col items-center justify-center bg-theme-bg-elevated/90">
                    <div className={`h-14 w-14 border flex items-center justify-center mb-3 ${feedbackCorrect
                        ? 'bg-status-success/20 border-status-success text-status-success'
                        : 'bg-status-error/20 border-status-error text-status-error'}`}
                    >
                        <FontAwesomeIcon icon={feedbackCorrect ? faCheck : faTimes} className="h-6 w-6" />
                    </div>
                    <p className={`text-sm font-mono uppercase tracking-wider ${feedbackCorrect ? 'text-status-success' : 'text-status-error'}`}>
                        {feedbackCorrect ? 'Correct' : 'Incorrect'}
                    </p>
                </div>
            )}
        </div>
    );
};

RelationMonitoringGrid.propTypes = {
    phase: PropTypes.string.isRequired,
    trialSpec: PropTypes.shape({
        grid: PropTypes.arrayOf(PropTypes.string),
        isMatch: PropTypes.bool,
    }),
    feedbackCorrect: PropTypes.bool,
    containerSize: PropTypes.number.isRequired,
};

export default RelationMonitoringGrid;
