/* src/components/insights/strengths/StrengthsSection.js */
/* Strengths & Weaknesses section. Each chart is individually Pro-gated —
 * free users see each chart's title + per-chart "Unlock" CTA (titles
 * visible, chart bodies replaced).
 *
 * Panel order (top → bottom):
 *   1. Diagnostic (weakest link right now)
 *   2. Sensitivity (d')  — summary signal-detection metric
 *   3. Hit Rate           — component of d'
 *   4. False Alarm Rate   — component of d'
 *   5. Lure False Alarm   — lure-trial false alarms
 *   6. Response Time      — speed axis (RT + Lapses combined card)
 *
 * Metrics 2–5 share the MetricPanel primitive under ./metric/.
 */

import React from 'react';
import {
    faMountainSun, faBullseye, faCheckDouble,
    faTriangleExclamation, faMagnifyingGlass, faStopwatch,
} from '@fortawesome/free-solid-svg-icons';

import CeilingAnalysisCard from './CeilingAnalysisCard';
import SensitivityPanel from './SensitivityPanel';
import HitRatePanel from './HitRatePanel';
import AccuracyPanel from './AccuracyPanel';
import FalseAlarmRatePanel from './FalseAlarmRatePanel';
import LureFalseAlarmPanel from './LureFalseAlarmPanel';
import ResponseTimeStabilityChart from './ResponseTimeStabilityChart';
import ChartPaywallBlock from '../ChartPaywallBlock';
import SectionFilterBar from '../SectionFilterBar';
import { MODE_MODALITIES } from './responseTimeShared';

const StrengthsSection = ({ data, filters, setFilter, toggleModality, isFreeTier }) => {
    const validForMode = MODE_MODALITIES[filters.swGameMode] || MODE_MODALITIES.dual;
    const effectiveModalities = validForMode.filter(m => filters.swModalities.includes(m));

    return (
        <section aria-labelledby="strengths-heading" className="mb-10">
            <div className="mb-3">
                <h2 id="strengths-heading" className="text-xl font-serif text-theme-text">
                    Strengths &amp; Weaknesses
                </h2>
                <p className="text-xs font-mono text-theme-text-muted uppercase tracking-wider mt-1">
                    Modality diagnostic · per-level performance · over-time trends
                </p>
            </div>

            {!isFreeTier && (
                <SectionFilterBar
                    filters={filters}
                    setFilter={setFilter}
                    toggleModality={toggleModality}
                    modeMode="single"
                />
            )}

            <div className="mt-4 space-y-4">
                <ChartPaywallBlock
                    title="Modality Diagnostic"
                    icon={faMountainSun}
                    blurb="Your single biggest per-modality weakness right now — the N-back × modality combo where hit rate dropped most or false alarms climbed most."
                    isFreeTier={isFreeTier}
                >
                    <CeilingAnalysisCard
                        diagnostic={data.modalityDiagnostic}
                        mode={filters.swGameMode}
                    />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="Modality Sensitivity (d′)"
                    icon={faBullseye}
                    blurb="Signal detection per modality — how cleanly you separate matches from non-matches, by level and over time."
                    isFreeTier={isFreeTier}
                >
                    <SensitivityPanel filters={filters} setFilter={setFilter} data={data} modalities={effectiveModalities} />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="Hit Rate"
                    icon={faCheckDouble}
                    blurb="How often you correctly catch real matches, per modality and level."
                    isFreeTier={isFreeTier}
                >
                    <HitRatePanel filters={filters} setFilter={setFilter} data={data} modalities={effectiveModalities} />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="Accuracy"
                    icon={faCheckDouble}
                    blurb="Overall accuracy per modality — rewards catching matches AND avoiding false presses."
                    isFreeTier={isFreeTier}
                >
                    <AccuracyPanel filters={filters} setFilter={setFilter} data={data} modalities={effectiveModalities} />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="False Alarm Rate"
                    icon={faTriangleExclamation}
                    blurb="How often you press on non-matches — the mirror of hit rate and the other half of d′."
                    isFreeTier={isFreeTier}
                >
                    <FalseAlarmRatePanel filters={filters} setFilter={setFilter} data={data} modalities={effectiveModalities} />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="Lure False Alarm Rate"
                    icon={faMagnifyingGlass}
                    blurb="False alarms specifically on lure trials (n−1 or n+1 matches) — the most confusable non-targets."
                    isFreeTier={isFreeTier}
                >
                    <LureFalseAlarmPanel filters={filters} setFilter={setFilter} data={data} modalities={effectiveModalities} />
                </ChartPaywallBlock>

                <ChartPaywallBlock
                    title="Response Time Stability"
                    icon={faStopwatch}
                    blurb="Reaction time and lapse patterns per modality — speed axis to complement accuracy."
                    isFreeTier={isFreeTier}
                >
                    <ResponseTimeStabilityChart
                        data={data.rtStability}
                        mode={filters.swGameMode}
                        modalitiesOverride={effectiveModalities}
                        trainingMode={filters.trainingMode}
                        period={filters.period}
                        drilldownData={data.rtStabilityDrilldown}
                        rtDrillN={filters.rtDrillN}
                        onDrillIn={(n) => setFilter('rtDrillN', n)}
                        onDrillOut={() => setFilter('rtDrillN', null)}
                        lapsesDrilldownData={data.lapsesDrilldown}
                        lapseDrillN={filters.lapseDrillN}
                        onLapseDrillIn={(n) => setFilter('lapseDrillN', n)}
                        onLapseDrillOut={() => setFilter('lapseDrillN', null)}
                        rtView={filters.rtView}
                        lapsesView={filters.lapsesView}
                        onRtViewChange={(v) => setFilter('rtView', v)}
                        onLapsesViewChange={(v) => setFilter('lapsesView', v)}
                        rtOverTimeData={data.rtOverTime}
                        lapsesOverTimeData={data.lapsesOverTime}
                        rtOverTimeNBack={filters.rtOverTimeNBack}
                        lapsesOverTimeNBack={filters.lapsesOverTimeNBack}
                        onRtOverTimeNBackChange={(n) => setFilter('rtOverTimeNBack', n)}
                        onLapsesOverTimeNBackChange={(n) => setFilter('lapsesOverTimeNBack', n)}
                    />
                </ChartPaywallBlock>
            </div>
        </section>
    );
};

export default StrengthsSection;
