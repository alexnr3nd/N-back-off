/* src/components/testing/faceNameMemory/FaceNameMemoryResults.js */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationTriangle, faFlask, faClock } from '@fortawesome/free-solid-svg-icons';

const pct = (v) => (typeof v === 'number' ? `${v}%` : '—');
const signedPct = (v) => (typeof v === 'number' ? `${v >= 0 ? '+' : ''}${v}%` : '—');

/**
 * In-task results screen. Mirrors the Visual Arrays / Counting Span report
 * layout (icon plate → title → headline metric → stat grid). No population
 * percentile (design §8: raw score + personal trend only). The summary page
 * carries the trend chart + history.
 */
const FaceNameMemoryResults = ({ finalScores, isFamiliarization, notEligibleMessage, error, onDone }) => {
    const Frame = ({ icon, iconClass, plateClass, title, children, button = 'Back to Summary' }) => (
        <div className="text-center p-6 w-full max-w-md mx-auto">
            <div className="mb-6">
                <div className={`h-12 w-12 mx-auto mb-3 border flex items-center justify-center ${plateClass}`}>
                    <FontAwesomeIcon icon={icon} className={`h-5 w-5 ${iconClass}`} />
                </div>
                <p className="font-serif italic text-lg text-theme-text">{title}</p>
            </div>
            {children}
            <button onClick={onDone} className="btn-primary-lab w-full py-3 px-6 text-sm font-mono uppercase tracking-wider">
                {button}
            </button>
        </div>
    );

    if (notEligibleMessage) {
        return (
            <Frame icon={faClock} iconClass="text-theme-accent" plateClass="bg-theme-accent/20 border-theme-accent" title="Not Yet Available">
                <p className="text-sm text-theme-text-secondary mb-6">
                    Next assessment available on <span className="text-theme-text">{notEligibleMessage}</span>.
                </p>
            </Frame>
        );
    }

    if (error && !finalScores) {
        return (
            <Frame icon={faExclamationTriangle} iconClass="text-status-error" plateClass="bg-status-error/20 border-status-error" title="Assessment Error">
                <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
            </Frame>
        );
    }

    if (finalScores?.familiarizationComplete) {
        return (
            <Frame icon={faFlask} iconClass="text-theme-accent" plateClass="bg-theme-accent/20 border-theme-accent" title="Practice Complete" button="Continue">
                <p className="text-sm text-theme-text-secondary mb-6">The full assessment is ready whenever you are.</p>
            </Frame>
        );
    }

    const s = finalScores || {};
    return (
        <div className="text-center p-6 w-full max-w-md mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="h-12 w-12 mx-auto mb-3 border bg-status-success/20 border-status-success flex items-center justify-center">
                    <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5 text-status-success" />
                </div>
                <p className="font-serif italic text-lg text-theme-text">
                    {isFamiliarization ? 'Practice Complete' : 'Assessment Complete'}
                </p>
            </div>

            {/* Headline */}
            <div className="bg-theme-bg-elevated border border-theme-line p-5 mb-4">
                <p className="text-5xl font-mono text-theme-accent leading-none">{pct(s.delayedHitRate)}</p>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-3">Names recalled · after the delay</p>
            </div>

            {/* Secondary stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{pct(s.immediateHitRate)}</p>
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-1">Immediate</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">{signedPct(s.retention)}</p>
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-1">Retention</p>
                </div>
                <div className="bg-theme-bg-elevated border border-theme-line p-3">
                    <p className="text-xl font-mono text-theme-text">
                        {typeof s.distractorAccuracy === 'number' ? `${Math.round(s.distractorAccuracy)}%` : '—'}
                    </p>
                    <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mt-1">Math Break</p>
                </div>
            </div>

            {s.flaggedLowValidity && (
                <div className="bg-theme-bg-elevated border-l-2 border-theme-accent p-3 mb-4 text-left">
                    <p className="text-xs text-theme-text-secondary">
                        Immediate recall was near chance — this run may not reflect your real memory.
                        Skipping the study screens or guessing are the usual causes.
                    </p>
                </div>
            )}

            <p className="text-xs text-theme-text-muted mb-6">
                Scores track against your own baseline over time — there is no population percentile.
            </p>

            {error && <p className="text-xs text-status-warning mb-4">{error}</p>}

            <button onClick={onDone} className="btn-primary-lab w-full py-3 px-6 text-sm font-mono uppercase tracking-wider">
                Finish
            </button>
        </div>
    );
};

export default FaceNameMemoryResults;
