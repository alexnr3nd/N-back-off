/* src/components/insights/strengths/LureFalseAlarmPanel.js */
/* False alarm rate restricted to lure trials (stimuli that match n-1 or n+1,
 * but not n). Users toggle between the two lure types; the underlying chart
 * is the shared MetricPanel (byNBack / drilldown / overTime). */

import React from 'react';
import MetricPanel from './metric/MetricPanel';

const DESCRIPTIONS = {
    byNBack: 'False alarms on lure trials per modality. Lures match n−1 or n+1 but not n-back — the most confusable non-targets. Lower is better.',
    drilled: (n) => `Within N=${n}. Each point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`,
    overTime: 'Lure false alarm rate per modality over time. Right axis = avg level (N.DD).',
    overTimeFiltered: (n) => `Filtered to N=${n}. Right axis = avg level (N.DD).`,
};

const LureTypeToggle = ({ value, onChange }) => (
    <div className="flex shrink-0" role="group" aria-label="Lure type">
        {[
            { key: 'n-1', label: 'n−1' },
            { key: 'n+1', label: 'n+1' },
        ].map((opt, i) => (
            <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.key)}
                aria-pressed={value === opt.key}
                className={`px-2.5 py-1 text-[0.625rem] font-mono uppercase tracking-wider border transition-colors ${i === 0 ? '' : 'border-l-0'} ${
                    value === opt.key
                        ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/50'
                        : 'border-theme-line text-theme-text-muted hover:text-theme-text hover:border-theme-accent/50'
                }`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

const LureFalseAlarmPanel = ({ filters, setFilter, data, modalities }) => {
    const isN1 = filters.lureType === 'n-1';
    return (
        <MetricPanel
            title={`Lure False Alarm Rate (${isN1 ? 'n−1' : 'n+1'})`}
            mode={filters.swGameMode}
            modalitiesOverride={modalities}
            trainingMode={filters.trainingMode}
            period={filters.period}
            view={filters.lureView}
            onViewChange={(v) => setFilter('lureView', v)}
            byNBackData={data.lureMetricsByNBack}
            drilldownData={data.lureDrilldown}
            overTimeData={data.lureOverTime}
            drillN={filters.lureDrillN}
            onDrillNChange={(n) => setFilter('lureDrillN', n)}
            overTimeN={filters.lureOverTimeNBack}
            onOverTimeNChange={(n) => setFilter('lureOverTimeNBack', n)}
            dataKeySuffix={isN1 ? 'N1Lure' : 'Np1Lure'}
            yDomain={[0, 'auto']}
            yTickFormat={(v) => `${Math.round(v)}%`}
            valueFormat={(v) => `${v.toFixed(1)}%`}
            yWidth={42}
            descriptions={DESCRIPTIONS}
            emptyMessage="Not enough lure data yet."
            headerExtras={<LureTypeToggle value={filters.lureType} onChange={(v) => setFilter('lureType', v)} />}
        />
    );
};

export default LureFalseAlarmPanel;
