/* src/components/game/RecallResultsCard.js */
/* Recall Mode results: exact/blank/wrong breakdown.
 * Rendered INSTEAD of the binary Color modality block for singleColorRecall.
 * The intrusion taxonomy (±1 swaps, current-color slips) is deliberately NOT
 * displayed — it read as noise on the card — but the scorer still classifies
 * every wrong pick and stores it on the session doc (recall.intrusions). */

import React from 'react';

const Stat = ({ label, value, tone = 'text-theme-text' }) => (
    <div className="text-center">
        <div className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">{label}</div>
        <div className={`text-xl font-mono font-bold ${tone}`}>{value}</div>
    </div>
);

const RecallResultsCard = ({ recall, colorDprime = null, isClassicMode = false }) => {
    if (!recall || typeof recall.scorable !== 'number') return null;
    const { scorable, exact, blanks, wrongPicks } = recall;
    const pct = scorable > 0 ? ((exact / scorable) * 100).toFixed(1) : '—';

    return (
        <div className="border border-theme-line bg-theme-bg-elevated p-4">
            <div className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                Color Recall
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Exact" value={`${exact}/${scorable}`} tone="text-theme-neural-green" />
                <Stat label="Accuracy" value={`${pct}%`} tone="text-theme-accent" />
                <Stat label="Wrong Color" value={wrongPicks} tone="text-theme-neural-red" />
                <Stat label="Blank" value={blanks} tone="text-theme-text-muted" />
            </div>
            {/* GameResults' formatNum is a local const inside that component (not exported), so the
                finiteness guard it applies is mirrored here — Number.isFinite also rejects NaN/±Infinity,
                which `typeof === 'number'` would let through into toFixed(). */}
            {!isClassicMode && Number.isFinite(colorDprime) && (
                <div className="text-sm font-mono text-theme-text-muted text-center mt-3">
                    d′ {colorDprime.toFixed(1)}
                </div>
            )}
        </div>
    );
};

export default RecallResultsCard;
