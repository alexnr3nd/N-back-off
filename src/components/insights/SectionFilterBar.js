/* src/components/insights/SectionFilterBar.js */
/* Sticky filter bar rendered per section. Shows Protocol + Period + Mode
 * selectors. Game-mode control is either multi-select (Growth) or
 * single-select (Strengths) based on the `modeMode` prop.
 *
 * Styling mirrors the ProfileDashboard sticky filter: a sentinel div above
 * the bar is watched by IntersectionObserver; when it scrolls out of view
 * the bar is "stuck" and gets a solid background + border + shadow.
 * When inline, the bar has no background so the lab-grid pattern shows
 * through. While stuck the bar collapses to a breadcrumb by default; an
 * inline chevron toggles back to the full filter. Collapse pref is stored
 * in localStorage under a shared key so Growth/Strengths behave the same.
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import {
    TRAINING_MODE_OPTIONS,
    PERIOD_OPTIONS,
    INSIGHTS_GAME_MODE_OPTIONS,
    SINGLE_SUB_OPTIONS,
    MODALITY_OPTIONS,
} from './hooks/useInsightsFilters';
import { MODE_MODALITIES, SINGLE_MODE_KEYS } from '../../constants/modeStyles';
import { useIsMobile } from '../../utils/useIsMobile';
import { useUser } from '../../contexts/UserContext';

// Extend MODE_MODALITIES with the 'single' aggregate (all 4 modalities) so the
// modality filter can show all options when the user picks the Single parent.
const MODALITIES_BY_MODE = {
    ...MODE_MODALITIES,
    single: ['visual', 'audio', 'color', 'shape'],
};

const ACTIVE = 'bg-theme-accent/20 text-theme-accent border-theme-accent/50';
const INACTIVE = 'border-theme-line text-theme-text-muted hover:text-theme-text hover:border-theme-accent/50';

const Segmented = ({ options, value, onChange, ariaLabel }) => (
    <div className="flex shrink-0" role="group" aria-label={ariaLabel}>
        {options.map((opt, i) => (
            <button
                key={opt.key}
                type="button"
                onClick={() => onChange(opt.key)}
                aria-pressed={value === opt.key}
                className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${i === 0 ? '' : 'border-l-0'} ${value === opt.key ? ACTIVE : INACTIVE}`}
            >
                {opt.label}
            </button>
        ))}
    </div>
);

// `isActive` is optional; defaults to plain key-includes. Callers pass a custom
// predicate when a "parent" pill should light up for any of its sub-selections
// (e.g. Single parent lights up when any singleX is selected).
const MultiPills = ({ options, selected, onToggle, ariaLabel, isActive }) => (
    <div className="flex shrink-0" role="group" aria-label={ariaLabel}>
        {options.map((opt, i) => {
            const on = isActive ? isActive(opt.key, selected) : selected.includes(opt.key);
            return (
                <button
                    key={opt.key}
                    type="button"
                    onClick={() => onToggle(opt.key)}
                    aria-pressed={on}
                    title={on && selected.length === 1 ? 'At least one mode must remain selected' : undefined}
                    className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors ${i === 0 ? '' : 'border-l-0'} ${on ? ACTIVE : INACTIVE}`}
                >
                    {opt.label}
                </button>
            );
        })}
    </div>
);

const Label = ({ children }) => (
    <span className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider">{children}</span>
);

// For the breadcrumb: resolve a mode key into the parts that should appear in
// the summary. Top-level modes (dual/triple/quad) produce a single label; the
// 'single' aggregate produces ['Single']; specific singleX keys produce
// ['Single', '<sub>'] so the parent still shows even when only a sub is active.
const findModeSummaryParts = (key) => {
    if (!key) return [];
    if (SINGLE_MODE_KEYS.includes(key)) {
        const subLabel = SINGLE_SUB_OPTIONS.find(o => o.key === key)?.label;
        return subLabel ? ['Single', subLabel] : ['Single'];
    }
    const primary = INSIGHTS_GAME_MODE_OPTIONS.find(o => o.key === key)?.label;
    return primary ? [primary] : [];
};

// For singleX modes the valid modality is implicit (singleColor → 'color'), so
// listing it again in the breadcrumb would be a dupe.
const SINGLEX_IMPLICIT_MODALITY = {
    singleVisual: 'visual',
    singleAudio: 'audio',
    singleColor: 'color',
    singleShape: 'shape',
};

const SectionFilterBar = ({
    filters,
    setFilter,
    toggleGameMode,
    toggleModality,
    modeMode,  // 'multi' (Growth) | 'single' (Strengths)
}) => {
    const [isStuck, setIsStuck] = useState(false);
    const sentinelRef = useRef(null);
    const sentinelSeenRef = useRef(false);
    // Cohort gating: hide the Protocol toggle for limited_modern (no Classic access).
    // hasClassicAccess defaults to true for users without a freeTier flag set.
    const { hasClassicAccess } = useUser();

    // Collapse state for the sticky bar. Shared across Growth/Strengths via a
    // single localStorage key, mirroring the ProfileDashboard pattern: default
    // collapsed once pinned, explicit 'false' opts out. Only takes effect
    // while stuck — the inline bar at the top of the section always renders
    // the full filter regardless of the saved pref.
    const [isCollapsed, setIsCollapsedRaw] = useState(
        () => localStorage.getItem('insightsFilterCollapsed') !== 'false'
    );
    const setIsCollapsed = useCallback((v) => {
        setIsCollapsedRaw(v);
        localStorage.setItem('insightsFilterCollapsed', v ? 'true' : 'false');
    }, []);
    const isMobile = useIsMobile();

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    sentinelSeenRef.current = true;
                    setIsStuck(false);
                } else if (sentinelSeenRef.current) {
                    setIsStuck(true);
                }
            },
            { threshold: 0 }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    // Dense "Adaptive · 30D · Dual" style breadcrumb shown when collapsed, so a
    // scrolled user still sees what view they're on.
    const filterSummary = useMemo(() => {
        const parts = [];

        const proto = TRAINING_MODE_OPTIONS.find(o => o.key === filters.trainingMode);
        if (proto) parts.push(proto.label);

        const period = PERIOD_OPTIONS.find(o => o.key === filters.period);
        if (period) parts.push(period.label);

        if (modeMode === 'multi') {
            const modes = filters.gameModes || [];
            if (modes.length === 1) {
                parts.push(...findModeSummaryParts(modes[0]));
            } else if (modes.length > 1) {
                parts.push(`${modes.length} modes`);
            }
        } else {
            parts.push(...findModeSummaryParts(filters.swGameMode));

            const mods = filters.swModalities || [];
            // For a singleX mode the modality row is redundant with the sub-label we
            // already pushed (singleColor + modality 'color' would double up), so
            // skip it when those match.
            const implicitModality = SINGLEX_IMPLICIT_MODALITY[filters.swGameMode] || null;

            if (mods.length === 1 && mods[0] !== implicitModality) {
                const modOpt = MODALITY_OPTIONS.find(o => o.key === mods[0]);
                if (modOpt) parts.push(modOpt.label);
            } else if (mods.length > 1 && mods.length < 4) {
                parts.push(`${mods.length} modalities`);
            }
        }

        return parts.join(' · ');
    }, [filters, modeMode]);

    const showCollapsed = isStuck && isCollapsed && isMobile;

    return (
        <>
            <div ref={sentinelRef} className="h-0" />
            <div
                className={`z-20 py-3 px-2 sm:px-4 md:px-6 -mx-2 sm:-mx-4 md:-mx-6 border transition-all duration-200 ${
                    isStuck
                        ? 'bg-theme-bg/95 backdrop-blur-sm border-theme-line shadow-lg'
                        : 'border-transparent'
                }`}
                style={{ position: 'sticky', top: '8px' }}
            >
                {/*
                   Two stacked single-row grids, each animating 0fr ↔ 1fr. Canonical
                   pattern for transitioning to/from content-defined height: the row
                   collapses to 0 when 0fr and expands to content height when 1fr.
                   overflow-hidden + min-h-0 on the inner child lets the row shrink
                   past its item's intrinsic min-content size.
                */}
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: showCollapsed ? '0fr' : '1fr' }}
                >
                    <div className="overflow-hidden min-h-0" aria-hidden={showCollapsed} inert={showCollapsed ? true : undefined}>
                        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
                            {hasClassicAccess && (
                                <div className="flex items-center gap-2">
                                    <Label>Protocol:</Label>
                                    <Segmented
                                        options={TRAINING_MODE_OPTIONS}
                                        value={filters.trainingMode}
                                        onChange={(v) => setFilter('trainingMode', v)}
                                        ariaLabel="Protocol"
                                    />
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Label>Period:</Label>
                                <Segmented
                                    options={PERIOD_OPTIONS}
                                    value={filters.period}
                                    onChange={(v) => setFilter('period', v)}
                                    ariaLabel="Period"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Label>Mode:</Label>
                                {modeMode === 'multi' ? (
                                    <MultiPills
                                        options={INSIGHTS_GAME_MODE_OPTIONS}
                                        selected={filters.gameModes}
                                        onToggle={toggleGameMode}
                                        ariaLabel="Game modes"
                                        // Parent "Single" pill lights up for either the 'single' aggregate
                                        // or any specific singleX key, mirroring the Strengths Segmented
                                        // mapping and the dashboard's own isActive logic.
                                        isActive={(key, sel) => (
                                            key === 'single'
                                                ? sel.includes('single') || sel.some(m => SINGLE_MODE_KEYS.includes(m))
                                                : sel.includes(key)
                                        )}
                                    />
                                ) : (
                                    <Segmented
                                        // Segmented control for Strengths: map singleX → 'single' for
                                        // parent-pill highlight (sub-pill row handles the specific
                                        // selection).
                                        options={INSIGHTS_GAME_MODE_OPTIONS}
                                        value={SINGLE_MODE_KEYS.includes(filters.swGameMode) ? 'single' : filters.swGameMode}
                                        onChange={(v) => setFilter('swGameMode', v)}
                                        ariaLabel="Game mode"
                                    />
                                )}
                            </div>
                            {/* Sub-row for the Single parent. Shown when:
                                - Growth (multi): user has 'single' or any singleX toggled on.
                                - Strengths (single): swGameMode is 'single' or a singleX. */}
                            {modeMode === 'multi' && (
                                filters.gameModes.includes('single')
                                || filters.gameModes.some(m => SINGLE_MODE_KEYS.includes(m))
                            ) && (
                                <div className="flex items-center gap-2">
                                    <Label>Single:</Label>
                                    <MultiPills
                                        options={SINGLE_SUB_OPTIONS}
                                        selected={filters.gameModes}
                                        onToggle={toggleGameMode}
                                        ariaLabel="Single sub-modes"
                                    />
                                </div>
                            )}
                            {modeMode === 'single' && (
                                filters.swGameMode === 'single'
                                || SINGLE_MODE_KEYS.includes(filters.swGameMode)
                            ) && (
                                <div className="flex items-center gap-2">
                                    <Label>Single:</Label>
                                    <Segmented
                                        options={[
                                            { key: 'single', label: 'All' },
                                            ...SINGLE_SUB_OPTIONS,
                                        ]}
                                        value={filters.swGameMode}
                                        onChange={(v) => setFilter('swGameMode', v)}
                                        ariaLabel="Single sub-mode"
                                    />
                                </div>
                            )}
                            {modeMode === 'single' && (
                                <div className="flex items-center gap-2">
                                    <Label>Modality:</Label>
                                    <MultiPills
                                        options={MODALITY_OPTIONS.filter(
                                            o => (MODALITIES_BY_MODE[filters.swGameMode] || MODALITIES_BY_MODE.dual).includes(o.key)
                                        )}
                                        selected={filters.swModalities}
                                        onToggle={toggleModality}
                                        ariaLabel="Modalities"
                                    />
                                </div>
                            )}
                            {/* Collapse chevron — only appears while stuck on mobile. `ml-auto`
                                pushes it to the end of the wrapping flex so it anchors the
                                bottom-right. Desktop never auto-collapses, so the chevron has
                                no effect there and is hidden. */}
                            {isStuck && isMobile && (
                                <button
                                    type="button"
                                    onClick={() => setIsCollapsed(true)}
                                    className="shrink-0 ml-auto p-1.5 text-theme-text-muted hover:text-theme-accent transition-colors focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
                                    title="Collapse filters"
                                    aria-label="Collapse filters"
                                    aria-expanded="true"
                                >
                                    <FontAwesomeIcon icon={faChevronUp} className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                </div>

                {/* Collapsed breadcrumb — own single-row grid, animates 0fr ↔ 1fr
                    independently alongside the expanded grid above. */}
                <div
                    className="grid transition-[grid-template-rows] duration-300 ease-out"
                    style={{ gridTemplateRows: showCollapsed ? '1fr' : '0fr' }}
                >
                    <div className="overflow-hidden min-h-0" aria-hidden={!showCollapsed} inert={!showCollapsed ? true : undefined}>
                        {/* Entire breadcrumb row is the expand toggle. */}
                        <button
                            type="button"
                            onClick={() => setIsCollapsed(false)}
                            className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group focus:outline-none focus:ring-1 focus:ring-theme-accent/50"
                            title="Expand filters"
                            aria-label={`Expand filters — current: ${filterSummary}`}
                            aria-expanded="false"
                        >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="text-[0.625rem] font-mono uppercase tracking-[0.15em] text-theme-text-muted shrink-0">Filter</span>
                                <span className="text-xs font-mono text-theme-text-secondary truncate group-hover:text-theme-text transition-colors">{filterSummary}</span>
                            </div>
                            <span className="shrink-0 p-1.5 text-theme-text-muted group-hover:text-theme-accent transition-colors" aria-hidden="true">
                                <FontAwesomeIcon icon={faChevronDown} className="w-3 h-3" />
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SectionFilterBar;
