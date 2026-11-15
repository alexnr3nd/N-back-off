/* src/components/insights/strengths/SensitivityPanel.js */
/* Modality sensitivity (d-prime) per modality. d' combines hit rate and
 * false alarm rate into a single signal-detection score — the summary
 * metric that Hit Rate and FAR are components of.
 *
 * Y axis auto-scales in both directions because d' range varies widely
 * across users (roughly -0.5 to 3.5). */

import React from 'react';
import MetricPanel from './metric/MetricPanel';

const DESCRIPTIONS = {
    byNBack: "Signal-detection score (d') per modality across N-back. Higher = cleaner signal.",
    drilled: (n) => `Within N=${n}. Each point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`,
    overTime: "Sensitivity (d') per modality over time. Right axis = avg level (N.DD).",
    overTimeFiltered: (n) => `Filtered to N=${n}. Right axis = avg level (N.DD).`,
};

const SensitivityPanel = ({ filters, setFilter, data, modalities }) => (
    <MetricPanel
        title="Modality Sensitivity (d')"
        mode={filters.swGameMode}
        modalitiesOverride={modalities}
        trainingMode={filters.trainingMode}
        period={filters.period}
        view={filters.senseView}
        onViewChange={(v) => setFilter('senseView', v)}
        byNBackData={data.modalityMetricsByNBack}
        drilldownData={data.senseDrilldown}
        overTimeData={data.senseOverTime}
        drillN={filters.senseDrillN}
        onDrillNChange={(n) => setFilter('senseDrillN', n)}
        overTimeN={filters.senseOverTimeNBack}
        onOverTimeNChange={(n) => setFilter('senseOverTimeNBack', n)}
        dataKeySuffix="Dprime"
        yDomain={['auto', 'auto']}
        yTickFormat={(v) => v.toFixed(1)}
        valueFormat={(v) => v.toFixed(2)}
        yWidth={38}
        descriptions={DESCRIPTIONS}
        emptyMessage="Not enough sensitivity data yet."
    />
);

export default SensitivityPanel;
