import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { useDailyCapStatus } from '../../hooks/useDailyCapStatus';

// Ambient sidebar variant of the daily-cap counter. Visible on every layout-wrapped
// route once the user has played at least one session today. Never escalates color —
// the chip on the Start Session card handles the urgency; two loud counters at once
// read as nagging. Single-button surface (whole widget clickable) is acceptable here
// because the styling is quiet and matches the sidebar's existing nav-link pattern.
function DailyCapCounterSidebar({ collapsed = false }) {
    const {
        isVisible,
        used,
        total,
        counterCopy,
        ctaCopy,
        resetTooltip,
        openUpgradeModal,
    } = useDailyCapStatus();

    if (!isVisible) return null;

    if (collapsed) {
        return (
            <button
                type="button"
                onClick={() => openUpgradeModal('sidebar_counter')}
                title={`${counterCopy} — ${ctaCopy}`}
                className="mx-auto mb-2 px-2 py-1 text-xs font-mono text-theme-text-muted border border-theme-line hover:border-theme-accent hover:text-theme-accent transition-colors focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
            >
                {used}/{total}
            </button>
        );
    }

    return (
        <button
            type="button"
            onClick={() => openUpgradeModal('sidebar_counter')}
            title={resetTooltip}
            className="mx-2 mb-2 px-3 py-2 text-left border border-theme-line hover:border-theme-accent/60 group transition-colors block w-[calc(100%-1rem)] focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
        >
            <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted group-hover:text-theme-text-secondary transition-colors">
                {counterCopy}
            </p>
            <p className="text-xs font-mono uppercase tracking-wider text-theme-accent mt-1 inline-flex items-center gap-1.5">
                {ctaCopy}
                <FontAwesomeIcon
                    icon={faArrowRight}
                    className="h-3 w-3 transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                />
            </p>
        </button>
    );
}

DailyCapCounterSidebar.propTypes = {
    collapsed: PropTypes.bool,
};

export default DailyCapCounterSidebar;
