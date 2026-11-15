/* File: src/components/game/ChannelPerformanceCard.js */
// Reusable per-modality "Channel" card.
// Visual mirror of GameResults.js:1396-1530 inline cards. Used by ChainDetailedTab
// (chain-aggregate counts) and ChainSessionRow (per-session counts). Format:
// dot + "X Channel" header → Acc / Hits / False Alarms rows → d' Score (Adaptive only).

import React from 'react';

const MODALITY_META = {
    visual: { label: 'Position Channel', dotClass: 'bg-theme-neural-blue', dpClass: 'text-theme-neural-blue' },
    audio:  { label: 'Audio Channel',    dotClass: 'bg-theme-neural-green', dpClass: 'text-theme-neural-green' },
    color:  { label: 'Color Channel',    dotClass: 'bg-theme-accent',       dpClass: 'text-theme-accent' },
    shape:  { label: 'Shape Channel',    dotClass: 'bg-theme-neural-red',   dpClass: 'text-theme-neural-red' },
};

const formatNum = (n, d = 2) => (typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—');
const formatAcc = (n) => formatNum(n, 1);

const ChannelPerformanceCard = ({
    modality,
    accuracy,
    correct,
    targetCount,
    falseAlarms,
    dprime,
    medianRT = null,
    isClassicMode = false,
}) => {
    const meta = MODALITY_META[modality];
    if (!meta) return null;

    return (
        <div className="border border-theme-line bg-theme-bg-elevated p-4">
            <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 ${meta.dotClass}`} />
                <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                    {meta.label}
                </span>
            </div>
            <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between">
                    <span className="text-theme-text-muted">Acc</span>
                    <span className="text-theme-text">{formatAcc(accuracy)}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-theme-text-muted">Hits</span>
                    <span className="text-theme-text">{correct ?? '?'} / {targetCount ?? '?'}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-theme-text-muted">False Alarms</span>
                    <span className="text-theme-text">{falseAlarms ?? '?'}</span>
                </div>
                {!isClassicMode && medianRT != null && (
                    <div className="flex justify-between">
                        <span className="text-theme-text-muted">Median RT</span>
                        <span className="text-theme-text">{medianRT} ms</span>
                    </div>
                )}
                {!isClassicMode && (
                    <div className="pt-2 border-t border-theme-line mt-2">
                        <div className="flex justify-between items-center">
                            <span className="text-theme-text-muted">d′ Score</span>
                            <span className={`text-lg ${meta.dpClass} font-bold`}>{formatNum(dprime, 2)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChannelPerformanceCard;
