/* src/components/insights/strengths/ResponseTimeStabilityChart.js */
/* Per-modality response time + lapses across N-back levels.
 *
 * Two stacked panels, same visual grammar:
 *   • RT by N-back (ComposedChart) — one line per modality, ±1 SD shown as a
 *     shaded band at low alpha. Y axis in ms; lower is faster.
 *   • Lapses by N-back (LineChart) — one line per modality; Y axis = avg
 *     lapses (RT > 800 ms) per session.
 *
 * Each panel owns its own N-back dropdown and drill state. Selecting a value
 * in one panel's dropdown does not affect the other — users can keep the
 * overview of one while zooming into a specific N-back in the other.
 *
 * Visual grammar matches the modality metric panels (same palette, same X axis,
 * same dot-size-by-sessionCount). Low-n points (<5 sessions) render at
 * reduced opacity.
 */

import React, { useMemo } from 'react';
import {
    ComposedChart, LineChart, Line, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
    MODE_MODALITIES, MODALITY_LABELS, MODALITY_COLORS, dotRadius,
} from './responseTimeShared';
import { DrillRtChart, DrillLapseChart } from './ResponseTimeDrilldownView';
import { OverTimeRtChart, OverTimeLapseChart } from './ResponseTimeOverTimeChart';
import { computeWeightedAverages, ChartAveragesRow } from './metric/metricShared';

const LOW_N_THRESHOLD = 5;

const BUCKET_FOR_PERIOD = {
    '30d': 'day',
    '90d': 'week',
    '1y': 'week',
    'all': 'month',
};

// Pre-bake overview chart rows: each row gets {mod}MeanRT, {mod}UpperRT,
// {mod}LowerRT, {mod}Lapses, and {mod}CoV (tooltip-only). Inactive modalities
// emit null which Recharts skips with connectNulls={false}.
const buildOverviewRows = (data, modalities) => {
    return data.map(r => {
        const out = { nBack: r.nBack, sessionCount: r.sessionCount };
        for (const mod of modalities) {
            const mean = r[`${mod}MeanRT`];
            const sd = r[`${mod}SdRT`];
            const lapses = r[`${mod}Lapses`];
            out[`${mod}MeanRT`] = mean != null ? Math.round(mean) : null;
            out[`${mod}SdRT`] = sd != null ? Math.round(sd) : null;
            const upper = (mean != null && sd != null) ? Math.round(mean + sd) : null;
            const lower = (mean != null && sd != null) ? Math.max(0, Math.round(mean - sd)) : null;
            out[`${mod}UpperRT`] = upper;
            out[`${mod}LowerRT`] = lower;
            // Recharts range-area: dataKey yields a [low, high] tuple per point.
            out[`${mod}Range`] = (upper != null && lower != null) ? [lower, upper] : null;
            out[`${mod}Lapses`] = lapses != null ? Number(lapses.toFixed(2)) : null;
            out[`${mod}CoV`] = (mean != null && mean > 0 && sd != null) ? sd / mean : null;
        }
        return out;
    });
};

// Pre-bake drilldown rows keyed by `level` (float N.DD). Same shape otherwise.
const buildDrillRows = (data, modalities) => {
    return data.map(r => {
        const out = { level: r.level, sessionCount: r.sessionCount };
        for (const mod of modalities) {
            const mean = r[`${mod}MeanRT`];
            const sd = r[`${mod}SdRT`];
            const lapses = r[`${mod}Lapses`];
            out[`${mod}MeanRT`] = mean != null ? Math.round(mean) : null;
            out[`${mod}SdRT`] = sd != null ? Math.round(sd) : null;
            const upper = (mean != null && sd != null) ? Math.round(mean + sd) : null;
            const lower = (mean != null && sd != null) ? Math.max(0, Math.round(mean - sd)) : null;
            out[`${mod}UpperRT`] = upper;
            out[`${mod}LowerRT`] = lower;
            out[`${mod}Range`] = (upper != null && lower != null) ? [lower, upper] : null;
            out[`${mod}Lapses`] = lapses != null ? Number(lapses.toFixed(2)) : null;
            out[`${mod}CoV`] = (mean != null && mean > 0 && sd != null) ? sd / mean : null;
        }
        return out;
    });
};

