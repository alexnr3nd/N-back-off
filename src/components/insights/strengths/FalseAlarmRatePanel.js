/* src/components/insights/strengths/FalseAlarmRatePanel.js */
/* False Alarm Rate per modality. Y axis auto-scales from 0 so the typical
 * 5–25% range reads clearly rather than being squashed into the bottom
 * quarter of a fixed [0, 100] chart. */

import React from 'react';
import MetricPanel from './metric/MetricPanel';

const DESCRIPTIONS = {
    byNBack: 'Share of non-target trials incorrectly flagged per modality. Lower is better.',
    drilled: (n) => `Within N=${n}. Each point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`,
    overTime: 'False alarm rate per modality over time. Right axis = avg level (N.DD).',
    overTimeFiltered: (n) => `Filtered to N=${n}. Right axis = avg level (N.DD).`,
};

const FalseAlarmRatePanel = ({ filters, setFilter, data, modalities }) => (
    <MetricPanel
        title="False Alarm Rate"
        mode={filters.swGameMode}
        modalitiesOverride={modalities}
        trainingMode={filters.trainingMode}
        period={filters.period}
        view={filters.farView}
        onViewChange={(v) => setFilter('farView', v)}
        byNBackData={data.modalityMetricsByNBack}
        drilldownData={data.farDrilldown}
        overTimeData={data.farOverTime}
        drillN={filters.farDrillN}
        onDrillNChange={(n) => setFilter('farDrillN', n)}
        overTimeN={filters.farOverTimeNBack}
        onOverTimeNChange={(n) => setFilter('farOverTimeNBack', n)}
        dataKeySuffix="FAR"
        yDomain={[0, 'auto']}
        yTickFormat={(v) => `${Math.round(v)}%`}
        valueFormat={(v) => `${v.toFixed(1)}%`}
        yWidth={42}
        descriptions={DESCRIPTIONS}
        emptyMessage="Not enough false-alarm data yet."
    />
);

export default FalseAlarmRatePanel;
