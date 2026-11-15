/* src/components/insights/consistency/TrainingMapCard.js
 *
 * 365-day heatmap with a stats footer. Fixed 10px cells, deterministic
 * grid width (~634px). Scrolls horizontally on mobile. Today's cell is
 * outlined so alignment is visually verifiable.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar } from '@fortawesome/free-solid-svg-icons';

const CELL_PX = 10;
const GAP_PX = 2;

const MONTH_LABELS_SHORT = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Date-only parsing that always returns local midnight — avoids parseISO
// edge cases where some browsers treated "YYYY-MM-DD" as UTC.
const parseLocalDate = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

const fmtDate = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

// Mon=0, Sun=6.
const dowIndexMonFirst = (d) => (d.getDay() + 6) % 7;

// Monday of the week containing d.
const startOfMonWeek = (d) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() - dowIndexMonFirst(d));
    return copy;
};

const intensityFromCount = (count) => {
    if (count === 0) return 'bg-theme-bg-elevated';
    if (count === 1) return 'bg-theme-accent/25';
    if (count === 2) return 'bg-theme-accent/50';
    if (count === 3) return 'bg-theme-accent/75';
    return 'bg-theme-accent';
};

const FooterStat = ({ value, label, suffix }) => (
    <div className="flex flex-col gap-1">
        <span className="text-xl sm:text-2xl font-mono font-bold text-theme-text">
            {value}
            {suffix && <span className="text-xs text-theme-text-muted font-normal ml-1">{suffix}</span>}
        </span>
        <span className="text-[0.625rem] font-mono uppercase tracking-wider text-theme-text-muted">
            {label}
        </span>
    </div>
);

/* ---------------- 365-day calendar ---------------- */
const Calendar365 = ({ cells }) => {
    const scrollRef = useRef(null);
    const endMarkerRef = useRef(null);

    const { columns, monthTicks, todayKey } = useMemo(() => {
        const cols = [];
        let currentCol = Array(7).fill(null);
        let lastWeekStart = null;

        // Pass 1: group cells into weekly columns.
        for (const cell of cells) {
            const d = parseLocalDate(cell.date);
            const ws = fmtDate(startOfMonWeek(d));
            if (lastWeekStart && ws !== lastWeekStart) {
                cols.push(currentCol);
                currentCol = Array(7).fill(null);
            }
            currentCol[dowIndexMonFirst(d)] = cell;
            lastWeekStart = ws;
        }
        if (currentCol.some(Boolean)) cols.push(currentCol);

        // Pass 2: walk columns and attach month labels at the column
        // containing the first day of each new month. This is deterministic
        // based on the already-built grid, so labels can't drift.
        const ticks = [];
        let lastMonth = -1;
        for (let i = 0; i < cols.length; i++) {
            for (const cell of cols[i]) {
                if (!cell) continue;
                const d = parseLocalDate(cell.date);
                const m = d.getMonth();
                if (m !== lastMonth && d.getDate() <= 7) {
                    ticks.push({ col: i, label: MONTH_LABELS_SHORT[m] });
                    lastMonth = m;
                    break;
                }
            }
        }

        const today = fmtDate(new Date());
        return { columns: cols, monthTicks: ticks, todayKey: today };
    }, [cells]);

    // Scroll to the "today" marker at the right end of the grid once laid out.
    useEffect(() => {
        const marker = endMarkerRef.current;
        if (marker) {
            // scrollIntoView is more reliable than manual scrollLeft across
            // mobile browsers.
            marker.scrollIntoView({ inline: 'end', block: 'nearest' });
        }
    }, [columns.length]);

    const colCount = Math.max(columns.length, 1);
    // Cells use `minmax(CELL_PX, 1fr)`:
    //   - On wide screens, cells stretch (1fr) to fill the card.
    //   - On narrow screens, cells floor at CELL_PX (10px); minWidth on the
    //     grid itself keeps it from compressing below its natural size so
    //     the overflow-x-auto wrapper can scroll instead.
    const gridTemplateColumns = `repeat(${colCount}, minmax(${CELL_PX}px, 1fr))`;
    const gridMinWidth = `${colCount * CELL_PX + (colCount - 1) * GAP_PX}px`;

    return (
        <div className="relative">
            <div
                ref={scrollRef}
                className="w-full max-w-full overflow-x-auto pb-2 calendar-scroll"
            >
                <div
                    className="grid"
                    style={{
                        gridTemplateColumns,
                        gridTemplateRows: `repeat(7, auto)`,
                        gridAutoFlow: 'column',
                        gap: `${GAP_PX}px`,
                        minWidth: gridMinWidth,
                        // Extra breathing room on both sides so the outline
                        // around today's cell (outline-offset: 1px) isn't
                        // clipped when the grid is scrolled to either edge.
                        paddingLeft: '2px',
                        paddingRight: '2px',
                    }}
                >
                    {columns.flatMap((col, ci) =>
                        col.map((cell, ri) => {
                            const isToday = cell && cell.date === todayKey;
                            return (
                                <div
                                    key={`${ci}-${ri}`}
                                    className={[
                                        cell ? intensityFromCount(cell.count) : 'bg-transparent',
                                        isToday ? 'outline outline-1 outline-theme-accent outline-offset-[1px]' : '',
                                        'rounded-[1px]',
                                    ].join(' ')}
                                    style={{ aspectRatio: '1 / 1' }}
                                    title={cell ? `${cell.date}: ${cell.count} sessions` : ''}
                                />
                            );
                        })
                    )}
                </div>
                <div
                    className="grid mt-1 text-[0.5625rem] font-mono uppercase tracking-wider text-theme-text-muted"
                    style={{
                        gridTemplateColumns,
                        gap: `${GAP_PX}px`,
                        minWidth: gridMinWidth,
                    }}
                >
                    {columns.map((_, ci) => {
                        const tick = monthTicks.find(t => t.col === ci);
                        return (
                            <div
                                key={ci}
                                className="text-left whitespace-nowrap"
                                style={{ overflow: 'visible' }}
                            >
                                {tick ? tick.label : ''}
                            </div>
                        );
                    })}
                </div>
                {/* Invisible marker at the end — scrollIntoView target. */}
                <div ref={endMarkerRef} aria-hidden="true" style={{ width: 1, flex: 'none' }} />
            </div>

            {/* Left-edge fade hints at history off-screen left */}
            <div
                className="pointer-events-none absolute top-0 left-0 w-6 h-[calc(100%-1rem)]"
                style={{ background: 'linear-gradient(to right, rgb(var(--color-bg-secondary)), rgba(0,0,0,0))' }}
                aria-hidden="true"
            />
        </div>
    );
};