const renderDot = (mod) => (props) => {
    const count = props.payload?.sessionCount ?? 0;
    const lowN = count > 0 && count < LOW_N_THRESHOLD;
    const visibleRadius = dotRadius(count);
    return (
        <circle
            key={props.key ?? `${mod}-${props.payload?.nBack}`}
            cx={props.cx}
            cy={props.cy}
            r={visibleRadius}
            fill={lowN ? 'none' : MODALITY_COLORS[mod]}
            fillOpacity={lowN ? 0 : 1}
            stroke={MODALITY_COLORS[mod]}
            strokeOpacity={lowN ? 0.55 : 1}
            strokeWidth={lowN ? 1.5 : 1}
        />
    );
};

const RtTooltip = ({ active, payload, label, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={label}
                {row.sessionCount != null ? ` · ${row.sessionCount} session${row.sessionCount !== 1 ? 's' : ''}` : ''}
            </p>
            {modalities.map(mod => {
                const mean = row[`${mod}MeanRT`];
                const sd = row[`${mod}SdRT`];
                const cov = row[`${mod}CoV`];
                if (mean == null) return null;
                return (
                    <p key={mod} style={{ color: MODALITY_COLORS[mod] }}>
                        {MODALITY_LABELS[mod]}: {mean} ms{sd != null ? ` ± ${sd}` : ''}
                        {cov != null ? ` (CoV ${cov.toFixed(2)})` : ''}
                    </p>
                );
            })}
        </div>
    );
};

const LapseTooltip = ({ active, payload, label, modalities }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload || {};
    return (
        <div className="bg-theme-bg-elevated border border-theme-line p-2 text-xs font-mono">
            <p className="text-theme-text-muted mb-1">
                N={label}
                {row.sessionCount != null ? ` · ${row.sessionCount} session${row.sessionCount !== 1 ? 's' : ''}` : ''}
            </p>
            {modalities.map(mod => {
                const v = row[`${mod}Lapses`];
                if (v == null) return null;
                return (
                    <p key={mod} style={{ color: MODALITY_COLORS[mod] }}>
                        {MODALITY_LABELS[mod]}: {v.toFixed(1)} / session
                    </p>
                );
            })}
        </div>
    );
};

