/* src/components/insights/ChartPaywallBlock.js
 *
 * Per-chart paywall. Each chart gets a full-width card with:
 *   · Sharp header (icon + title + PRO badge)
 *   · A preview region that blurs the real chart as a faint silhouette
 *     (dimmed + scaled, pointer-events off), overlaid with a fade
 *     gradient toward the CTA
 *   · A centered sharp CTA with the chart's blurb + Unlock button
 *
 * Kept to a consistent min-height so short empty-state charts don't
 * render a tiny awkward card next to tall ones.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock } from '@fortawesome/free-solid-svg-icons';
import ProTrialUpgradeModal from '../ui/ProTrialUpgradeModal';
import { useUpgradeModalRollout } from '../../hooks/useUpgradeModalRollout';
import { useUpgradeModal } from '../../hooks/useUpgradeModal';
import { trackEvent } from '../../utils/analyticsTracker';

const ChartPaywallBlock = ({
    title,
    icon,
    blurb,
    isFreeTier,
    children,
}) => {
    const navigate = useNavigate();
    const { isUserAllowed: upgradeRolloutAllowed } = useUpgradeModalRollout();
    const { recordImpressionOnly } = useUpgradeModal();
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    if (!isFreeTier) return children;

    const handleUnlock = () => {
        // Beta cohort: open the new direct-to-checkout modal in-place.
        // Non-beta: keep existing /subscribe navigation (no behavior change for installed Android).
        if (upgradeRolloutAllowed) {
            setShowUpgradeModal(true);
            // The local modal mount doesn't record its own impression.
            recordImpressionOnly('chart_paywall', title);
        } else {
            trackEvent('chart_paywall_subscribe_redirect', { chart: title });
            navigate('/subscribe');
        }
    };

    return (
        <div className="specimen-card p-5 border border-theme-accent/30 bg-theme-bg-elevated/30 min-h-[260px] flex flex-col">
            {/* Sharp header */}
            <div className="flex items-center gap-2 mb-4">
                {icon && <FontAwesomeIcon icon={icon} className="h-3.5 w-3.5 text-theme-accent" />}
                <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                    {title}
                </h3>
                <span className="ml-auto text-[0.625rem] font-mono uppercase tracking-wider text-theme-accent border border-theme-accent/40 px-1.5 py-0.5">
                    Pro
                </span>
            </div>

            {/* Preview + CTA region */}
            <div className="flex-1 relative overflow-hidden rounded-sm">
                {/* Blurred silhouette of the real chart */}
                <div
                    className="absolute inset-0 pointer-events-none select-none opacity-30"
                    style={{
                        filter: 'blur(6px) saturate(0.7)',
                        transform: 'scale(0.95)',
                    }}
                    aria-hidden="true"
                >
                    {children}
                </div>

                {/* Soft darken to push focus onto the CTA */}
                <div className="absolute inset-0 bg-gradient-to-b from-theme-bg/40 via-theme-bg/60 to-theme-bg/80" />

                {/* Sharp CTA overlay */}
                <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="max-w-sm text-center">
                        {blurb && (
                            <p className="text-xs sm:text-sm font-mono text-theme-text-secondary mb-4 leading-relaxed">
                                {blurb}
                            </p>
                        )}
                        <button
                            onClick={handleUnlock}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-wider
                                       text-theme-bg bg-theme-accent hover:bg-theme-accent-hover transition-colors"
                        >
                            <FontAwesomeIcon icon={faLock} className="h-3 w-3" />
                            Unlock with Pro
                        </button>
                        <div className="mt-2 text-[0.625rem] font-mono text-theme-text-muted">
                            14-day free trial · cancel anytime
                        </div>
                    </div>
                </div>
            </div>

            {/* Direct-to-checkout modal (beta cohort only — see handleUnlock) */}
            <ProTrialUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                trigger="chart_paywall"
            />
        </div>
    );
};

export default ChartPaywallBlock;
