/* src/components/insights/strengths/metric/MetricPanel.js */
/* Unified per-metric panel. Owns:
 *   • Card shell + header (title + description)
 *   • ViewToggle (By N-back | Over time)
 *   • N-back dropdown (drilldown in adaptive byNBack; filter in overTime for all protocols)
 *   • Empty-state rendering
 *   • Branch between the three chart variants
 *
 * Panel wrappers (HitRatePanel, AccuracyPanel, FalseAlarmRatePanel, SensitivityPanel)
 * are ~40-line files that just supply dataKeySuffix + axis config + data.
 */

import React from 'react';
import {
    MODE_MODALITIES, BUCKET_FOR_PERIOD,
    computeWeightedAverages, ChartAveragesRow,
} from './metricShared';
import MetricOverviewChart from './MetricOverviewChart';
import MetricDrillChart from './MetricDrillChart';
import MetricOverTimeChart from './MetricOverTimeChart';

const ViewToggle = ({ value, onChange }) => (
    <div className="flex shrink-0" role="group" aria-label="View mode">
        {[
            { key: 'overTime', label: 'Over time' },
            { key: 'byNBack', label: 'By N-back' },
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

// Two modes:
//   • drillMode=true  — value is null | 'all' | number. Dropdown leads with
//     an empty "—" option so the user is forced to pick between 'All' and a
//     specific level before seeing a chart. (Used in byNBack + adaptive.)
//   • drillMode=false — value is null | number. 'All' simply means null
//     (no filter). (Used in overTime for any protocol.)
const NBackDropdown = ({ value, onChange, options, drillMode = false }) => (
    <label className="flex items-center gap-2">
        <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">N-back:</span>
        <select
            value={value == null ? '' : String(value)}
            onChange={(e) => {
                const v = e.target.value;
                if (v === '') return onChange(null);
                if (v === 'all') return onChange('all');
                return onChange(parseInt(v, 10));
            }}
            className="bg-theme-bg-elevated border border-theme-line text-theme-text text-xs font-mono px-2 py-1 focus:outline-none focus:border-theme-accent"
        >
            {drillMode && <option value="">— select —</option>}
            <option value={drillMode ? 'all' : ''}>All</option>
            {options.map(n => (
                <option key={n} value={n}>N={n}</option>
            ))}
        </select>
    </label>
);

const MetricPanel = ({
    title,
    mode,
    modalitiesOverride,
    trainingMode,
    period,
    view,
    onViewChange,
    // Data for each view
    byNBackData,
    drilldownData,
    overTimeData,
    // Per-panel N-back state
    drillN,
    onDrillNChange,
    overTimeN,
    onOverTimeNChange,
    // Metric-specific config
    dataKeySuffix,
    yDomain,
    yTickFormat,
    valueFormat,
    yWidth,
    // Optional UI config
    descriptions = {},
    emptyMessage = 'Not enough data yet.',
    height = 'default',           // 'default' | 'compact'
    showAvgLevelOverlay = true,
    headerExtras = null,          // Optional node rendered at the start of the right-side controls row
}) => {
    const modalities = (modalitiesOverride && modalitiesOverride.length > 0)
        ? modalitiesOverride
        : (MODE_MODALITIES[mode] || MODE_MODALITIES.dual);
    const isOverTime = view === 'overTime';
    const isAdaptive = trainingMode === 'adaptive';
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';

    // byNBack semantics depend on protocol + drillN value:
    //   • adaptive: drillN ∈ { null (unset — prompt), 'all' (overview), number (drill) }
    //   • classic:  no drilldown available; always show overview regardless of drillN.
    const drillIsNumber = typeof drillN === 'number';
    const drillIsAll = drillN === 'all';
    const drillIsUnset = drillN == null;
    const showOverview = isOverTime
        ? false
        : (!isAdaptive || drillIsAll);         // classic always overview; adaptive only when explicitly "All"
    const showDrill = !isOverTime && isAdaptive && drillIsNumber;
    const showByNBackPrompt = !isOverTime && isAdaptive && drillIsUnset;

    const availableNBacks = Array.from(new Set((byNBackData || []).map(r => r.nBack))).sort((a, b) => a - b);

    // Dropdown visibility:
    //   • overTime: always show (filter by N-back works in any protocol)
    //   • byNBack + adaptive: always show (used to pick 'All' or a specific level)
    //   • byNBack + classic: hide (overview only, no drilldown)
    const dropdownVisible = isOverTime || isAdaptive;
    const dropdownValue = isOverTime ? overTimeN : drillN;
    const dropdownOnChange = isOverTime ? onOverTimeNChange : onDrillNChange;
    const dropdownDrillMode = !isOverTime && isAdaptive;  // three-state dropdown with "— select —" leading option

    const rows = isOverTime
        ? (overTimeData || [])
        : showDrill ? (drilldownData || []) : (byNBackData || []);

    const chartHasData = rows.some(r => modalities.some(mod => r[`${mod}${dataKeySuffix}`] != null));
    const averages = computeWeightedAverages(rows, modalities, dataKeySuffix);
    // In over-time view, compute a sessionCount-weighted avg of the bucket's
    // avgLevel so the summary row can include the "Avg level" stat that
    // replaces the former Recharts Legend entry for the dashed overlay.
    const avgLevelStat = (() => {
        if (!isOverTime) return null;
        let sum = 0, weight = 0;
        for (const r of rows) {
            if (r.avgLevel == null) continue;
            const w = r.sessionCount || 1;
            sum += r.avgLevel * w;
            weight += w;
        }
        return weight > 0 ? sum / weight : null;
    })();

    const nBackSuffix = isOverTime
        ? (overTimeN != null ? ` · N=${overTimeN}` : '')
        : (showDrill ? ` · N=${drillN}` : '');

    const description = (() => {
        if (isOverTime) {
            if (overTimeN != null && descriptions.overTimeFiltered) return descriptions.overTimeFiltered(overTimeN);
            if (descriptions.overTime) return descriptions.overTime;
        }
        if (showDrill && descriptions.drilled) return descriptions.drilled(drillN);
        return descriptions.byNBack || '';
    })();

    const emptyText = (() => {
        if (isOverTime && overTimeN != null) return `No sessions at N=${overTimeN} in this period.`;
        if (showDrill) return `No adaptive sessions at N=${drillN} in this period.`;
        return emptyMessage;
    })();

    const heightClass = height === 'compact' ? 'h-56 sm:h-64' : 'h-64 sm:h-72';

    return (
        <div className="specimen-card p-3 sm:p-4 border border-theme-line">
            <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                        {title}{nBackSuffix}
                    </h3>
                    {description && (
                        <p className="text-xs text-theme-text-muted mt-0.5">{description}</p>
                    )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {headerExtras}
                    <ViewToggle value={view} onChange={onViewChange} />
                    {dropdownVisible && (
                        <NBackDropdown
                            value={dropdownValue}
                            onChange={dropdownOnChange}
                            options={availableNBacks}
                            drillMode={dropdownDrillMode}
                        />
                    )}
                </div>
            </div>
            <div className={`${heightClass} w-full`}>
                {showByNBackPrompt ? (
                    <div className="h-full flex flex-col items-center justify-center gap-1 text-xs font-mono text-theme-text-muted text-center px-4">
                        <span className="text-theme-text">Pick a level to view this chart.</span>
                        <span>Choose <strong className="text-theme-text">All</strong> to see every N-back at once, or a specific N to zoom into its difficulty buckets.</span>
                    </div>
                ) : !chartHasData ? (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-theme-text-muted">
                        {emptyText}
                    </div>
                ) : isOverTime ? (
                    <MetricOverTimeChart
                        data={rows}
                        modalities={modalities}
                        dataKeySuffix={dataKeySuffix}
                        yDomain={yDomain}
                        yTickFormat={yTickFormat}
                        valueFormat={valueFormat}
                        bucketKind={bucketKind}
                        showAvgLevelOverlay={showAvgLevelOverlay}
                        yWidth={yWidth}
                    />
                ) : showDrill ? (
                    <MetricDrillChart
                        data={rows}
                        modalities={modalities}
                        dataKeySuffix={dataKeySuffix}
                        yDomain={yDomain}
                        yTickFormat={yTickFormat}
                        valueFormat={valueFormat}
                        drillN={drillN}
                        yWidth={yWidth}
                    />
                ) : (
                    <MetricOverviewChart
                        data={rows}
                        modalities={modalities}
                        dataKeySuffix={dataKeySuffix}
                        yDomain={yDomain}
                        yTickFormat={yTickFormat}
                        valueFormat={valueFormat}
                        yWidth={yWidth}
                    />
                )}
            </div>
            {!showByNBackPrompt && chartHasData && (
                <ChartAveragesRow
                    averages={averages}
                    modalities={modalities}
                    valueFormat={valueFormat}
                    avgLevel={avgLevelStat}
                />
            )}
        </div>
    );
};

export default MetricPanel;