const OverviewRtChart = ({ rows, modalities }) => (
    <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
            <XAxis
                dataKey="nBack"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDecimals={false}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(v) => `N=${v}`}
            />
            <YAxis
                domain={[0, 'auto']}
                tickFormatter={(v) => `${v}ms`}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                width={52}
            />
            <Tooltip
                content={<RtTooltip modalities={modalities} />}
                cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
            />
            {modalities.map(mod => (
                <Area
                    key={`${mod}-band`}
                    type="monotone"
                    dataKey={`${mod}Range`}
                    stroke="none"
                    fill={MODALITY_COLORS[mod]}
                    fillOpacity={0.12}
                    legendType="none"
                    activeDot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
            {modalities.map(mod => (
                <Line
                    key={mod}
                    type="monotone"
                    dataKey={`${mod}MeanRT`}
                    name={MODALITY_LABELS[mod]}
                    stroke={MODALITY_COLORS[mod]}
                    strokeWidth={1.75}
                    dot={renderDot(mod)}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
        </ComposedChart>
    </ResponsiveContainer>
);

const OverviewLapseChart = ({ rows, modalities }) => (
    <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="rgb(var(--color-line))" strokeOpacity={0.4} />
            <XAxis
                dataKey="nBack"
                type="number"
                domain={['dataMin', 'dataMax']}
                allowDecimals={false}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                tickFormatter={(v) => `N=${v}`}
            />
            <YAxis
                domain={[0, 'auto']}
                tickFormatter={(v) => v.toFixed(1)}
                stroke="rgb(var(--color-text-muted))"
                tick={{ fontSize: 11, fontFamily: 'monospace' }}
                width={36}
            />
            <Tooltip
                content={<LapseTooltip modalities={modalities} />}
                cursor={{ stroke: 'rgb(var(--color-accent))', strokeOpacity: 0.25 }}
            />
            {modalities.map(mod => (
                <Line
                    key={mod}
                    type="monotone"
                    dataKey={`${mod}Lapses`}
                    name={MODALITY_LABELS[mod]}
                    stroke={MODALITY_COLORS[mod]}
                    strokeWidth={1.75}
                    dot={renderDot(mod)}
                    connectNulls={false}
                    isAnimationActive={false}
                />
            ))}
        </LineChart>
    </ResponsiveContainer>
);

// Two modes (mirrors metric/MetricPanel.js NBackDropdown):
//   • drillMode=true  — value is null | 'all' | number; leads with "— select —" to force a choice
//   • drillMode=false — value is null | number; "All" simply means null (no filter)
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

const RtPanel = ({
    overviewRows,
    drillRows,
    overTimeData,
    modalities,
    drillN,
    onDrillNChange,
    overTimeN,
    onOverTimeNChange,
    availableNBacks,
    showDropdown,
    view,
    onViewChange,
    bucketKind,
}) => {
    const isOverTime = view === 'overTime';
    const drillIsNumber = typeof drillN === 'number';
    const drillIsAll = drillN === 'all';
    const drillIsUnset = drillN == null;
    // `showDropdown` is passed as a prop (adaptive-only). It's the proxy for "is drilldown available here".
    const showByNBackPrompt = !isOverTime && showDropdown && drillIsUnset;
    const drilled = !isOverTime && showDropdown && drillIsNumber;
    const showOverviewInByNBack = !isOverTime && (!showDropdown || drillIsAll);
    const nBackSuffix = isOverTime
        ? (overTimeN != null ? ` · N=${overTimeN}` : '')
        : (drilled ? ` · N=${drillN}` : '');

    const byNBackHasData = drilled
        ? drillRows.some(r => modalities.some(mod => r[`${mod}MeanRT`] != null))
        : overviewRows.some(r => modalities.some(mod => r[`${mod}MeanRT`] != null));
    const overTimeHasData = overTimeData.some(r => modalities.some(mod => r[`${mod}MeanRT`] != null));
    const chartHasData = isOverTime ? overTimeHasData : byNBackHasData;
    const rtDisplayedRows = isOverTime
        ? overTimeData
        : drilled ? drillRows : overviewRows;
    const rtAverages = computeWeightedAverages(rtDisplayedRows, modalities, 'MeanRT');
    const rtAvgLevel = isOverTime
        ? (() => {
            let sum = 0, weight = 0;
            for (const r of rtDisplayedRows) {
                if (r.avgLevel == null) continue;
                const w = r.sessionCount || 1;
                sum += r.avgLevel * w; weight += w;
            }
            return weight > 0 ? sum / weight : null;
        })()
        : null;

    // In over-time mode, the dropdown is always useful (even classic) because
    // it filters to sessions at a specific N-back over time. In by-N-back mode,
    // the dropdown is the drilldown picker (adaptive only — classic has no N.DD granularity).
    const dropdownVisible = isOverTime || showDropdown;
    const dropdownValue = isOverTime ? overTimeN : drillN;
    const dropdownOnChange = isOverTime ? onOverTimeNChange : onDrillNChange;
    const dropdownDrillMode = !isOverTime && showDropdown;  // three-state mode with "— select —" leading option

    const description = (() => {
        if (isOverTime) {
            return overTimeN != null
                ? `Filtered to N=${overTimeN}. Right axis = avg level (N.DD).`
                : 'Lower is faster. Shaded band = ±1 SD. Right axis = avg level (N.DD).';
        }
        return drilled
            ? `Within N=${drillN}. Each line point is a 0.01-difficulty bucket; dots at 0.10 gridlines.`
            : 'Lower is faster. Shaded band = ±1 SD. Hover for CoV (SD/mean) and session count.';
    })();

    const emptyMessage = (() => {
        if (isOverTime) {
            return overTimeN != null
                ? `No sessions at N=${overTimeN} in this period.`
                : 'Not enough per-modality response-time data yet.';
        }
        return drilled
            ? `No adaptive sessions at N=${drillN} in this period.`
            : 'Not enough per-modality response-time data yet.';
    })();

    return (
        <div className="specimen-card p-3 sm:p-4 border border-theme-line">
            <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                        Response Time{nBackSuffix}
                    </h3>
                    <p className="text-xs text-theme-text-muted mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
            <div className="h-64 sm:h-72 w-full">
                {showByNBackPrompt ? (
                    <div className="h-full flex flex-col items-center justify-center gap-1 text-xs font-mono text-theme-text-muted text-center px-4">
                        <span className="text-theme-text">Pick a level to view this chart.</span>
                        <span>Choose <strong className="text-theme-text">All</strong> to see every N-back at once, or a specific N to zoom into its difficulty buckets.</span>
                    </div>
                ) : !chartHasData ? (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-theme-text-muted">
                        {emptyMessage}
                    </div>
                ) : isOverTime ? (
                    <OverTimeRtChart data={overTimeData} modalities={modalities} bucketKind={bucketKind} />
                ) : drilled ? (
                    <DrillRtChart rows={drillRows} modalities={modalities} drillN={drillN} />
                ) : (
                    <OverviewRtChart rows={overviewRows} modalities={modalities} />
                )}
            </div>
            {!showByNBackPrompt && chartHasData && (
                <ChartAveragesRow
                    averages={rtAverages}
                    modalities={modalities}
                    valueFormat={(v) => `${Math.round(v)} ms`}
                    avgLevel={rtAvgLevel}
                />
            )}
        </div>
    );
};

const LapsePanel = ({
    overviewRows,
    drillRows,
    overTimeData,
    modalities,
    drillN,
    onDrillNChange,
    overTimeN,
    onOverTimeNChange,
    availableNBacks,
    showDropdown,
    view,
    onViewChange,
    bucketKind,
}) => {
    const isOverTime = view === 'overTime';
    const drillIsNumber = typeof drillN === 'number';
    const drillIsAll = drillN === 'all';
    const drillIsUnset = drillN == null;
    // `showDropdown` is passed as a prop (adaptive-only). It's the proxy for "is drilldown available here".
    const showByNBackPrompt = !isOverTime && showDropdown && drillIsUnset;
    const drilled = !isOverTime && showDropdown && drillIsNumber;
    const showOverviewInByNBack = !isOverTime && (!showDropdown || drillIsAll);
    const nBackSuffix = isOverTime
        ? (overTimeN != null ? ` · N=${overTimeN}` : '')
        : (drilled ? ` · N=${drillN}` : '');

    const byNBackHasData = drilled
        ? drillRows.some(r => modalities.some(mod => r[`${mod}Lapses`] != null))
        : overviewRows.some(r => modalities.some(mod => r[`${mod}Lapses`] != null));
    const overTimeHasData = overTimeData.some(r => modalities.some(mod => r[`${mod}Lapses`] != null));
    const chartHasData = isOverTime ? overTimeHasData : byNBackHasData;
    const lapseDisplayedRows = isOverTime
        ? overTimeData
        : drilled ? drillRows : overviewRows;
    const lapseAverages = computeWeightedAverages(lapseDisplayedRows, modalities, 'Lapses');
    const lapseAvgLevel = isOverTime
        ? (() => {
            let sum = 0, weight = 0;
            for (const r of lapseDisplayedRows) {
                if (r.avgLevel == null) continue;
                const w = r.sessionCount || 1;
                sum += r.avgLevel * w; weight += w;
            }
            return weight > 0 ? sum / weight : null;
        })()
        : null;

    const dropdownVisible = isOverTime || showDropdown;
    const dropdownValue = isOverTime ? overTimeN : drillN;
    const dropdownOnChange = isOverTime ? onOverTimeNChange : onDrillNChange;
    const dropdownDrillMode = !isOverTime && showDropdown;

    const description = (() => {
        if (isOverTime) {
            return overTimeN != null
                ? `Filtered to N=${overTimeN}. Right axis = avg level (N.DD).`
                : 'Average responses per session slower than 800 ms. Right axis = avg level (N.DD).';
        }
        return drilled
            ? `Within N=${drillN}. Average responses per session slower than 800 ms; dots at 0.10 gridlines.`
            : 'Average responses per session slower than 800 ms. Lower is steadier.';
    })();

    const emptyMessage = (() => {
        if (isOverTime) {
            return overTimeN != null
                ? `No sessions at N=${overTimeN} in this period.`
                : 'Not enough per-modality lapse data yet.';
        }
        return drilled
            ? `No adaptive sessions at N=${drillN} in this period.`
            : 'Not enough per-modality lapse data yet.';
    })();

    return (
        <div className="specimen-card p-3 sm:p-4 border border-theme-line">
            <div className="mb-3 flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                        Lapses{nBackSuffix}
                    </h3>
                    <p className="text-xs text-theme-text-muted mt-0.5">{description}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
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
            <div className="h-56 sm:h-64 w-full">
                {showByNBackPrompt ? (
                    <div className="h-full flex flex-col items-center justify-center gap-1 text-xs font-mono text-theme-text-muted text-center px-4">
                        <span className="text-theme-text">Pick a level to view this chart.</span>
                        <span>Choose <strong className="text-theme-text">All</strong> to see every N-back at once, or a specific N to zoom into its difficulty buckets.</span>
                    </div>
                ) : !chartHasData ? (
                    <div className="h-full flex items-center justify-center text-xs font-mono text-theme-text-muted">
                        {emptyMessage}
                    </div>
                ) : isOverTime ? (
                    <OverTimeLapseChart data={overTimeData} modalities={modalities} bucketKind={bucketKind} />
                ) : drilled ? (
                    <DrillLapseChart rows={drillRows} modalities={modalities} drillN={drillN} />
                ) : (
                    <OverviewLapseChart rows={overviewRows} modalities={modalities} />
                )}
            </div>
            {!showByNBackPrompt && chartHasData && (
                <ChartAveragesRow
                    averages={lapseAverages}
                    modalities={modalities}
                    valueFormat={(v) => v.toFixed(1)}
                    label="Average / session"
                    avgLevel={lapseAvgLevel}
                />
            )}
        </div>
    );
};

const ResponseTimeStabilityChart = ({
    data,
    mode,
    modalitiesOverride,
    trainingMode,
    period,
    drilldownData,
    rtDrillN,
    onDrillIn,
    onDrillOut,
    lapsesDrilldownData,
    lapseDrillN,
    onLapseDrillIn,
    onLapseDrillOut,
    rtView,
    lapsesView,
    onRtViewChange,
    onLapsesViewChange,
    rtOverTimeData,
    lapsesOverTimeData,
    rtOverTimeNBack,
    lapsesOverTimeNBack,
    onRtOverTimeNBackChange,
    onLapsesOverTimeNBackChange,
}) => {
    const modalities = (modalitiesOverride && modalitiesOverride.length > 0)
        ? modalitiesOverride
        : (MODE_MODALITIES[mode] || MODE_MODALITIES.dual);

    const overviewRows = useMemo(
        () => buildOverviewRows(data || [], modalities),
        [data, modalities]
    );

    const availableNBacks = useMemo(
        () => Array.from(new Set((data || []).map(r => r.nBack))).sort((a, b) => a - b),
        [data]
    );
    const showDropdown = trainingMode === 'adaptive';
    const bucketKind = BUCKET_FOR_PERIOD[period] || 'day';

    const rtDrillRows = useMemo(
        () => buildDrillRows(drilldownData || [], modalities),
        [drilldownData, modalities]
    );
    const lapseDrillRows = useMemo(
        () => buildDrillRows(lapsesDrilldownData || [], modalities),
        [lapsesDrilldownData, modalities]
    );

    return (
        <div className="space-y-4">
            <RtPanel
                overviewRows={overviewRows}
                drillRows={rtDrillRows}
                overTimeData={rtOverTimeData || []}
                modalities={modalities}
                drillN={showDropdown ? rtDrillN : null}
                onDrillNChange={(n) => (n == null ? onDrillOut() : onDrillIn(n))}
                overTimeN={rtOverTimeNBack}
                onOverTimeNChange={onRtOverTimeNBackChange}
                availableNBacks={availableNBacks}
                showDropdown={showDropdown}
                view={rtView}
                onViewChange={onRtViewChange}
                bucketKind={bucketKind}
            />
            <LapsePanel
                overviewRows={overviewRows}
                drillRows={lapseDrillRows}
                overTimeData={lapsesOverTimeData || []}
                modalities={modalities}
                drillN={showDropdown ? lapseDrillN : null}
                onDrillNChange={(n) => (n == null ? onLapseDrillOut() : onLapseDrillIn(n))}
                overTimeN={lapsesOverTimeNBack}
                onOverTimeNChange={onLapsesOverTimeNBackChange}
                availableNBacks={availableNBacks}
                showDropdown={showDropdown}
                view={lapsesView}
                onViewChange={onLapsesViewChange}
                bucketKind={bucketKind}
            />
        </div>
    );
};

export default ResponseTimeStabilityChart;
