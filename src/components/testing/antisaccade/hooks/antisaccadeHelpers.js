/* src/components/testing/antisaccade/hooks/antisaccadeHelpers.js */
/**
 * Pure helpers for the Antisaccade assessment frontend.
 * Practice-deck generation (PRACTICE ONLY — scored trials always come from the
 * server), localStorage pending-results persistence, orientation/phone
 * detection, and the Web Audio alerting beep. Structural mirror of
 * visualArrays/hooks/visualArraysHelpers.js.
 */
import {
    ANTISACCADE_CONFIG,
    ANTISACCADE_TIMING,
    PENDING_PREFIX,
} from '../../../../constants/antisaccadeConstants';
import audioManager from '../../../../utils/audioManager';
import { initializeAudio } from '../../../../utils/countdownSounds';

const C = ANTISACCADE_CONFIG;
const T = ANTISACCADE_TIMING;

const shuffleInPlace = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

// --- Practice Deck (client-generated, never scored) ---

// Client-side mirror of functions/antisaccadeUtils.js generateTrialSpec.
const generateLocalTrialSpec = (cueSide, letter) => ({
    cueSide,
    targetSide: cueSide === 'left' ? 'right' : 'left',
    letter,
    // fixation drawn per-trial so each trial has its own unpredictable foreperiod
    fixationMs: Math.round(T.FIXATION_MIN_MS + Math.random() * (T.FIXATION_MAX_MS - T.FIXATION_MIN_MS)),
});

/**
 * Client-side mirror of the server's buildBalancedDeck: PRACTICE_TRIALS (16)
 * trials balanced side x letter (4 per cell), shuffled, each flagged
 * `practice: true` with a `practice_` trialId prefix distinct from the
 * server's `as_` ids.
 */
export const generatePracticeTrials = () => {
    const cells = [];
    const per = C.PRACTICE_TRIALS / (C.SIDES.length * C.LETTERS.length);
    for (const cueSide of C.SIDES) {
        for (const letter of C.LETTERS) {
            for (let i = 0; i < per; i++) cells.push({ cueSide, letter });
        }
    }
    shuffleInPlace(cells);
    return cells.map((c, i) => ({
        trialId: `practice_${i}`,
        practice: true,
        ...generateLocalTrialSpec(c.cueSide, c.letter),
    }));
};

// --- Trial records & submission helpers (pure; used by useAntisaccadeLogic) ---

/**
 * Base scored-trial record in the validateAntisaccadeTrials shape; call sites
 * override the outcome fields. blurredDuringResponse is client-side audit
 * only (the backend compaction drops it).
 */
export const buildTrialRecord = (spec, overrides = {}) => ({
    trialId: spec.trialId,
    cueSide: spec.cueSide,
    targetSide: spec.targetSide,
    letter: spec.letter,
    response: null,
    rtMs: null,
    timedOut: false,
    interrupted: false,
    redo: spec.redo === true,
    measuredTargetMs: null,
    blurredDuringResponse: false,
    ...overrides,
});

/**
 * Practice redo spec after an interruption: same cue-side/letter cell, fresh
 * fixation jitter, `r`-suffixed id. Practice is client-local — no server
 * spare or redo budget is consumed.
 */
export const makeRedoPracticeSpec = (spec) => ({
    trialId: `${spec.trialId}r`,
    practice: true,
    ...generateLocalTrialSpec(spec.cueSide, spec.letter),
});

/**
 * Majority input modality for the submit payload; tie -> the modality of the
 * LAST response. Null when no responses were given (all timeouts).
 */
export const resolveInputModality = (keyCount, touchCount, lastModality) => {
    if (keyCount + touchCount === 0) return null;
    if (keyCount === touchCount) return lastModality;
    return keyCount > touchCount ? 'key' : 'touch';
};

/** Normalizes the submitAntisaccadeResults response for the results screen. */
export const mapFinalScores = (data) => ({
    scoreAccuracy: data.scoreAccuracy ?? null,
    errorRate: data.errorRate ?? null,
    percentile: data.percentile ?? null,
    percentileDisplay: data.percentileDisplay ?? null,
    percentileValid: data.percentileValid === true,
    atChance: data.atChance === true,
    flaggedLowAccuracy: data.flaggedLowAccuracy === true,
});

// --- localStorage helpers for offline resilience ---
const PENDING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const savePendingResults = (userId, payload) => {
    try {
        const key = `${PENDING_PREFIX}${userId}`;
        localStorage.setItem(key, JSON.stringify({ ...payload, savedAt: Date.now() }));
        console.log('[Antisaccade] Saved pending results to localStorage');
    } catch (e) {
        console.warn('[Antisaccade] Failed to save pending results to localStorage:', e);
    }
};

export const getPendingResults = (userId) => {
    try {
        const key = `${PENDING_PREFIX}${userId}`;
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (Date.now() - data.savedAt > PENDING_MAX_AGE_MS) {
            localStorage.removeItem(key);
            return null;
        }
        return data;
    } catch (e) {
        return null;
    }
};

export const clearPendingResults = (userId) => {
    try {
        localStorage.removeItem(`${PENDING_PREFIX}${userId}`);
    } catch (e) { /* ignore */ }
};

// --- Orientation / phone detection (pure web) ---

export const isPhone = () =>
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(max-width: 768px)').matches;

export const isPortrait = () => window.matchMedia('(orientation: portrait)').matches;

/**
 * Subscribes cb to portrait-orientation changes (cb receives a boolean:
 * true = portrait). Returns an unsubscribe function.
 */
export const subscribeOrientation = (cb) => {
    const mql = window.matchMedia('(orientation: portrait)');
    const h = (e) => cb(e.matches);
    mql.addEventListener('change', h);
    return () => mql.removeEventListener('change', h);
};

// --- Alerting beep (Web Audio, best-effort) ---

/**
 * Resumes the shared AudioContext. MUST be called from inside the Start-button
 * user gesture (browsers gate resume() on a gesture). Failure is non-fatal —
 * the assessment is visually self-sufficient.
 */
export const unlockAudio = async () => {
    try {
        await initializeAudio();
    } catch (e) { /* non-fatal: trial proceeds without the beep */ }
};

/**
 * Schedules the TONE_MS alerting beep on the shared singleton AudioContext
 * (never creates a context per beep). The context reference is fetched fresh
 * each call because the Android Bluetooth routing fix can tear down and
 * recreate the singleton at session start. Click-free envelope: 12 ms attack
 * to BEEP_GAIN, hold until TONE_MS - 20, exponential-ish release. Audio
 * failure (blocked, muted, suspended) must NEVER void or block a trial.
 */
export const scheduleBeep = () => {
    try {
        const ctx = audioManager.getAudioContext();
        if (!ctx || ctx.state !== 'running') return; // never block the trial
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = C.BEEP_HZ;
        osc.connect(g).connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(C.BEEP_GAIN, t + C.BEEP_ATTACK_MS / 1000);
        g.gain.setValueAtTime(C.BEEP_GAIN, t + (T.TONE_MS - 20) / 1000);
        g.gain.setTargetAtTime(0.0001, t + (T.TONE_MS - 20) / 1000, C.BEEP_RELEASE_TC);
        osc.onended = () => {
            try { g.disconnect(); osc.disconnect(); } catch (e) { /* ignore */ }
        };
        osc.start(t);
        osc.stop(t + T.TONE_MS / 1000 + 0.05);
    } catch (e) { /* audio is best-effort; visual trial proceeds */ }
};
