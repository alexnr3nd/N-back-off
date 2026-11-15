import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useDailyCapStatus } from '../../hooks/useDailyCapStatus';

// Permanent session counter + upsell for capped free cohorts.
// Lives on the dashboard's Start Session card. Counter chip is informative (a span,
// not interactive); the CTA link is the only clickable element — separating the two
// avoids the coercive "whole-chip-is-button" pattern called out in NN/g deceptive-
// patterns research.
function DailyCapCounterChip({ isClassicSelected = false }) {
    const {
        isVisible,
        isWarning,
        counterCopy,
        ctaCopy,
        resetTooltip,
        openUpgradeModal,
    } = useDailyCapStatus();

    if (!isVisible || isClassicSelected) return null;

    const borderClass = isWarning
        ? 'border-theme-accent/50'
        : 'border-theme-line';

    return (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span
                className={`inline-block px-2 py-1 text-xs font-mono uppercase tracking-wider border self-start text-theme-text-muted ${borderClass}`}
                title={resetTooltip}
            >
                {counterCopy}
            </span>
            <button
                type="button"
                onClick={() => openUpgradeModal('start_card_counter')}
                className="group text-xs font-mono uppercase tracking-wider text-theme-accent hover:text-theme-accent-hover transition-colors inline-flex items-center gap-1.5"
            >
                {ctaCopy}
                <FontAwesomeIcon
                    icon={faArrowRight}
                    className="h-3 w-3 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
            </button>
        </div>
    );
}

DailyCapCounterChip.propTypes = {
    isClassicSelected: PropTypes.bool,
};

export default DailyCapCounterChip;
