/* File: src/components/game/continuous/ChainRangePanel.js */
// Visual mirror of GameResults "Level Progression" panel styling — keep in sync
// (border border-theme-line bg-theme-bg-elevated p-4).

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowUp, faArrowDown, faMinus } from '@fortawesome/free-solid-svg-icons';
import { formatCombinedDifficulty } from '../../../contexts/gameHelpers';

const ChainRangePanel = ({
    isClassicMode,
    nDdRange,
    nDdAverage,
    newNBack,
    newDifficulty,
    originalNBack,
    chainTotalBlocks,
}) => {
    if (isClassicMode) {
        // Classic outcome card — mirrors GameResults's Classic level display style.
        const newN = newNBack ?? originalNBack;
        const startN = originalNBack ?? newNBack;
        const promoted = newN > startN;
        const demoted = newN < startN;
        const icon = promoted ? faArrowUp : demoted ? faArrowDown : faMinus;
        const colorClass = promoted ? 'text-theme-neural-green'
            : demoted ? 'text-theme-neural-red'
            : 'text-theme-text-muted';
        const subtitle = promoted ? `Promoted to N = ${newN} next chain`
            : demoted ? `3 strikes — demoted to N = ${newN} next chain`
            : `Maintaining at N = ${newN} next chain`;

        return (
            <div className="border border-theme-line bg-theme-bg-elevated p-4">
                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                    Chain Outcome
                </div>
                <div className="text-center py-2">
                    <div className={`text-3xl font-mono font-bold ${promoted ? 'text-theme-neural-green' : 'text-theme-text'}`}>
                        N = {newN}
                    </div>
                </div>
                <div className={`text-center text-xs font-mono ${colorClass} mt-1 flex items-center justify-center gap-2`}>
                    <FontAwesomeIcon icon={icon} className="h-3 w-3" />
                    <span>{subtitle}</span>
                </div>
                <div className="border-t border-theme-line pt-3 mt-3 text-center">
                    <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                        Whole chain evaluated as one Jaeggi session ({chainTotalBlocks} sessions pooled)
                    </span>
                </div>
            </div>
        );
    }

    // Adaptive: range / average / current (where the user lands next chain)
    const rangeLabel = (nDdRange?.min != null && nDdRange?.max != null)
        ? `${nDdRange.min.toFixed(2)} → ${nDdRange.max.toFixed(2)}`
        : '—';
    const avgLabel = nDdAverage != null ? nDdAverage.toFixed(2) : '—';
    const currentLabel = (typeof newNBack === 'number' && typeof newDifficulty === 'number')
        ? formatCombinedDifficulty(newNBack, newDifficulty)
        : '—';

    return (
        <div className="border border-theme-line bg-theme-bg-elevated p-4">
            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                Chain Range
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                    <div className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                        Range
                    </div>
                    <div className="text-base font-mono text-theme-text">
                        {rangeLabel}
                    </div>
                </div>
                <div>
                    <div className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                        Average
                    </div>
                    <div className="text-base font-mono text-theme-accent">
                        {avgLabel}
                    </div>
                </div>
                <div>
                    <div className="text-[0.6875rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                        Current
                    </div>
                    <div className="text-base font-mono text-theme-text">
                        {currentLabel}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChainRangePanel;
