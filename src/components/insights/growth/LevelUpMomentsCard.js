/* src/components/insights/growth/LevelUpMomentsCard.js */
/* Chronological log of N-back progressions: when the user first surpassed
 * each N-back threshold in each mode, most recent first.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUpRightDots } from '@fortawesome/free-solid-svg-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { MODE_CARD_COLORS, MODE_LABELS, MODE_SHORT_LABELS } from '../../../constants/modeStyles';

// Build the style map from MODE_CARD_COLORS so every mode with an entry
// (dual/triple/quad, singleX × 4, 'single' aggregate) renders without
// per-component edits. Use short labels here — the log items are narrow.
const MODE_STYLES = Object.fromEntries(
    Object.keys(MODE_CARD_COLORS).map(k => [k, {
        color: MODE_CARD_COLORS[k].color,
        label: MODE_SHORT_LABELS[k] || MODE_LABELS[k] || k,
    }])
);

const LevelUpMomentsCard = ({ events }) => {
    const hasEvents = Array.isArray(events) && events.length > 0;

    return (
        <div className="specimen-card p-4 border border-theme-line bg-theme-bg-elevated/30">
            <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faArrowUpRightDots} className="h-3 w-3 text-theme-accent" />
                <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                    Recent Level-Ups
                </h3>
            </div>

            {!hasEvents ? (
                <p className="text-xs font-mono text-theme-text-muted">
                    No N-back advances in this period. Keep pushing — the next level will come.
                </p>
            ) : (
                <ul className="space-y-2">
                    {events.map((evt, i) => {
                        const style = MODE_STYLES[evt.mode] || MODE_STYLES.dual;
                        const dateStr = evt.ts ? format(new Date(evt.ts), 'MMM d, yyyy') : '';
                        const relative = evt.ts ? formatDistanceToNow(new Date(evt.ts), { addSuffix: true }) : '';
                        return (
                            <li key={`${evt.mode}-${evt.ts}-${i}`} className="flex items-baseline gap-3 text-xs font-mono">
                                <span className={`shrink-0 ${style.color} tracking-[0.15em] uppercase text-[0.625rem] w-10`}>
                                    {style.label}
                                </span>
                                <span className="text-theme-text tabular-nums">
                                    {evt.fromLevel}
                                    <span className="text-theme-text-muted mx-1">→</span>
                                    <span className={style.color}>{evt.toLevel}</span>
                                    <span className="text-theme-text-muted ml-1">-back</span>
                                </span>
                                <span className="ml-auto text-theme-text-muted text-[0.6875rem] text-right">
                                    <span className="block">{dateStr}</span>
                                    <span className="block text-theme-text-muted/70">{relative}</span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};

export default LevelUpMomentsCard;
