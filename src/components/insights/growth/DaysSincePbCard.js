/* src/components/insights/growth/DaysSincePbCard.js */
/* Motivational banner: the minimum "days since last PB" across selected modes.
 * Low numbers celebrate momentum; higher numbers gently nudge the user.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFire, faBolt, faMountainSun } from '@fortawesome/free-solid-svg-icons';
import { MODE_LABELS } from '../../../constants/modeStyles';

const pickMessage = (days) => {
    if (days === null || days === undefined) {
        return { icon: faMountainSun, title: 'Waiting on your first PB', body: 'Play a session in this period to see your personal best tracked here.' };
    }
    if (days === 0) {
        return { icon: faFire, title: 'New PB today', body: 'You set a personal best today. Keep the momentum going — your brain is ready for more.' };
    }
    if (days <= 3) {
        return { icon: faFire, title: `PB ${days} day${days === 1 ? '' : 's'} ago`, body: 'You\'re in a hot streak. Another session today is gravy.' };
    }
    if (days <= 14) {
        return { icon: faBolt, title: `${days} days since your last PB`, body: 'A good window to push for a new personal best — even a small jump counts.' };
    }
    return { icon: faMountainSun, title: `${days} days since your last PB`, body: 'Plateaus are normal. Try a short session today and see what clicks.' };
};

const DaysSincePbCard = ({ lastPbDaysByMode, selectedModes }) => {
    // Find the smallest day count (the most recent PB) across selected modes.
    let minDays = null;
    let minMode = null;
    for (const mode of selectedModes) {
        const d = lastPbDaysByMode[mode];
        if (d === null || d === undefined) continue;
        if (minDays === null || d < minDays) { minDays = d; minMode = mode; }
    }

    const msg = pickMessage(minDays);

    return (
        <div className="specimen-card p-4 border border-theme-line bg-theme-bg-elevated/30">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-theme-bg-elevated border border-theme-line flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={msg.icon} className="h-4 w-4 text-theme-accent" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                            {msg.title}
                        </h3>
                        {minMode && (
                            <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-[0.2em]">
                                · {MODE_LABELS[minMode]}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-theme-text-secondary mt-1 font-mono">
                        {msg.body}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DaysSincePbCard;
