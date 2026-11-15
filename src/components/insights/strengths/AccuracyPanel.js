/* src/components/insights/strengths/AccuracyPanel.js */
/* Pooled Jaeggi accuracy per modality. Full-width, three-view panel (by
 * N-back / adaptive N.DD drilldown / over time) built on the shared
 * MetricPanel primitive. Replaces the old Hit Rate panel — accuracy is a
 * more complete measure of performance because it penalizes both misses and
 * false alarms. Hit rate (as a component of d-prime) is still available via
 * the Sensitivity and FAR panels alongside this one. */

import React from 'react';
import MetricPanel from './metric/MetricPanel';

const DESCRIPTIONS = {
    byNBack: 'Pooled Jaeggi accuracy per modality — (hits + correct rejections) / total. Higher is better.',
    drilled: (n) => `Within N=${n}. Each point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`,
    overTime: 'Accuracy per modality over time. Right axis = avg level (N.DD).',
    overTimeFiltered: (n) => `Filtered to N=${n}. Right axis = avg level (N.DD).`,
};

const AccuracyPanel = ({ filters, setFilter, data, modalities }) => (
    <MetricPanel
        title="Accuracy"
        mode={filters.swGameMode}
        modalitiesOverride={modalities}
        trainingMode={filters.trainingMode}
        period={filters.period}
        view={filters.accuracyView}
        onViewChange={(v) => setFilter('accuracyView', v)}
        byNBackData={data.modalityMetricsByNBack}
        drilldownData={data.accuracyDrilldown}
        overTimeData={data.accuracyOverTime}
        drillN={filters.accuracyDrillN}
        onDrillNChange={(n) => setFilter('accuracyDrillN', n)}
        overTimeN={filters.accuracyOverTimeNBack}
        onOverTimeNChange={(n) => setFilter('accuracyOverTimeNBack', n)}
        dataKeySuffix="Accuracy"
        yDomain={[0, 100]}
        yTickFormat={(v) => `${Math.round(v)}%`}
        valueFormat={(v) => `${v.toFixed(1)}%`}
        yWidth={42}
        descriptions={DESCRIPTIONS}
        emptyMessage="Not enough accuracy data yet."
    />
);

export default AccuracyPanel;