const IntensityLegend = () => (
    <div className="flex items-center gap-1.5 text-[0.5625rem] font-mono uppercase tracking-wider text-theme-text-muted flex-shrink-0">
        <span>less</span>
        <div className="w-2.5 h-2.5 bg-theme-bg-elevated border border-theme-line rounded-[1px]" />
        <div className="w-2.5 h-2.5 bg-theme-accent/25 rounded-[1px]" />
        <div className="w-2.5 h-2.5 bg-theme-accent/50 rounded-[1px]" />
        <div className="w-2.5 h-2.5 bg-theme-accent/75 rounded-[1px]" />
        <div className="w-2.5 h-2.5 bg-theme-accent rounded-[1px]" />
        <span>more</span>
    </div>
);

const TrainingMapCard = ({ cells = [], stats = null }) => {
    return (
        <div className="specimen-card p-4 sm:p-5 relative">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">
                    <FontAwesomeIcon icon={faCalendar} className="mr-2" />
                    Daily Record · Last 365 Days
                </h3>
                <IntensityLegend />
            </div>

            <Calendar365 cells={cells} />

            {stats && (
                <div className="mt-4 pt-3 border-t border-theme-line grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <FooterStat value={stats.activeDays} label="Days trained" />
                    <FooterStat value={`${stats.activeRate}%`} label="Active rate" />
                    <FooterStat value={stats.peakDays} label="Peak days (3+ sessions)" />
                    <FooterStat value={stats.totalHours} label="Hours invested" suffix="hrs" />
                </div>
            )}
        </div>
    );
};

export default TrainingMapCard;
