/* src/components/insights/growth/PersonalBestCard.js */
/* One card per selected game mode — shows PB level, date, and days since.
 * Empty state when the user has no sessions in the selected period for this mode.
 */

import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { MODE_CARD_COLORS, MODE_LABELS } from '../../../constants/modeStyles';

// Build the style map from MODE_CARD_COLORS / MODE_LABELS — any mode that
// has an entry in MODE_CARD_COLORS (dual/triple/quad, 'single' aggregate,
// singleX × 4) gets a card style without per-component edits.
const MODE_STYLES = Object.fromEntries(
    Object.keys(MODE_CARD_COLORS).map(k => [k, { ...MODE_CARD_COLORS[k], label: MODE_LABELS[k] || k }])
);

const PersonalBestCard = ({ mode, pb, daysSince }) => {
    const style = MODE_STYLES[mode] || MODE_STYLES.dual;

    if (!pb || pb.level == null) {
        return (
            <div className={`specimen-card p-4 border ${style.border} bg-theme-bg-elevated/40`}>
                <div className="flex items-center justify-between mb-2">
                    <span className={`text-[0.625rem] font-mono uppercase tracking-[0.2em] ${style.color}`}>
                        {style.label}
                    </span>
                    <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">
                        PB
                    </span>
                </div>
                <p className="text-sm font-mono text-theme-text-muted">
                    No sessions yet in this period.
                </p>
            </div>
        );
    }

    const dateStr = pb.ts ? format(new Date(pb.ts), 'MMM d, yyyy') : '';
    const relative = pb.ts ? formatDistanceToNow(new Date(pb.ts), { addSuffix: true }) : '';

    return (
        <div className={`specimen-card p-4 border ${style.border} bg-theme-bg-elevated/40`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`text-[0.625rem] font-mono uppercase tracking-[0.2em] ${style.color}`}>
                    {style.label}
                </span>
                <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">
                    Personal best
                </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
                <span className={`text-3xl font-serif ${style.color}`}>
                    {pb.level.toFixed(2)}
                </span>
                <span className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-wider">
                    N.DD
                </span>
            </div>
            <p className="text-xs font-mono text-theme-text-secondary">
                {dateStr}
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-muted mt-0.5">
                {daysSince === 0 ? 'Today' : relative}
            </p>
        </div>
    );
};

export default PersonalBestCard;
