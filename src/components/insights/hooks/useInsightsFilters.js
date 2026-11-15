/* src/components/insights/hooks/useInsightsFilters.js */
/* URL-synced filter state for the Insights page.
 * Only non-default values are serialized into the URL so shared links stay clean.
 * Uses React Router v7 useSearchParams.
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    GAME_MODE_OPTIONS as SHARED_GAME_MODE_OPTIONS,
    GAME_MODE_KEYS as SHARED_GAME_MODE_KEYS,
    SINGLE_MODE_OPTIONS as SHARED_SINGLE_MODE_OPTIONS,
    SINGLE_MODE_KEYS,
    MODE_MODALITIES,
} from '../../../constants/modeStyles';
import { useUser } from '../../../contexts/UserContext';

export const TRAINING_MODE_OPTIONS = [
    { key: 'adaptive', label: 'Adaptive' },
    { key: 'classic', label: 'Classic' },
];

export const PERIOD_OPTIONS = [
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '1y', label: '1Y' },
    { key: 'all', label: 'All' },
];

// Re-export so components that imported GAME_MODE_OPTIONS from this hook
// keep working unchanged. Source of truth is constants/modeStyles.js.
export const GAME_MODE_OPTIONS = SHARED_GAME_MODE_OPTIONS;

// Insights-local extension: 'single' parent pill first, then dual/triple/quad.
// This is NOT pushed back into constants/modeStyles.js — other consumers
// (ModeSelector, etc.) use their own composition of parent + sub-options.
export const INSIGHTS_GAME_MODE_OPTIONS = [
    { key: 'single', label: 'Single' },
    ...SHARED_GAME_MODE_OPTIONS,
];

// Sub-pills shown when the Single parent is expanded.
export const SINGLE_SUB_OPTIONS = SHARED_SINGLE_MODE_OPTIONS;

export const VIEW_OPTIONS = [
    { key: 'byNBack', label: 'By N-back' },
    { key: 'overTime', label: 'Over time' },
];

const VIEW_KEYS = VIEW_OPTIONS.map(o => o.key);

// All mode keys accepted by the Insights filter bar — the 3 classic parent
// modes, the 'single' aggregate, and the 4 specific singleX modes. Kept in
// explicit order so the multi-select stays deterministic.
const GAME_MODE_KEYS = [
    ...SHARED_GAME_MODE_KEYS,
    'single',
    ...SINGLE_MODE_KEYS,
];

// Modality sets per game mode. Sourced from constants/modeStyles.js (dual,
// triple, quad, singleVisual/Audio/Color/Shape). Extended here with the
// 'single' aggregate key — union of all 4 modalities — so the Strengths
// modality filter shows all 4 when the user selects the Single parent.
const MODALITIES_BY_MODE = {
    ...MODE_MODALITIES,
    single: ['visual', 'audio', 'color', 'shape'],
};
const ALL_MODALITY_KEYS = ['visual', 'audio', 'color', 'shape'];

export const MODALITY_OPTIONS = [
    { key: 'visual', label: 'Position' },
    { key: 'audio', label: 'Audio' },
    { key: 'color', label: 'Color' },
    { key: 'shape', label: 'Shape' },
];

export const DEFAULTS = {
    trainingMode: 'adaptive',
    period: '30d',
    // Default selection is dual+triple+quad — the classic modes. Single is
    // an opt-in addition (users who haven't played singles don't see empty
    // lines cluttering the chart).
    gameModes: [...SHARED_GAME_MODE_KEYS],
    swGameMode: 'dual',
    rtDrillN: null,
    lapseDrillN: null,
    rtView: 'overTime',
    lapsesView: 'overTime',
    rtOverTimeNBack: null,
    lapsesOverTimeNBack: null,
    hitView: 'overTime',
    hitDrillN: null,
    hitOverTimeNBack: null,
    accuracyView: 'overTime',
    accuracyDrillN: null,
    accuracyOverTimeNBack: null,
    farView: 'overTime',
    farDrillN: null,
    farOverTimeNBack: null,
    senseView: 'overTime',
    senseDrillN: null,
    senseOverTimeNBack: null,
    // Lure FAR panel (n-1 / n+1 sub-toggle + standard view/drill/overTime).
    lureType: 'n-1',
    lureView: 'overTime',
    lureDrillN: null,
    lureOverTimeNBack: null,
    // Per-modality filter for the Strengths section. Default = all modalities
    // valid for the current swGameMode; intersect on read. URL absent = default.
    swModalities: null,
};

const arraysEqual = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

export const useInsightsFilters = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { activeGameMode, hasClassicAccess } = useUser();

    // Cohort-aware Protocol options. Hide the Classic toggle for users without
    // Classic access (limited_modern), since they cannot have Classic data.
    // hasClassicAccess defaults to true (UserContext returns true when freeTier is null/undefined).
    const trainingModeOptions = useMemo(() => (
        hasClassicAccess
            ? TRAINING_MODE_OPTIONS
            : [{ key: 'adaptive', label: 'Adaptive' }]
    ), [hasClassicAccess]);

    // Per-user baseline that layers Dashboard-saved prefs on top of static DEFAULTS.
    // URL params still override everything; this only governs the absent-param fallback
    // and the "strip param when matches default" behavior in setFilter / nonDefaultCount.
    //
    // Mode precedence (highest to lowest):
    //   1. URL `?swGameMode=…` / `?gameModes=…` (per-page deep link)
    //   2. Dashboard's `globalModeFilter` localStorage (user's current dashboard view)
    //      — treats 'all' as "no preference" and falls through.
    //   3. UserContext `activeGameMode` (Firestore) — the mode they're actively training.
    //   4. Static DEFAULTS — dual for Strengths, [dual, triple, quad] for Growth.
    const effectiveDefaults = useMemo(() => {
        const storedTrainingMode = typeof window !== 'undefined'
            ? window.localStorage.getItem('globalTrainingMode')
            : null;
        const trainingModeDefault = (storedTrainingMode === 'adaptive' || storedTrainingMode === 'classic')
            ? storedTrainingMode
            : DEFAULTS.trainingMode;

        const storedModeFilter = typeof window !== 'undefined'
            ? window.localStorage.getItem('globalModeFilter')
            : null;
        // 'all' is the dashboard's sentinel for "no mode filter"; skip it so we fall
        // through to activeGameMode rather than forcing all pages to the 'all' bucket.
        const dashModeMatch = (storedModeFilter && storedModeFilter !== 'all' && GAME_MODE_KEYS.includes(storedModeFilter))
            ? storedModeFilter
            : null;
        const activeGameModeMatch = GAME_MODE_KEYS.includes(activeGameMode) ? activeGameMode : null;
        const resolvedMode = dashModeMatch ?? activeGameModeMatch;

        return {
            ...DEFAULTS,
            trainingMode: trainingModeDefault,
            swGameMode: resolvedMode ?? DEFAULTS.swGameMode,
            gameModes: resolvedMode ? [resolvedMode] : [...DEFAULTS.gameModes],
        };
    }, [activeGameMode]);

    // Coerce ?trainingMode=classic deep links to 'adaptive' if the user lacks Classic access.
    const trainingMode = trainingModeOptions.some(o => o.key === searchParams.get('trainingMode'))
        ? searchParams.get('trainingMode')
        : (trainingModeOptions.some(o => o.key === effectiveDefaults.trainingMode)
            ? effectiveDefaults.trainingMode
            : 'adaptive');

    const period = PERIOD_OPTIONS.some(o => o.key === searchParams.get('period'))
        ? searchParams.get('period')
        : DEFAULTS.period;

    const gameModesRaw = searchParams.get('gameModes');
    const gameModes = useMemo(() => {
        if (!gameModesRaw) return [...effectiveDefaults.gameModes];
        const parsed = gameModesRaw.split(',').filter(m => GAME_MODE_KEYS.includes(m));
        // Min-1 enforced: if URL somehow has none, fall back to default.
        return parsed.length > 0 ? parsed : [...effectiveDefaults.gameModes];
    }, [gameModesRaw, effectiveDefaults]);

    const swGameMode = GAME_MODE_KEYS.includes(searchParams.get('swGameMode'))
        ? searchParams.get('swGameMode')
        : effectiveDefaults.swGameMode;

    const parseViewParam = (key) => (
        VIEW_KEYS.includes(searchParams.get(key))
            ? searchParams.get(key)
            : DEFAULTS[key]
    );

    const parseNBackParam = (key) => {
        const raw = searchParams.get(key);
        const n = raw != null ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null;
    };

    // DrillN fields carry three states: null (unset — prompt user to pick),
    // 'all' (explicit "show overview"), or a number (N.DD drilldown into that N).
    // URL encoding: absent = null, '=all' = 'all', '=<int>' = number.
    const parseDrillParam = (key) => {
        const raw = searchParams.get(key);
        if (raw === 'all') return 'all';
        const n = raw != null ? parseInt(raw, 10) : NaN;
        return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null;
    };

    const rtView = parseViewParam('rtView');
    const lapsesView = parseViewParam('lapsesView');
    const hitView = parseViewParam('hitView');
    const accuracyView = parseViewParam('accuracyView');
    const farView = parseViewParam('farView');
    const senseView = parseViewParam('senseView');
    const lureView = parseViewParam('lureView');

    const rtDrillN = parseDrillParam('rtDrillN');
    const lapseDrillN = parseDrillParam('lapseDrillN');
    const hitDrillN = parseDrillParam('hitDrillN');
    const accuracyDrillN = parseDrillParam('accuracyDrillN');
    const farDrillN = parseDrillParam('farDrillN');
    const senseDrillN = parseDrillParam('senseDrillN');
    const lureDrillN = parseDrillParam('lureDrillN');

    const rtOverTimeNBack = parseNBackParam('rtOverTimeNBack');
    const lapsesOverTimeNBack = parseNBackParam('lapsesOverTimeNBack');
    const hitOverTimeNBack = parseNBackParam('hitOverTimeNBack');
    const accuracyOverTimeNBack = parseNBackParam('accuracyOverTimeNBack');
    const farOverTimeNBack = parseNBackParam('farOverTimeNBack');
    const senseOverTimeNBack = parseNBackParam('senseOverTimeNBack');
    const lureOverTimeNBack = parseNBackParam('lureOverTimeNBack');

    const lureTypeRaw = searchParams.get('lureType');
    const lureType = (lureTypeRaw === 'n-1' || lureTypeRaw === 'n+1') ? lureTypeRaw : DEFAULTS.lureType;

    // swModalities: parse against the CURRENT swGameMode's valid modalities.
    // Default (URL absent) = all valid modalities. Min-1 enforced.
    const swModalitiesRaw = searchParams.get('swModalities');
    const swModalities = useMemo(() => {
        const valid = MODALITIES_BY_MODE[swGameMode] || MODALITIES_BY_MODE.dual;
        if (!swModalitiesRaw) return [...valid];
        const parsed = swModalitiesRaw.split(',').filter(m => valid.includes(m));
        return parsed.length > 0 ? parsed : [...valid];
    }, [swModalitiesRaw, swGameMode]);

    // Self-correct contradictory URL state: classic mode has no N.DD granularity,
    // so *DrillN params must not coexist with trainingMode=classic (e.g. from deep links).
    const anyDrillSet = rtDrillN != null || lapseDrillN != null
        || hitDrillN != null || accuracyDrillN != null || farDrillN != null || senseDrillN != null
        || lureDrillN != null;
    useEffect(() => {
        if (trainingMode === 'classic' && anyDrillSet) {
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.delete('rtDrillN');
                next.delete('lapseDrillN');
                next.delete('hitDrillN');
                next.delete('accuracyDrillN');
                next.delete('farDrillN');
                next.delete('senseDrillN');
                next.delete('lureDrillN');
                return next;
            }, { replace: true });
        }
    }, [trainingMode, anyDrillSet, setSearchParams]);

    // Generic setter — pass key + new value. Removes the param if value matches default.
    // `def` reads from effectiveDefaults so a value that matches the user's Dashboard-derived
    // baseline (e.g. trainingMode='classic' when the user's default is classic) also gets
    // stripped from the URL, keeping shared-clean-URL semantics consistent per user.
    const setFilter = useCallback((key, value) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            const def = effectiveDefaults[key];
            const isDefault = Array.isArray(def)
                ? Array.isArray(value) && arraysEqual([...value].sort(), [...def].sort())
                : value === def;
            if (isDefault || value == null) {
                next.delete(key);
            } else {
                next.set(key, Array.isArray(value) ? value.join(',') : String(value));
            }
            // Classic mode has no N.DD granularity — clear drilldown if present.
            if (key === 'trainingMode' && value === 'classic') {
                next.delete('rtDrillN');
                next.delete('lapseDrillN');
                next.delete('hitDrillN');
                next.delete('accuracyDrillN');
                next.delete('farDrillN');
                next.delete('senseDrillN');
                next.delete('lureDrillN');
            }
            // Swapping game mode invalidates previous modality selection —
            // new mode may have different modalities (dual:2, triple:3, quad:4).
            // Clear so it defaults to all of the new mode's modalities.
            if (key === 'swGameMode') {
                next.delete('swModalities');
            }
            return next;
        }, { replace: true });
    }, [setSearchParams, effectiveDefaults]);

    // Semantics for the Growth multi-select:
    //   - The selection is a plain set of keys: 'dual', 'triple', 'quad',
    //     'single' (aggregate of all 4 singles), and/or any singleX.
    //   - Toggling a key just adds/removes that one key. Toggling 'single'
    //     does NOT auto-add the four singleX keys; it's its own aggregate
    //     bucket.
    //   - 'single' and singleX keys may coexist. Downstream derivations
    //     populate a 'single' bucket that unions all singleX sessions, and
    //     each singleX bucket holds only its own sessions, so the chart
    //     renders one line per selected key without double-counting.
    const toggleGameMode = useCallback((mode) => {
        if (!GAME_MODE_KEYS.includes(mode)) return;
        const current = new Set(gameModes);
        if (current.has(mode)) {
            // Min-1 enforced.
            if (current.size === 1) return;
            current.delete(mode);
        } else {
            current.add(mode);
        }
        const ordered = GAME_MODE_KEYS.filter(m => current.has(m));
        setFilter('gameModes', ordered);
    }, [gameModes, setFilter]);

    const toggleModality = useCallback((mod) => {
        const valid = MODALITIES_BY_MODE[swGameMode] || MODALITIES_BY_MODE.dual;
        if (!valid.includes(mod)) return;
        const current = new Set(swModalities);
        if (current.has(mod)) {
            // Min-1 enforced.
            if (current.size === 1) return;
            current.delete(mod);
        } else {
            current.add(mod);
        }
        // Preserve canonical order (visual, audio, color, shape).
        const ordered = ALL_MODALITY_KEYS.filter(m => current.has(m));
        // Only write to URL when the selection is a strict subset of valid;
        // equal-to-valid means "all" which is the default → strip from URL.
        const isAll = ordered.length === valid.length && valid.every(m => current.has(m));
        setFilter('swModalities', isAll ? null : ordered);
    }, [swGameMode, swModalities, setFilter]);

    const reset = useCallback(() => {
        setSearchParams(new URLSearchParams(), { replace: true });
    }, [setSearchParams]);

    const nonDefaultCount = useMemo(() => {
        let n = 0;
        if (trainingMode !== effectiveDefaults.trainingMode) n += 1;
        if (period !== DEFAULTS.period) n += 1;
        if (!arraysEqual([...gameModes].sort(), [...effectiveDefaults.gameModes].sort())) n += 1;
        if (swGameMode !== effectiveDefaults.swGameMode) n += 1;
        if (rtDrillN !== DEFAULTS.rtDrillN) n += 1;
        if (lapseDrillN !== DEFAULTS.lapseDrillN) n += 1;
        if (rtView !== DEFAULTS.rtView) n += 1;
        if (lapsesView !== DEFAULTS.lapsesView) n += 1;
        if (rtOverTimeNBack !== DEFAULTS.rtOverTimeNBack) n += 1;
        if (lapsesOverTimeNBack !== DEFAULTS.lapsesOverTimeNBack) n += 1;
        if (hitView !== DEFAULTS.hitView) n += 1;
        if (hitDrillN !== DEFAULTS.hitDrillN) n += 1;
        if (hitOverTimeNBack !== DEFAULTS.hitOverTimeNBack) n += 1;
        if (accuracyView !== DEFAULTS.accuracyView) n += 1;
        if (accuracyDrillN !== DEFAULTS.accuracyDrillN) n += 1;
        if (accuracyOverTimeNBack !== DEFAULTS.accuracyOverTimeNBack) n += 1;
        if (farView !== DEFAULTS.farView) n += 1;
        if (farDrillN !== DEFAULTS.farDrillN) n += 1;
        if (farOverTimeNBack !== DEFAULTS.farOverTimeNBack) n += 1;
        if (senseView !== DEFAULTS.senseView) n += 1;
        if (senseDrillN !== DEFAULTS.senseDrillN) n += 1;
        if (senseOverTimeNBack !== DEFAULTS.senseOverTimeNBack) n += 1;
        if (lureType !== DEFAULTS.lureType) n += 1;
        if (lureView !== DEFAULTS.lureView) n += 1;
        if (lureDrillN !== DEFAULTS.lureDrillN) n += 1;
        if (lureOverTimeNBack !== DEFAULTS.lureOverTimeNBack) n += 1;
        if (swModalitiesRaw) n += 1;  // URL has an explicit swModalities value
        return n;
    }, [
        trainingMode, period, gameModes, swGameMode,
        rtDrillN, lapseDrillN, rtView, lapsesView, rtOverTimeNBack, lapsesOverTimeNBack,
        hitView, hitDrillN, hitOverTimeNBack,
        accuracyView, accuracyDrillN, accuracyOverTimeNBack,
        farView, farDrillN, farOverTimeNBack,
        senseView, senseDrillN, senseOverTimeNBack,
        lureType, lureView, lureDrillN, lureOverTimeNBack,
        swModalitiesRaw,
        effectiveDefaults,
    ]);

    return {
        filters: {
            trainingMode, period, gameModes, swGameMode,
            rtDrillN, lapseDrillN,
            rtView, lapsesView, rtOverTimeNBack, lapsesOverTimeNBack,
            hitView, hitDrillN, hitOverTimeNBack,
            accuracyView, accuracyDrillN, accuracyOverTimeNBack,
            farView, farDrillN, farOverTimeNBack,
            senseView, senseDrillN, senseOverTimeNBack,
            lureType, lureView, lureDrillN, lureOverTimeNBack,
            swModalities,
        },
        // Cohort-aware Protocol options (hidden entirely for limited_modern).
        trainingModeOptions,
        setFilter,
        toggleGameMode,
        toggleModality,
        reset,
        isNonDefault: nonDefaultCount > 0,
        nonDefaultCount,
    };
};
