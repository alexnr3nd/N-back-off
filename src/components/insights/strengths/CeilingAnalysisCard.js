/* src/components/insights/strengths/CeilingAnalysisCard.js */
/* Prose card identifying the user's single biggest per-modality regression:
 * the (N-back × modality) combo where hit rate dropped most or FAR climbed
 * most compared to one N-back level lower. Uses MIN_SESSIONS=3 per level,
 * enforced upstream in deriveModalityDiagnostic.
 */

import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMountainSun } from '@fortawesome/free-solid-svg-icons';
import { MODE_LABELS } from '../../../constants/modeStyles';

const MODALITY_LABELS = { visual: 'Position', audio: 'Audio', color: 'Color', shape: 'Shape' };

const ACTION_COPY = {
    hitDrop: (mod) => `Focus on catching more ${mod.toLowerCase()} matches at the higher level — that's where your sensitivity drops off.`,
    farClimb: (mod) => `Press less often on ${mod.toLowerCase()} when unsure — over-pressing at the higher level is costing d-prime.`,
};

const CeilingAnalysisCard = ({ diagnostic, mode }) => {
    const modeLabel = MODE_LABELS[mode] || mode;

    if (!diagnostic) {
        return (
            <div className="specimen-card p-4 border border-theme-line bg-theme-bg-elevated/30">
                <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon icon={faMountainSun} className="h-3.5 w-3.5 text-theme-accent" />
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                        Modality Diagnostic · {modeLabel}
                    </h3>
                </div>
                <p className="text-xs font-mono text-theme-text-muted">
                    Play at least 3 sessions at two consecutive N-back levels in {modeLabel} mode to unlock the modality diagnostic.
                </p>
            </div>
        );
    }

    const modLabel = MODALITY_LABELS[diagnostic.modality] || diagnostic.modality;
    const metricLabel = diagnostic.kind === 'hitDrop' ? 'hit rate' : 'false alarm rate';
    const currentPct = `${Math.round(diagnostic.value)}%`;
    const baselinePct = `${Math.round(diagnostic.baseline)}%`;
    const direction = diagnostic.kind === 'hitDrop' ? 'down from' : 'up from';
    const actionCopy = ACTION_COPY[diagnostic.kind](modLabel);

    return (
        <div className="specimen-card p-4 border border-theme-line bg-theme-bg-elevated/30">
            <div className="flex items-center gap-2 mb-3">
                <FontAwesomeIcon icon={faMountainSun} className="h-3.5 w-3.5 text-theme-accent" />
                <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                    Modality Diagnostic · {modeLabel}
                </h3>
            </div>

            <p className="text-sm text-theme-text-secondary font-mono mb-1">
                <span className="text-theme-accent">{modLabel} {metricLabel}</span>
                {' at '}N={diagnostic.nBack}{' is your biggest lever — '}
                <span className="text-theme-accent">{currentPct}</span>
                {', '}{direction} {baselinePct} at N={diagnostic.baselineNBack}.
            </p>
            <p className="text-xs text-theme-text-muted font-mono">
                {actionCopy}
            </p>
        </div>
    );
};

export default CeilingAnalysisCard;
