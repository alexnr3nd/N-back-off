/* src/components/insights/strengths/HitRatePanel.js */
/* Hit Rate per modality. Full-width, three-view panel (by N-back / adaptive
 * N.DD drilldown / over time) built on the shared MetricPanel primitive. */

import React from 'react';
import MetricPanel from './metric/MetricPanel';

const DESCRIPTIONS = {
    byNBack: 'Share of target trials correctly detected per modality. Higher is better.',
    drilled: (n) => `Within N=${n}. Each point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`,
    overTime: 'Hit rate per modality over time. Right axis = avg level (N.DD).',
    overTimeFiltered: (n) => `Filtered to N=${n}. Right axis = avg level (N.DD).`,
};

const HitRatePanel = ({ filters, setFilter, data, modalities }) => (
    <MetricPanel
        title="Hit Rate"
        mode={filters.swGameMode}
        modalitiesOverride={modalities}
        trainingMode={filters.trainingMode}
        period={filters.period}
        view={filters.hitView}
        onViewChange={(v) => setFilter('hitView', v)}
        byNBackData={data.modalityMetricsByNBack}
        drilldownData={data.hitDrilldown}
        overTimeData={data.hitOverTime}
        drillN={filters.hitDrillN}
        onDrillNChange={(n) => setFilter('hitDrillN', n)}
        overTimeN={filters.hitOverTimeNBack}
        onOverTimeNChange={(n) => setFilter('hitOverTimeNBack', n)}
        dataKeySuffix="Hit"
        yDomain={[0, 100]}
        yTickFormat={(v) => `${Math.round(v)}%`}
        valueFormat={(v) => `${v.toFixed(1)}%`}
        yWidth={42}
        descriptions={DESCRIPTIONS}
        emptyMessage="Not enough hit-rate data yet."
    />
);

export default HitRatePanel;
