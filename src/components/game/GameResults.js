/* File: src/components/game/GameResults.js */
/* Cognitive Lab Aesthetic - Session Analysis Report */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import FeatureIntroMessage from './FeatureIntroMessage';
import { formatCombinedDifficulty, stepCombinedLevel, computeVeryGoodThreshold } from '../../contexts/gameHelpers';
import LevelStepper from './LevelStepper';
import RecallResultsCard from './RecallResultsCard';
import { resolveKeepClimbingLevel } from './keepClimbingLevel';
import { GAME_MODES } from '../../constants/gameConstants';
import { formatDuration, formatTotalDuration, formatTotalDurationAria } from '../dashboard/utils/formatters';
import { useUser } from '../../contexts/UserContext';
import ConfirmationModal from '../ui/ConfirmationModal';
import FatigueWarningModal from '../ui/FatigueWarningModal';
import { useGame } from '../../contexts/GameContext';
import { useFatigueDetection } from '../../contexts/FatigueDetectionContext';
import { useReadinessScore } from '../../hooks/useReadinessScore';
import useReviewPrompt from '../../hooks/useReviewPrompt';
import SequenceTimeline from '../replay/SequenceTimeline';
import { useCohort } from '../../contexts/CohortContext';
import { useColorPreferences } from '../../contexts/ColorPreferencesContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight, faCheck, faPlay, faUsers, faBookOpen, faChartLine, faStickyNote, faClipboardCheck } from '@fortawesome/free-solid-svg-icons';
import { faReddit, faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../../contexts/SettingsContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { trackEvent } from '../../utils/analyticsTracker';
import { canAccessProAssessments } from '../../utils/assessmentAccess';
import { DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS, DYNAMIC_SUB_MODE_ORDER, DAILY_ADAPTIVE_CAP, FREE_TIER_DIFFICULTY_STEPS, FREE_TIER_DIFFICULTY_STEPS_NEW } from '../../constants/gameConstants';
import { useDailyCapStatus } from '../../hooks/useDailyCapStatus';
import { FREE_TRIAL_SESSION_THRESHOLD } from '../../contexts/user/userConstants';
import { getSessionAccuracy } from '../../utils/accuracy';
import ProTrialUpgradeModal from '../ui/ProTrialUpgradeModal';
import DailyCapModal from '../ui/DailyCapModal';
import { useUpgradeModalRollout } from '../../hooks/useUpgradeModalRollout';
import { recordUpgradeModalImpressionFn } from '../../contexts/user/userCloudFunctions';
import { checkReviewEligibility } from '../../utils/reviewPromptHelpers';
import ReminderEmailCard, { isReminderCardCapped } from './ReminderEmailCard';
import { useReminderPreference } from '../../hooks/useReminderPreference';
import PromotionCreditsCard from './PromotionCreditsCard';

const TAB_ORDER = ['overview', 'detailed', 'sequence'];

// Swipe-to-switch-tabs thresholds (mobile tab content area).
const SWIPE_DISTANCE_PX = 50;
const SWIPE_FLICK_DISTANCE_PX = 25;
const SWIPE_FLICK_DT_MS = 300;
const SWIPE_HORIZONTAL_BIAS = 1.5;
// Skip touches that begin near the left edge so iOS Safari's edge-swipe-back still works.
const SWIPE_EDGE_GUARD_PX = 20;

const GameResults = ({
  gameResults,
  getFeatureIntroMessage,
  onDashboard,
  onNavigate,
  resetResponses
}) => {
    // --- Context & State ---
    const {
        userId, subscriptionTier, coachGrantedPremium,
        getCurrentModeProgression, updateProfileProgress, rewardedProSessions, setRewardedProSessions,
        updateSessionNote, isAdaptiveUser, canStartFreeTrial, setShowFreeTrialOffer,
        // Pro-trial upgrade modal (CC-required Stripe trial — chess.com pattern)
        userData,
        showProTrialUpgradeModal, setShowProTrialUpgradeModal,
        proTrialUpgradeModalTrigger, setProTrialUpgradeModalTrigger,
        updateUpgradeModalStateLocally,
        adaptiveGrandfatherExpiry, isInFreeTrial, isInLifetimeTrial,
        // Daily Adaptive cap (limited_modern / classic_legacy cohorts) — pre-start gate
        isFullAdaptive,
        // Manual-mode stepper precision gating (mirrors the Training Intensity editor)
        freeTier, preMonetizationChange,
        showDailyCapModal, setShowDailyCapModal,
        dailyCapInfo, setDailyCapInfo,
    } = useUser();
    const { isUserAllowed: upgradeRolloutAllowed } = useUpgradeModalRollout();
    const navigate = useNavigate();
    const { startGame, goToPreviousNBackLevel, goToNextNBackLevelZero } = useGame();
    const {
        consecutiveSessionCount,
        shouldShowFatigueWarning,
        declineData,
        recordSessionCompletion,
        dismissFatigueWarning,
        handleTakeBreak
    } = useFatigueDetection();

    // Get readiness score from hook (for components/sessionCount)
    const {
        score: hookReadinessScore,
        components: readinessComponents,
        sessionCount: readinessSessionCount,
        isLoading: isLoadingReadiness,
        error: readinessError,
    } = useReadinessScore(gameResults?.gameMode || 'dual');

    // Use score from session response if available (more accurate), otherwise use hook
    const readinessScore = gameResults?.readinessScore ?? hookReadinessScore;

    // Cohort context for post-session update card
    const { activeCohortId, programDay, todaysSessionTarget, todaysSessionsCompleted, isTodayRestDay, unreadChatCount } = useCohort();

    const { settings, updateSetting } = useSettings();
    // Date-aware daily Adaptive cap status (effective count resets at local midnight).
    const { atCap: isDailyCapReached, used: dailyAdaptiveUsedToday } = useDailyCapStatus();
    const { resolvedPalette: currentPalette } = useColorPreferences();
    // Daily-reminder opt-in state (cached once per app load). false → include the
    // reminder promo card in the pool; null (unknown / fetch failed) keeps it out.
    const { reminderEnabled } = useReminderPreference();
    // Cap snapshotted once per results screen so the impression recorded by this
    // very view can't yank the card out of the pool on a later re-render.
    const [reminderCardCapped] = useState(() => isReminderCardCapped());
    const isPro = subscriptionTier === 'premium' || coachGrantedPremium;

    // --- Trigger gifted Pro access offer when session threshold is crossed ---
    // Suppressed for users in the new CC-trial beta cohort (they get ProTrialUpgradeModal instead).
    useEffect(() => {
        if (upgradeRolloutAllowed) return; // beta cohort — gift modal is replaced by ProTrialUpgradeModal
        if (gameResults?.totalSessions >= FREE_TRIAL_SESSION_THRESHOLD && canStartFreeTrial) {
            setShowFreeTrialOffer(true);
        }
    }, [gameResults?.totalSessions, canStartFreeTrial, setShowFreeTrialOffer, upgradeRolloutAllowed]);

    const [activeTab, setActiveTab] = useState('overview');
    const tabSwipeStartRef = useRef(null);

    const goToTabByDelta = useCallback((delta) => {
        setActiveTab((current) => {
            const currentIndex = TAB_ORDER.indexOf(current);
            if (currentIndex === -1) return current;
            const nextIndex = currentIndex + delta;
            if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return current;
            return TAB_ORDER[nextIndex];
        });
    }, []);

    const handleTabContentTouchStart = useCallback((e) => {
        if (e.touches.length !== 1) {
            tabSwipeStartRef.current = null;
            return;
        }
        const touch = e.touches[0];
        // Don't fight iOS Safari edge-swipe-back: ignore touches starting near the left edge.
        if (touch.clientX < SWIPE_EDGE_GUARD_PX) {
            tabSwipeStartRef.current = null;
            return;
        }
        tabSwipeStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            t: performance.now(),
        };
    }, []);

    const handleTabContentTouchEnd = useCallback((e) => {
        const start = tabSwipeStartRef.current;
        tabSwipeStartRef.current = null;
        if (!start) return;
        const end = e.changedTouches[0];
        if (!end) return;
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        const dt = performance.now() - start.t;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);
        const longSwipe = absDx >= SWIPE_DISTANCE_PX;
        const flickSwipe = dt < SWIPE_FLICK_DT_MS && absDx >= SWIPE_FLICK_DISTANCE_PX;
        if (!(longSwipe || flickSwipe)) return;
        if (absDx <= absDy * SWIPE_HORIZONTAL_BIAS) return;
        goToTabByDelta(dx < 0 ? 1 : -1);
    }, [goToTabByDelta]);

    const [isConfirmBackModalOpen, setIsConfirmBackModalOpen] = useState(false);
    const [isRangeModalOpen, setIsRangeModalOpen] = useState(false);
    const [pendingRange, setPendingRange] = useState(null);
    const [overrideSuggestion, setOverrideSuggestion] = useState(null);

    // Note state
    const [noteText, setNoteText] = useState('');
    const [isNoteEditing, setIsNoteEditing] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteSaved, setNoteSaved] = useState(false);
    const [noteError, setNoteError] = useState(null);

    useEffect(() => {
        if (isRangeModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isRangeModalOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isRangeModalOpen && e.key === 'Escape') setIsRangeModalOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isRangeModalOpen]);

    // Track if we've already recorded this session to prevent duplicate recordings
    const lastRecordedSessionIdRef = useRef(null);

    // --- Record session for fatigue detection ---
    useEffect(() => {
        // Only record if we have valid results with a sessionId
        if (gameResults?.sessionId && gameResults.sessionId !== lastRecordedSessionIdRef.current) {
            lastRecordedSessionIdRef.current = gameResults.sessionId;
            recordSessionCompletion({
                nBack: gameResults.nBack,
                difficulty: gameResults.difficulty,
                overallDprime: gameResults.overallDprime,
                gameMode: gameResults.gameMode || 'dual',
            });
            trackEvent('game_complete', {
                game_mode: gameResults.gameMode || 'dual',
                n_back_level: gameResults.nBack,
                difficulty: gameResults.difficulty,
                d_prime: gameResults.overallDprime,
                duration_sec: gameResults.durationMs ? Math.round(gameResults.durationMs / 1000) : undefined,
            });
        }
    }, [gameResults, recordSessionCompletion]);

    // --- Sync rewarded pro sessions counter from game results ---
    useEffect(() => {
        if (gameResults?.rewardedProSessionsRemaining !== undefined) {
            setRewardedProSessions(gameResults.rewardedProSessionsRemaining);
        }
    }, [gameResults, setRewardedProSessions]);

    const {
        nBack: nBackPlayed,
        difficulty: difficultyPlayed,
        newNBack: dAlgoNBack,
        newDifficulty: dAlgoDifficulty,
        replayData = null, sessionId = null, isPlayground = false,
        isPartialResult = false, trialsCompleted = 0, totalTrialsPlanned = 0,
        overallDprime = null, overallAccuracy = null, visualAccuracy = null,
        visualCorrect = null, visualTargetCount = null, visualFalseAlarms = null,
        visualDprime = null, audioAccuracy = null, audioCorrect = null,
        audioTargetCount = null, audioFalseAlarms = null, audioDprime = null,
        // Color metrics (Triple/Quad modes)
        colorAccuracy = null, colorCorrect = null, colorTargetCount = null,
        colorFalseAlarms = null, colorDprime = null,
        // Shape metrics (Quad mode)
        shapeAccuracy = null, shapeCorrect = null, shapeTargetCount = null,
        shapeFalseAlarms = null, shapeDprime = null,
        // Hits-only median response time (ms) per modality — null for Classic/continuous/zero hits
        visualHitRTMedian = null, audioHitRTMedian = null,
        colorHitRTMedian = null, shapeHitRTMedian = null,
        excellentThreshold = null, goodThreshold = null, fairThreshold = null,
        showReport = true,
        durationMs = null,
        gameMode = 'dual',
        sequence: sequenceFromResults = null,
        unsnappedNewDifficulty = null,
        rewardedProSessionsRemaining = 0,
        adjustmentRangeKey = null,
        // Dynamic mode fields
        trainingMode = null,
        newSubMode = null,
        subModeChanged = false,
        // Promotion credits (Sept 2026) — server-provided; absent on Classic and on
        // responses from before the change.
        newPromotionCredits = 0,
        promotionCreditsRequired = null,
        // True when the server skipped the progression write (stale offline replay);
        // the credit fields still ride along but describe a write that never happened.
        progressionSkipped = false,
        // Classic mode fields
        levelChange = null, // 'up' | 'down' | 'stay' (Classic only)
        // Recall Mode fields (singleColorRecall) — { scorable, exact, blanks, wrongPicks, intrusions }
        recall = null,
    } = gameResults || {};

    const isClassicMode = trainingMode === 'classic';
    const classicAutoLevel = settings.classicAutoLevel !== false;
    const isManualClassicMode = isClassicMode && !classicAutoLevel;

    // Manual Adaptive mode (adaptiveAutoLevel off): level frozen server-side; the user
    // picks the next level with the stepper below and Continue persists it.
    const adaptiveAutoLevel = settings.adaptiveAutoLevel !== false;
    const isManualAdaptiveMode = !isClassicMode && !isPlayground && !adaptiveAutoLevel;
    // Stepper precision mirrors the Training Intensity editor gate: only classic_legacy
    // free users step through a snapped grid; everyone else gets full 0.05 precision.
    const stepperFreeTierSteps = (!isFullAdaptive && freeTier !== 'limited_modern')
        ? (preMonetizationChange === true ? FREE_TIER_DIFFICULTY_STEPS : FREE_TIER_DIFFICULTY_STEPS_NEW)
        : null;

    // True-freeze default: seed the editable "to" level at the level just played, so an
    // untouched Continue replays the same level.
    useEffect(() => {
        if (isManualAdaptiveMode && typeof nBackPlayed === 'number') {
            setOverrideSuggestion({ nBack: nBackPlayed, difficulty: difficultyPlayed ?? 0 });
        }
    }, [isManualAdaptiveMode, sessionId, nBackPlayed, difficultyPlayed]);

    const handleStepLevel = useCallback((direction) => {
        setOverrideSuggestion(prev => {
            const base = prev ?? { nBack: nBackPlayed, difficulty: difficultyPlayed ?? 0 };
            return stepCombinedLevel(base.nBack, base.difficulty, direction, stepperFreeTierSteps);
        });
    }, [nBackPlayed, difficultyPlayed, stepperFreeTierSteps]);

    // Determine which modalities are active based on gameMode — derive from
    // GAME_MODES so single-modality modes render only their active card.
    const isTriple = gameMode === 'triple';
    const isQuad = gameMode === 'quad';
    // Recall Mode session: colors are RECALLED, not matched. The binary hit/false-alarm
    // Color block is meaningless here (RecallResultsCard replaces it), and every
    // level-jump affordance below reads/writes the singleColor MATCH track, so they
    // are gated off for recall — the dashboard's Training Intensity editor is the
    // recall-aware way to change a recall level.
    const isRecallMode = gameMode === 'singleColorRecall';
    const modeModalities = GAME_MODES[gameMode]?.modalities || ['visual', 'audio'];
    const hasVisualModality = modeModalities.includes('visual');
    const hasAudioModality = modeModalities.includes('audio');
    const hasColorModality = modeModalities.includes('color');
    const hasShapeModality = modeModalities.includes('shape');
    const activeModalityCount = modeModalities.length;
    const accuracyTextSize = activeModalityCount >= 4 ? 'text-xl' : 'text-2xl';

    // Extract sequence - check gameResults.sequence first (from backend), then replayData paths
    const sequence = sequenceFromResults || replayData?.sequence || replayData?.settings?.generatedSequence || [];

    // --- Recalculate suggestion when progression speed changes ---
    // `ignoreLevelChange` is used by the keep-climbing button below, which needs the
    // counterfactual difficulty precisely BECAUSE the server changed the level.
    const recalculateSuggestion = useCallback((rangeKey, { ignoreLevelChange = false } = {}) => {
        const option = DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS.find(o => o.key === rangeKey);
        if (!option?.range || overallDprime === null || fairThreshold === null || excellentThreshold === null) return null;

        // No alternative when the server promoted (or demoted). The single-session free-tier
        // auto-level-up backstop was removed server-side, so a level change can no longer
        // coincide with `unsnappedNewDifficulty`; the extra null check is inert and kept as-is.
        if (!ignoreLevelChange && dAlgoNBack !== nBackPlayed && unsnappedNewDifficulty == null) return null;

        const { min, max } = option.range;
        let adjustment;
        if (overallDprime < fairThreshold) {
            adjustment = min;
        } else if (overallDprime >= excellentThreshold) {
            adjustment = max;
        } else {
            const range = excellentThreshold - fairThreshold;
            const progress = range > 0 ? (overallDprime - fairThreshold) / range : 0.5;
            adjustment = min + (max - min) * progress;
        }
        adjustment = Math.max(min, Math.min(max, adjustment));

        let newDiff = difficultyPlayed + adjustment;
        newDiff = Math.round(Math.max(0, Math.min(0.99, newDiff)) * 100) / 100;
        return { nBack: nBackPlayed, difficulty: newDiff };
    }, [overallDprime, fairThreshold, excellentThreshold, nBackPlayed, difficultyPlayed, dAlgoNBack, unsnappedNewDifficulty]);

    // --- Derived data & Formatting ---
    const hasValidReplayDataStructure = !!replayData?.settings && Array.isArray(replayData.events) && replayData.startTime !== undefined;
    const canReplay = !!sessionId && hasValidReplayDataStructure;

    const effectiveAlgoNBack = overrideSuggestion?.nBack ?? dAlgoNBack;
    const effectiveAlgoDifficulty = overrideSuggestion?.difficulty ?? dAlgoDifficulty;
    const rawEffectiveSuggestedDisplay = formatCombinedDifficulty(effectiveAlgoNBack, effectiveAlgoDifficulty);

    // Manual-mode stepper rails: stepCombinedLevel returns its input unchanged at the
    // N-back 2..9 clamps, so "can step" = the result differs from the current value.
    const stepDiffers = (stepped) => stepped.nBack !== effectiveAlgoNBack
        || Math.round((stepped.difficulty ?? 0) * 100) !== Math.round((effectiveAlgoDifficulty ?? 0) * 100);
    const canStepDown = isManualAdaptiveMode && typeof effectiveAlgoNBack === 'number'
        && stepDiffers(stepCombinedLevel(effectiveAlgoNBack, effectiveAlgoDifficulty, -1, stepperFreeTierSteps));
    const canStepUp = isManualAdaptiveMode && typeof effectiveAlgoNBack === 'number'
        && stepDiffers(stepCombinedLevel(effectiveAlgoNBack, effectiveAlgoDifficulty, +1, stepperFreeTierSteps));

    // Dynamic mode: prefix with sub-mode name if mode changed.
    // Detect a dynamic session via newSubMode (the backend sets it on every dynamic
    // session, regardless of difficulty engine) — NOT via trainingMode, which carries
    // the engine ('adaptive'/'classic') and is NOT 'dynamic' for adaptive dynamic play.
    const dynamicModeLabels = { dual: 'Dual', triple: 'Triple', quad: 'Quad' };
    const isDynamicSession = !!newSubMode || trainingMode === 'dynamic';
    const effectiveSuggestedDisplay = isDynamicSession && subModeChanged
        ? `${dynamicModeLabels[newSubMode] || ''} ${rawEffectiveSuggestedDisplay}`
        : rawEffectiveSuggestedDisplay;

    // Show "very good at Jaeggi speed: k of 3" while credits are banked and the session did
    // not promote. Hidden in manual Adaptive mode (the server computes but never persists
    // credits there), Classic, playground, recall, and when the response predates the rule.
    const showPromotionCredits = !isClassicMode && !isPlayground && !isManualAdaptiveMode && !isRecallMode
        && !progressionSkipped
        && typeof promotionCreditsRequired === 'number'
        && typeof newPromotionCredits === 'number' && newPromotionCredits > 0
        && typeof nBackPlayed === 'number'
        && dAlgoNBack === nBackPlayed;
    // Where the promotion leads. Dynamic training advances by cycling the sub-mode at the
    // same N (Dual → Triple → Quad), only reaching N+1 when wrapping from Quad — mirror
    // nextMajorLevelButtonConfig so the card never promises the wrong destination.
    const promotionDestinationLabel = useMemo(() => {
        if (!isDynamicSession) return `${nBackPlayed + 1}-back`;
        const modeLabels = { dual: 'Dual', triple: 'Triple', quad: 'Quad' };
        const idx = DYNAMIC_SUB_MODE_ORDER.indexOf(gameMode);
        if (idx >= 0 && idx < DYNAMIC_SUB_MODE_ORDER.length - 1) {
            return `${modeLabels[DYNAMIC_SUB_MODE_ORDER[idx + 1]]} ${nBackPlayed}.00`;
        }
        return `Dual ${nBackPlayed + 1}.00`;
    }, [isDynamicSession, gameMode, nBackPlayed]);

    const acceleratedSuggestion = useMemo(() => recalculateSuggestion('accelerated'), [recalculateSuggestion]);

    const activeRangeKey = settings.difficultyAdjustmentRange || adjustmentRangeKey || 'standard';

    // --- Keep-climbing counterfactual (early-promotion opt-out) ---
    // When the algorithm promotes N off difficulty >= 0.50, this is the level the servo
    // WOULD have produced had it not promoted — i.e. "stay at this N and keep building
    // toward 0.99". Null whenever that offer is meaningless, which also suppresses the
    // secondary button entirely.
    const keepClimbingSuggestion = useMemo(() => {
        // Mode guards live here; the level arithmetic is in resolveKeepClimbingLevel so
        // its branch table can be unit-tested (keepClimbingLevel.rtl.test.js).
        // Dynamic advances by cycling sub-mode (D->T->Q), not by N — "keep climbing this
        // level" has no meaning there.
        if (isClassicMode || isPlayground || isManualAdaptiveMode || isDynamicSession) return null;
        return resolveKeepClimbingLevel({
            nBackPlayed,
            difficultyPlayed,
            promotedNBack: dAlgoNBack,
            freeTierSteps: stepperFreeTierSteps,
            servoSuggestion: recalculateSuggestion(activeRangeKey, { ignoreLevelChange: true }),
        });
    }, [
        isClassicMode, isPlayground, isManualAdaptiveMode, isDynamicSession,
        nBackPlayed, difficultyPlayed, dAlgoNBack, stepperFreeTierSteps,
        recalculateSuggestion, activeRangeKey,
    ]);

    const introMessage = typeof getFeatureIntroMessage === 'function' ? getFeatureIntroMessage(dAlgoDifficulty) : null;
    const rawPlayedDisplay = formatCombinedDifficulty(nBackPlayed, difficultyPlayed);
    const dAlgoSuggestedDisplay = formatCombinedDifficulty(dAlgoNBack, dAlgoDifficulty);

    // Mode-aware display helpers
    const modeShortLabels = { dual: 'D', triple: 'T', quad: 'Q' };
    const modeFullLabels = { dual: 'Dual', triple: 'Triple', quad: 'Quad' };
    const playedModeLabel = isDynamicSession ? (modeFullLabels[gameMode] || 'Dual') : '';
    const playedCombinedDisplay = isDynamicSession && subModeChanged ? `${playedModeLabel} ${rawPlayedDisplay}` : rawPlayedDisplay;
    const suggestedShortDisplay = isClassicMode
        ? `N=${dAlgoNBack || nBackPlayed}`
        : isDynamicSession && subModeChanged
            ? `${modeShortLabels[newSubMode] || ''}${rawEffectiveSuggestedDisplay}`
            : rawEffectiveSuggestedDisplay;

    const formatNum = (num, decimals = 2) => ((typeof num === 'number' && Number.isFinite(num)) ? num.toFixed(decimals) : '—');
    const formatAcc = (num) => formatNum(num, 1);

    // --- Performance Assessment ---
    let veryGoodT = null;
    const thresholdsValid = excellentThreshold !== null && goodThreshold !== null && fairThreshold !== null;
    if (thresholdsValid) {
        // Shared with progressionLogic RULE 1 clause A and free-tier snapping.
        veryGoodT = computeVeryGoodThreshold({ goodThreshold, excellentThreshold });
    }

    const getPerformanceCategory = (dprime, excellentT, goodT, fairT, calculatedVeryGoodT) => {
        const useDynamicThresholds = excellentT !== null && goodT !== null && fairT !== null && calculatedVeryGoodT !== null;
        if (dprime === null || typeof dprime !== 'number') return 'unknown';
        if (useDynamicThresholds) {
            if (dprime >= excellentT) return 'excellent';
            if (dprime >= calculatedVeryGoodT) return 'very-good';
            if (dprime >= goodT) return 'good';
            if (dprime >= fairT) return 'fair';
            return 'needs-improvement';
        } else {
            if (dprime >= 2.0) return 'good';
            if (dprime >= 1.0) return 'fair';
            return 'needs-improvement';
        }
    };

    // Classic mode: accuracy-based category (match-only accuracy, chance ~50%)
    const getClassicPerformanceCategory = (accuracy) => {
        if (accuracy === null || typeof accuracy !== 'number') return 'unknown';
        if (accuracy >= 90) return 'excellent';
        if (accuracy >= 80) return 'very-good';
        if (accuracy >= 70) return 'good';
        if (accuracy >= 60) return 'fair';
        return 'needs-improvement';
    };

    // Display accuracy: always pooled Jaeggi, recomputed from primary fields in
    // gameResults. Handles both Classic (backend already pooled Jaeggi = same value)
    // and Adaptive (backend stored match-only; frontend displays Jaeggi). d-prime
    // still drives Adaptive progression and performance category — accuracy is display only.
    const displayAcc = useMemo(() => getSessionAccuracy({
        gameMode,
        nBack: nBackPlayed,
        sessionNBack: nBackPlayed,
        totalTrials: gameResults?.totalTrials,
        visualCorrect, visualFalseAlarms, visualTargetCount,
        audioCorrect, audioFalseAlarms, audioTargetCount,
        colorCorrect, colorFalseAlarms, colorTargetCount,
        shapeCorrect, shapeFalseAlarms, shapeTargetCount,
    }, { gameMode }), [
        gameMode, nBackPlayed, gameResults?.totalTrials,
        visualCorrect, visualFalseAlarms, visualTargetCount,
        audioCorrect, audioFalseAlarms, audioTargetCount,
        colorCorrect, colorFalseAlarms, colorTargetCount,
        shapeCorrect, shapeFalseAlarms, shapeTargetCount,
    ]);

    const performanceCategory = isClassicMode
        ? getClassicPerformanceCategory(displayAcc.overall)
        : getPerformanceCategory(overallDprime, excellentThreshold, goodThreshold, fairThreshold, veryGoodT);

    useReviewPrompt({
        levelChange, newNBack: dAlgoNBack, nBackPlayed,
        isNewHighestNBackGood: gameResults?.isNewHighestNBackGood,
        performanceCategory, totalSessions: gameResults?.totalSessions,
        sessionId,
    });

    const getPerformanceDisplay = (category) => {
        switch(category) {
            case 'excellent': return { text: 'Excellent', color: 'neural-dendrite', bgClass: 'bg-neural-dendrite/10', borderClass: 'border-neural-dendrite/50', textClass: 'text-theme-neural-green' };
            case 'very-good': return { text: 'Very Good', color: 'neural-pulse', bgClass: 'bg-neural-pulse/10', borderClass: 'border-neural-pulse/50', textClass: 'text-theme-neural-blue' };
            case 'good': return { text: 'Good', color: 'neural-pulse', bgClass: 'bg-neural-pulse/10', borderClass: 'border-neural-pulse/50', textClass: 'text-theme-neural-blue' };
            case 'fair': return { text: isClassicMode ? 'Developing' : 'Fair', color: 'amber-accent', bgClass: 'bg-theme-accent/10', borderClass: 'border-theme-accent/50', textClass: 'text-theme-accent' };
            case 'needs-improvement': return isClassicMode
                ? { text: 'Keep Practicing', color: 'neural-synapse', bgClass: 'bg-neural-synapse/10', borderClass: 'border-neural-synapse/50', textClass: 'text-theme-neural-red' }
                : { text: 'Needs Work', color: 'neural-synapse', bgClass: 'bg-neural-synapse/10', borderClass: 'border-neural-synapse/50', textClass: 'text-theme-neural-red' };
            default: return { text: 'Unknown', color: 'theme-text-muted', bgClass: 'bg-theme-bg-elevated', borderClass: 'border-theme-line', textClass: 'text-theme-text-muted' };
        }
    };
    const performanceDisplay = getPerformanceDisplay(performanceCategory);

    // Calculate gauge percentage for d-prime visualization (0-4 scale mapped to 0-100%)
    const dprimeGaugePercent = overallDprime !== null ? Math.min(100, Math.max(0, (overallDprime / 4) * 100)) : 0;

    // --- Button Handlers ---
    const handleRetryCurrentAttempt = useCallback(() => {
        if (maybeBlockOnDailyCap(trainingMode)) return;
        if (resetResponses) resetResponses();
        const opts = { overrideNBack: nBackPlayed, overrideDifficulty: difficultyPlayed, skipCountdown: true };
        if (isDynamicSession && gameMode) opts.overrideGameMode = gameMode;
        if (trainingMode) opts.trainingMode = trainingMode;
        startGame(opts);
    }, [resetResponses, startGame, nBackPlayed, difficultyPlayed, isDynamicSession, gameMode, trainingMode, maybeBlockOnDailyCap]);

    // --- Pro-trial upgrade modal interception (game-1 + recurring re-show) ---
    // When user clicks Continue, intercept and show the upgrade modal if conditions met.
    // On modal dismiss (Maybe Later / X / backdrop / escape), continue to next game.
    // On modal accept, the modal navigates to Stripe Checkout — no continue.
    const pendingContinueActionRef = useRef(null);

    const maybeInterceptWithUpgradeModal = useCallback((continueAction) => {
        const grandfathered = adaptiveGrandfatherExpiry && new Date(adaptiveGrandfatherExpiry) > new Date();

        const baselineEligible =
            subscriptionTier === 'free' &&
            !coachGrantedPremium &&
            !grandfathered &&
            !isInFreeTrial &&
            !isInLifetimeTrial &&
            (gameResults?.trialsCompleted ?? 0) >= 10 &&
            upgradeRolloutAllowed;

        if (!baselineEligible) return false;

        const fire = (trigger) => {
            pendingContinueActionRef.current = continueAction;
            setProTrialUpgradeModalTrigger(trigger);
            setShowProTrialUpgradeModal(true);
            if (recordUpgradeModalImpressionFn) {
                recordUpgradeModalImpressionFn({ trigger }).catch(err => {
                    console.warn('[GameResults] recordUpgradeModalImpression failed:', err?.message);
                });
            }
            if (updateUpgradeModalStateLocally) {
                const localUpdates = {
                    upgradeModalLastShownAt: new Date().toISOString(),
                    upgradeModalLastTrigger: trigger,
                };
                if (trigger === 'game_1') localUpdates.upgradeModalGameOneShown = true;
                updateUpgradeModalStateLocally(localUpdates);
            }
            return true;
        };

        // --- Game-1 onboarding interrupt (one-time, highest priority) ---
        if ((gameResults?.totalSessions ?? 0) === 1 && !userData?.upgradeModalGameOneShown) {
            return fire('game_1');
        }

        // --- Recurring re-show (totalSessions > 1, cooldown + perf gate + review yield) ---
        if ((gameResults?.totalSessions ?? 0) > 1) {
            // Suppression check
            const suppressed = userData?.upgradeModalSuppressedUntil &&
                new Date(userData.upgradeModalSuppressedUntil) > new Date();
            if (suppressed) return false;

            // 7-day cooldown check
            const lastShown = userData?.upgradeModalLastShownAt
                ? new Date(userData.upgradeModalLastShownAt) : null;
            const cooldownElapsed = !lastShown ||
                (Date.now() - lastShown.getTime()) >= 7 * 24 * 60 * 60 * 1000;
            if (!cooldownElapsed) return false;

            // Performance trigger (Very Good+, level-up, or personal best)
            const perfTriggered =
                performanceCategory === 'excellent' ||
                performanceCategory === 'very-good' ||
                gameResults?.isNewHighestNBackGood === true ||
                levelChange === 'up' ||
                (dAlgoNBack > nBackPlayed);
            if (!perfTriggered) return false;

            // Yield to review prompt (defensive — web disabled but native could enable)
            const reviewEligibility = checkReviewEligibility(
                { levelChange, newNBack: dAlgoNBack, nBackPlayed, isNewHighestNBackGood: gameResults?.isNewHighestNBackGood, performanceCategory },
                gameResults?.totalSessions ?? 0
            );
            if (reviewEligibility.eligible) return false;

            return fire('recurring');
        }

        return false;
    }, [
        gameResults?.totalSessions, gameResults?.trialsCompleted, gameResults?.isNewHighestNBackGood,
        subscriptionTier, coachGrantedPremium, adaptiveGrandfatherExpiry,
        isInFreeTrial, isInLifetimeTrial,
        upgradeRolloutAllowed,
        userData?.upgradeModalGameOneShown, userData?.upgradeModalLastShownAt, userData?.upgradeModalSuppressedUntil,
        performanceCategory, levelChange, dAlgoNBack, nBackPlayed,
        setProTrialUpgradeModalTrigger, setShowProTrialUpgradeModal, updateUpgradeModalStateLocally,
    ]);

    const handleProTrialModalClose = useCallback(() => {
        setShowProTrialUpgradeModal(false);
        setProTrialUpgradeModalTrigger(null);
        // If a continue action was deferred while the modal was shown, run it now.
        if (pendingContinueActionRef.current) {
            const cb = pendingContinueActionRef.current;
            pendingContinueActionRef.current = null;
            cb();
        }
    }, [setShowProTrialUpgradeModal, setProTrialUpgradeModalTrigger]);

    // Mirrors ProfileDashboard.js:636-649. Backend is the source of truth
    // (functions/game.js:1447,1783), but gating client-side prevents a non-Pro
    // user at cap from launching a session that will fail to save.
    // trainingMode === 'classic' bypasses (Classic is uncapped); adaptive +
    // dynamic are both gated.
    const maybeBlockOnDailyCap = useCallback((nextTrainingMode) => {
        if (nextTrainingMode === 'classic') return false;
        if (isFullAdaptive) return false;
        if (!isDailyCapReached) return false;

        if (typeof setDailyCapInfo === 'function') {
            setDailyCapInfo({
                sessionsUsed: dailyAdaptiveUsedToday,
                dailyCap: DAILY_ADAPTIVE_CAP,
                source: 'pre_start',
            });
        }
        if (typeof setShowDailyCapModal === 'function') {
            setShowDailyCapModal(true);
        }
        trackEvent('daily_cap_pre_start_blocked', {
            sessionsUsed: dailyAdaptiveUsedToday,
            source: 'results_continue',
        });
        return true;
    }, [isFullAdaptive, isDailyCapReached, dailyAdaptiveUsedToday, setDailyCapInfo, setShowDailyCapModal]);

    const handleContinueAlgorithmNext = useCallback(() => {
        if (maybeBlockOnDailyCap(trainingMode)) return;
        const continueAction = async () => {
            if (resetResponses) resetResponses();
            if (isManualAdaptiveMode) {
                // Manual mode: the backend froze progression, so persist the user's chosen
                // level here (mirrors the Progression Speed modal's payload — no gameMode
                // in Dynamic so it routes to modeProgression.dynamic).
                try {
                    await updateProfileProgress(null, {
                        currentNBack: effectiveAlgoNBack,
                        currentDifficulty: effectiveAlgoDifficulty,
                        ...(!isDynamicSession && { gameMode: gameMode }),
                        trainingMode: 'adaptive',
                    });
                } catch (err) {
                    console.error('[GameResults] Failed to persist manual level choice:', err);
                }
            }
            const opts = { overrideNBack: effectiveAlgoNBack, overrideDifficulty: effectiveAlgoDifficulty, skipCountdown: true };
            if (isDynamicSession && newSubMode) opts.overrideGameMode = newSubMode;
            if (trainingMode) opts.trainingMode = trainingMode;
            startGame(opts);
        };
        if (maybeInterceptWithUpgradeModal(continueAction)) return;
        continueAction();
    }, [resetResponses, startGame, effectiveAlgoNBack, effectiveAlgoDifficulty, isDynamicSession, newSubMode, trainingMode, maybeInterceptWithUpgradeModal, maybeBlockOnDailyCap, isManualAdaptiveMode, updateProfileProgress, gameMode]);

    // --- Enter key listener for quick continue ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip while typing (e.g. the session note textarea)
            const t = e.target;
            if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
            // Only trigger if Enter is pressed and no modal is open
            if (e.key === 'Enter' && !isConfirmBackModalOpen && !shouldShowFatigueWarning && !showProTrialUpgradeModal && !isRangeModalOpen) {
                e.preventDefault();
                if (isManualClassicMode) {
                    handleManualContinueSameLevel();
                } else {
                    handleContinueAlgorithmNext();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleContinueAlgorithmNext, handleManualContinueSameLevel, isManualClassicMode, isConfirmBackModalOpen, shouldShowFatigueWarning, showProTrialUpgradeModal, isRangeModalOpen]);

    // Arrow key navigation for tabs (desktop only)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isConfirmBackModalOpen || shouldShowFatigueWarning) return;
            // Skip while typing (e.g. the session note textarea)
            const t = e.target;
            if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
            const currentIndex = TAB_ORDER.indexOf(activeTab);
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                e.preventDefault();
                goToTabByDelta(-1);
            } else if (e.key === 'ArrowRight' && currentIndex < TAB_ORDER.length - 1) {
                e.preventDefault();
                goToTabByDelta(1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeTab, isConfirmBackModalOpen, shouldShowFatigueWarning, goToTabByDelta]);

    // Recall guards: goToPreviousNBackLevel resolves and writes the ACTIVE mode's track
    // (singleColor for a recall session), so this path must never run under recall.
    const openGoBackConfirmation = useCallback(() => {
        if (isRecallMode) return;
        setIsConfirmBackModalOpen(true);
    }, [isRecallMode]);

    const confirmGoBackAndStart = useCallback(() => {
        if (isRecallMode) return;
        if (resetResponses) resetResponses();
        goToPreviousNBackLevel();
        setIsConfirmBackModalOpen(false);
    }, [isRecallMode, resetResponses, goToPreviousNBackLevel]);

    const cancelGoBack = useCallback(() => {
        setIsConfirmBackModalOpen(false);
    }, []);

    const handleGoToNextMajorLevel = useCallback(() => {
        if (maybeBlockOnDailyCap(trainingMode)) return;
        if (resetResponses) resetResponses();
        goToNextNBackLevelZero(nBackPlayed, difficultyPlayed, trainingMode);
    }, [resetResponses, goToNextNBackLevelZero, nBackPlayed, difficultyPlayed, trainingMode, maybeBlockOnDailyCap]);

    // Decline the early promotion: stay at the level just played and keep building
    // difficulty toward 0.99. The backend has ALREADY persisted the promotion
    // (N+1 at 0.00), so this must write the chosen level back — otherwise the choice
    // survives only until the next app load.
    const handleKeepClimbing = useCallback(() => {
        if (!keepClimbingSuggestion) return;
        if (maybeBlockOnDailyCap(trainingMode)) return;
        const { nBack: targetNBack, difficulty: targetDifficulty } = keepClimbingSuggestion;
        const continueAction = async () => {
            if (resetResponses) resetResponses();
            try {
                await updateProfileProgress(userId, {
                    currentNBack: targetNBack,
                    currentDifficulty: targetDifficulty,
                    consecutiveSuccesses: 0,
                    gameMode: gameMode,
                    trainingMode: 'adaptive',
                });
            } catch (err) {
                console.error('[GameResults] Failed to persist keep-climbing level choice:', err);
            }
            startGame({
                overrideNBack: targetNBack,
                overrideDifficulty: targetDifficulty,
                skipCountdown: true,
                ...(trainingMode && { trainingMode }),
            });
        };
        if (maybeInterceptWithUpgradeModal(continueAction)) return;
        continueAction();
    }, [
        keepClimbingSuggestion, maybeBlockOnDailyCap, trainingMode, resetResponses,
        updateProfileProgress, userId, gameMode, startGame, maybeInterceptWithUpgradeModal,
    ]);

    // --- Manual Classic Mode Handlers (auto-level OFF) ---
    const handleManualContinueSameLevel = useCallback(() => {
        const continueAction = () => {
            if (resetResponses) resetResponses();
            startGame({ overrideNBack: nBackPlayed, overrideDifficulty: difficultyPlayed, trainingMode: 'classic', skipCountdown: true });
        };
        if (maybeInterceptWithUpgradeModal(continueAction)) return;
        continueAction();
    }, [resetResponses, startGame, nBackPlayed, difficultyPlayed, maybeInterceptWithUpgradeModal]);

    const handleManualLevelUp = useCallback(async () => {
        if (resetResponses) resetResponses();
        const targetNBack = nBackPlayed + 1;
        await updateProfileProgress(userId, {
            currentNBack: targetNBack,
            currentDifficulty: 0.50,
            trainingMode: 'classic',
        });
        startGame({ overrideNBack: targetNBack, overrideDifficulty: 0.50, trainingMode: 'classic', skipCountdown: true });
    }, [resetResponses, startGame, nBackPlayed, updateProfileProgress, userId]);

    const handleManualLevelDown = useCallback(async () => {
        if (resetResponses) resetResponses();
        const targetNBack = Math.max(1, nBackPlayed - 1);
        await updateProfileProgress(userId, {
            currentNBack: targetNBack,
            currentDifficulty: 0.50,
            trainingMode: 'classic',
        });
        startGame({ overrideNBack: targetNBack, overrideDifficulty: 0.50, trainingMode: 'classic', skipCountdown: true });
    }, [resetResponses, startGame, nBackPlayed, updateProfileProgress, userId]);

    // --- Fatigue Warning Handlers ---
    const handleFatigueContinue = useCallback(() => {
        dismissFatigueWarning();
    }, [dismissFatigueWarning]);

    const handleFatigueTakeBreak = useCallback(() => {
        handleTakeBreak();
        onDashboard();
    }, [handleTakeBreak, onDashboard]);

    // --- Button Definitions ---
    const continueButtonConfig = useMemo(() => {
        const isAdvance = subModeChanged || effectiveAlgoNBack > nBackPlayed;
        return {
            text: isAdvance
                ? `Advance to ${suggestedShortDisplay}`
                : `Continue at ${suggestedShortDisplay}`,
            action: handleContinueAlgorithmNext,
            title: isAdvance
                ? `Advance to ${isClassicMode ? `N=${effectiveAlgoNBack}` : effectiveSuggestedDisplay}`
                : `Continue at ${isClassicMode ? `N=${effectiveAlgoNBack}` : effectiveSuggestedDisplay}`,
            style: "primary",
            kbdHint: "Enter ↵"
        };
    }, [effectiveSuggestedDisplay, suggestedShortDisplay, handleContinueAlgorithmNext, subModeChanged, effectiveAlgoNBack, nBackPlayed, isClassicMode]);

    // Retry text: Classic uses "N-Back X", Dynamic shows full mode name on sub-mode change
    const retryDisplay = isClassicMode ? `N=${nBackPlayed}`
        : isDynamicSession && subModeChanged ? playedCombinedDisplay : rawPlayedDisplay;
    const retryButtonConfig = useMemo(() => ({
        text: `Retry ${retryDisplay}`,
        action: handleRetryCurrentAttempt,
        title: `Retry level ${retryDisplay}`,
        style: "secondary",
        kbdHint: "R"
    }), [retryDisplay, handleRetryCurrentAttempt]);

    const getPrevNBackStoredLevelDisplay = useCallback(() => {
        // Recall: getCurrentModeProgression() returns the singleColor MATCH track, so the
        // label would advertise a level from the wrong track. No label, no button.
        if (isRecallMode) return null;
        if (!userId || !nBackPlayed || nBackPlayed <= 1) return null;
        const prevN = nBackPlayed - 1;
        const modeProgression = getCurrentModeProgression();
        const prevDiffStored = modeProgression?.previousNBackLevelDifficulties?.[prevN];
        const prevDiffHundredths = prevDiffStored !== undefined ? Math.round(prevDiffStored * 100) : 0;
        const prevDiffDisplayStr = prevDiffHundredths.toString().padStart(2, '0');
        return `${prevN}.${prevDiffDisplayStr}`;
    }, [isRecallMode, userId, nBackPlayed, getCurrentModeProgression]);

    const prevNBackStoredLevelDisplay = getPrevNBackStoredLevelDisplay();

    const backToPreviousStoredButtonConfig = useMemo(() => {
        // Recall: the button itself writes nothing — its ACTION opens the go-back confirmation
        // modal, and confirming runs goToPreviousNBackLevel(), which resolves and writes the
        // ACTIVE mode's track (singleColor, no recall mode key). Hidden so that path stays
        // unreachable under recall (openGoBackConfirmation/confirmGoBackAndStart also no-op).
        if (isRecallMode) return null;
        const difficultyPlayedHundredths = Math.round((difficultyPlayed || 0) * 100);
        const isLowDifficultyRange = difficultyPlayedHundredths >= 0 && difficultyPlayedHundredths <= 19;
        const canGoBack = (nBackPlayed || 0) > 1;

        if (isLowDifficultyRange && canGoBack && !!prevNBackStoredLevelDisplay) {
            return {
                text: `Back to ${prevNBackStoredLevelDisplay}`,
                action: openGoBackConfirmation,
                title: `Go back to your previously stored level ${prevNBackStoredLevelDisplay}`,
                style: "secondary"
            };
        }
        return null;
    }, [isRecallMode, difficultyPlayed, nBackPlayed, prevNBackStoredLevelDisplay, openGoBackConfirmation]);

    // Shown INSTEAD of nextMajorLevelButtonConfig when the algorithm just promoted off
    // difficulty >= 0.50. Without it those two would render identical "Advance to N+1.00"
    // text side by side, since nextMajorLevelButtonConfig also fires at >= 0.50.
    const keepClimbingButtonConfig = useMemo(() => {
        if (!keepClimbingSuggestion) return null;
        const label = formatCombinedDifficulty(keepClimbingSuggestion.nBack, keepClimbingSuggestion.difficulty);
        return {
            text: `Continue at ${label}`,
            action: handleKeepClimbing,
            title: `Stay at ${keepClimbingSuggestion.nBack}-back and keep building difficulty (${label})`,
            style: "secondary"
        };
    }, [keepClimbingSuggestion, handleKeepClimbing]);

    const nextMajorLevelButtonConfig = useMemo(() => {
        if (isRecallMode) return null; // writes the singleColor Match track — see isRecallMode
        const difficultyPlayedHundredths = Math.round((difficultyPlayed || 0) * 100);
        const maxNBack = 20;
        if (difficultyPlayedHundredths >= 50 && nBackPlayed < maxNBack && !subModeChanged) {
            // Dynamic mode: advance to next sub-mode instead of next N-back
            if (isDynamicSession) {
                const currentSubModeIndex = DYNAMIC_SUB_MODE_ORDER.indexOf(gameMode);
                const modeLabels = { dual: 'Dual', triple: 'Triple', quad: 'Quad' };
                if (currentSubModeIndex >= 0 && currentSubModeIndex < DYNAMIC_SUB_MODE_ORDER.length - 1) {
                    // Advance to next sub-mode at same N
                    const nextMode = DYNAMIC_SUB_MODE_ORDER[currentSubModeIndex + 1];
                    return {
                        text: `Advance to ${modeLabels[nextMode]} ${nBackPlayed}.00`,
                        action: handleGoToNextMajorLevel,
                        title: `Advance to ${modeLabels[nextMode]} N-Back at ${nBackPlayed}.00`,
                        style: "secondary"
                    };
                } else {
                    // At Quad: advance to Dual (N+1)
                    const nextN = nBackPlayed + 1;
                    return {
                        text: `Advance to Dual ${nextN}.00`,
                        action: handleGoToNextMajorLevel,
                        title: `Advance to Dual ${nextN}-Back at ${nextN}.00`,
                        style: "secondary"
                    };
                }
            }
            // Standard mode: advance to next N-back
            const nextN = nBackPlayed + 1;
            return {
                text: isClassicMode ? `Advance to N=${nextN}` : `Advance to ${nextN}.00`,
                action: handleGoToNextMajorLevel,
                title: isClassicMode ? `Advance to N-Back ${nextN}` : `Advance to ${nextN}-Back at level ${nextN}.00`,
                style: "secondary"
            };
        }
        return null;
    }, [isRecallMode, difficultyPlayed, nBackPlayed, handleGoToNextMajorLevel, isDynamicSession, gameMode, isClassicMode]);

    // Hide retry when algorithm suggests the same level played (they'd be identical buttons)
    const isSameLevel = effectiveAlgoNBack === nBackPlayed &&
        Math.round((effectiveAlgoDifficulty || 0) * 100) === Math.round((difficultyPlayed || 0) * 100);

    // --- Rewarded Video Ad (free users, native only) ---
    const hasProSuggestion = unsnappedNewDifficulty != null
        && !subModeChanged // No precision upsell when changing sub-modes (same as standard promotions)
        && dAlgoNBack === nBackPlayed
        && Math.round(unsnappedNewDifficulty * 100) !== Math.round((dAlgoDifficulty || 0) * 100);

    // Show Pro upsell only when there's a compelling progression comparison to display
    const hasProgressionComparison = acceleratedSuggestion != null
        && dAlgoNBack != null
        && !subModeChanged
        && Math.round(acceleratedSuggestion.difficulty * 100) !== Math.round((dAlgoDifficulty || 0) * 100);

    const unsnappedDisplay = hasProSuggestion
        ? formatCombinedDifficulty(nBackPlayed, unsnappedNewDifficulty)
        : null;

    // --- Manual Classic Mode Button Configs ---
    const manualContinueButtonConfig = useMemo(() => ({
        text: `Continue at N=${nBackPlayed}`,
        action: handleManualContinueSameLevel,
        title: `Continue playing at N=${nBackPlayed}`,
        style: "primary",
        kbdHint: "Enter ↵"
    }), [nBackPlayed, handleManualContinueSameLevel]);

    const manualLevelUpButtonConfig = useMemo(() => {
        // Recall: handleManualLevelUp calls updateProfileProgress with trainingMode 'classic'
        // and NO gameMode key, so the write lands on classicProgression.singleColor — the Match
        // track — clobbering it with a recall level. Hidden under recall.
        if (isRecallMode) return null;
        if (nBackPlayed >= 20) return null;
        return {
            text: `N = ${nBackPlayed + 1}`,
            action: handleManualLevelUp,
            title: `Go up to N-Back ${nBackPlayed + 1}`,
            style: "secondary"
        };
    }, [isRecallMode, nBackPlayed, handleManualLevelUp]);

    const manualLevelDownButtonConfig = useMemo(() => {
        // Recall: same as manualLevelUpButtonConfig — handleManualLevelDown writes
        // classicProgression.singleColor (trainingMode 'classic', no gameMode key). Hidden.
        if (isRecallMode) return null;
        if (nBackPlayed <= 1) return null;
        return {
            text: `N = ${nBackPlayed - 1}`,
            action: handleManualLevelDown,
            title: `Go down to N-Back ${nBackPlayed - 1}`,
            style: "secondary"
        };
    }, [isRecallMode, nBackPlayed, handleManualLevelDown]);

    // Button layout: context-aware to keep max 3 buttons
    let actionButtons;
    if (isManualClassicMode) {
        // Manual Classic: Continue (primary), optional N-1 and N+1
        actionButtons = [
            manualContinueButtonConfig,
            manualLevelDownButtonConfig,
            manualLevelUpButtonConfig,
        ].filter(Boolean);
    } else {
        // Auto-level Classic and all Adaptive modes.
        // Order matters — these are mutually exclusive by design:
        //   keepClimbing  : the algorithm promoted off >= 0.50, offer to stay and climb
        //   nextMajorLevel: no promotion but >= 0.50, offer to skip ahead voluntarily
        //   backToPrevious: at <= 0.19, offer the stored level at N-1 (over-promotion escape)
        const secondaryButton = isClassicMode
            ? null
            : (keepClimbingButtonConfig || nextMajorLevelButtonConfig || backToPreviousStoredButtonConfig);
        const showRetry = !isSameLevel;
        actionButtons = showRetry
            ? [
                continueButtonConfig,
                secondaryButton,
                retryButtonConfig,
              ].filter(Boolean)
            : [
                continueButtonConfig,
                secondaryButton,
              ].filter(Boolean);
    }

    // --- R key listener for quick retry (desktop) ---
    const isRetryButtonShown = actionButtons.includes(retryButtonConfig);
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key !== 'r' && e.key !== 'R') return;
            if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return; // never hijack Ctrl/Cmd+R
            // Skip while typing (e.g. the session note textarea)
            const t = e.target;
            if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
            if (isConfirmBackModalOpen || shouldShowFatigueWarning || showProTrialUpgradeModal || isRangeModalOpen) return;
            if (!isRetryButtonShown) return;
            e.preventDefault();
            handleRetryCurrentAttempt();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRetryButtonShown, handleRetryCurrentAttempt, isConfirmBackModalOpen, shouldShowFatigueWarning, showProTrialUpgradeModal, isRangeModalOpen]);

    // --- Event Handlers ---
    const handleReplay = useCallback(() => {
        if (!canReplay || typeof onNavigate !== 'function' || !sessionId) return;
        onNavigate(`/replay/${sessionId}`, { state: { from: 'results' } });
    }, [onNavigate, canReplay, sessionId]);

    const handleTabChange = (tab) => setActiveTab(tab);

    const handleSaveNote = useCallback(async () => {
        if (!sessionId || noteSaving) return;
        const trimmed = noteText.trim();
        if (trimmed.length > 500) {
            setNoteError('Note is too long (max 500 characters).');
            return;
        }
        setNoteSaving(true);
        setNoteError(null);
        const result = await updateSessionNote(sessionId, trimmed);
        setNoteSaving(false);
        if (result.success) {
            setNoteSaved(true);
            setIsNoteEditing(false);
            if (trimmed === '') {
                setNoteText('');
                setNoteSaved(false);
            }
        } else {
            setNoteError(result.error || 'Failed to save note.');
        }
    }, [sessionId, noteText, noteSaving, updateSessionNote]);

    // --- Render Logic ---
    if (showReport === false && !isPlayground) {
        return null;
    }
    if (!gameResults) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="text-theme-neural-red font-mono text-sm uppercase tracking-wider">
                    Error: Analysis data unavailable
                </div>
            </div>
        );
    }

    const trackCardClick = (linkName) => trackEvent('results_card_click', { link_name: linkName });

    const communityCard = (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                <FontAwesomeIcon icon={faUsers} className="w-3 h-3 text-theme-text-secondary mr-1.5" />
                Dual N-Back Community
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-secondary mb-3">
                Get tips, discuss strategies, and connect with other dual n-back players.
            </p>
            <div className="flex flex-wrap gap-2">
                <a
                    href="https://www.reddit.com/r/DualnBack/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackCardClick('reddit')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
                >
                    <FontAwesomeIcon icon={faReddit} className="w-3.5 h-3.5 text-[#FF4500]" />
                    Reddit
                </a>
                <a
                    href="https://discord.gg/yC48K6qM4s"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackCardClick('discord')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
                >
                    <FontAwesomeIcon icon={faDiscord} className="w-3.5 h-3.5 text-[#5865F2]" />
                    Discord
                </a>
                <a
                    href="https://groups.google.com/g/brain-training"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackCardClick('google_groups')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
                >
                    <FontAwesomeIcon icon={faGoogle} className="w-3.5 h-3.5 text-[#4285F4]" />
                    Google Groups
                </a>
            </div>
        </div>
    );

    const articleCard = (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                <FontAwesomeIcon icon={faBookOpen} className="w-3 h-3 text-theme-text-secondary mr-1.5" />
                Training Tip
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-secondary mb-3">
                Should you use an intuitive or rehearsal strategy? Learn why going with your gut may be the better approach.
            </p>
            <a
                href="https://dualnback.com/articles/how-to-guides/intuitive-vs-rehearsal-strategies/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackCardClick('article_intuitive_vs_rehearsal')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
            >
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                Read Article
            </a>
        </div>
    );

    const noteCard = (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                <FontAwesomeIcon icon={faStickyNote} className="w-3 h-3 text-theme-text-secondary mr-1.5" />
                Take Session Notes
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-secondary">
                Save your thoughts on this session — strategies you tried, what you noticed, or how you felt. Use the Note button in the top right of this page.
            </p>
        </div>
    );

    const hasAssessmentAccess = canAccessProAssessments(userData, subscriptionTier);
    const assessmentsCard = (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-1.5">
                <FontAwesomeIcon icon={faClipboardCheck} className="w-3 h-3 text-theme-text-secondary mr-1.5" />
                Cognitive Assessments
            </p>
            <p className="text-[0.6875rem] font-mono text-theme-text-secondary mb-3">
                {hasAssessmentAccess
                    ? 'Put your training to the test. A full suite of research-backed assessments measures working memory, attention, reasoning, and processing speed.'
                    : 'Two free, research-backed assessments measure your working memory and reasoning. More unlock with Pro.'}
            </p>
            <button
                onClick={() => { trackCardClick(hasAssessmentAccess ? 'assessments_pro' : 'assessments_free'); navigate('/testing'); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors"
            >
                <FontAwesomeIcon icon={faArrowRight} className="w-3 h-3" />
                {hasAssessmentAccess ? 'Explore Assessments' : 'Try a Free Assessment'}
            </button>
        </div>
    );

    const classicAdaptiveUpsellCard = (
        <div className="p-3 sm:p-4 border border-theme-accent/30 bg-theme-accent/5">
            <p className="text-xs font-mono font-medium text-theme-text mb-2">
                <FontAwesomeIcon icon={faChartLine} className="w-3 h-3 text-theme-accent mr-1.5" />
                Upgrade to Pro
            </p>
            <p className="text-xs font-mono text-theme-text-secondary mb-3">
                Free accounts are capped at 10 sessions a day. Go Pro to remove the cap and unlock the full toolkit:
            </p>
            <div className="flex flex-wrap gap-1.5 mb-3">
                {['Unlimited sessions', 'Pro assessments', 'Advanced Insights'].map((feature) => (
                    <span key={feature} className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.625rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50">
                        <span className="w-1 h-1 bg-theme-accent rounded-full flex-shrink-0" />
                        {feature}
                    </span>
                ))}
            </div>
            <button
                onClick={() => { trackCardClick('classic_adaptive_upsell'); navigate('/subscribe'); }}
                className="text-xs font-medium text-theme-accent hover:text-theme-accent/80 transition-colors inline-flex items-center gap-1"
            >
                Go Pro <FontAwesomeIcon icon={faArrowRight} className="h-2.5 w-2.5" />
            </button>
        </div>
    );

    const baseCards = sessionId
        ? [communityCard, articleCard, assessmentsCard, noteCard]
        : [communityCard, articleCard, assessmentsCard];
    if (reminderEnabled === false && !reminderCardCapped) {
        baseCards.push(<ReminderEmailCard />);
    }
    const promotionalCards = isClassicMode && !isPro
        ? [classicAdaptiveUpsellCard, ...baseCards]
        : baseCards;
    const poolIndex = (readinessSessionCount ?? 0) % promotionalCards.length;
    const selectedCard = promotionalCards[poolIndex];

    return (
        <div
            data-game-active={true}
            className={`min-h-screen bg-theme-bg flex items-center justify-center p-4 sm:p-6 ${!isPro ? 'pt-16' : ''}`}
        >
            {/* Background Grid Pattern */}
            <div className="fixed inset-0 pointer-events-none">
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `
                            linear-gradient(var(--color-line) 1px, transparent 1px),
                            linear-gradient(90deg, var(--color-line) 1px, transparent 1px)
                        `,
                        backgroundSize: '32px 32px'
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--color-bg-primary) 70%, transparent) 100%)'
                    }}
                />
            </div>

            {/* Main Results Panel */}
            <div className="relative z-10 bg-theme-bg-secondary border border-theme-line w-full max-w-2xl">
                {/* Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-accent/50 to-transparent" />

                {/* Panel Header - Report Title Bar */}
                <div className="border-b border-theme-line px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${performanceDisplay.textClass}`} style={{ background: 'currentColor' }} />
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            {isPlayground ? 'Playground Analysis' : 'Session Analysis'}
                        </span>
                    </div>
                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                        {GAME_MODES[gameMode]?.name || 'Dual N-Back'}
                    </div>
                </div>

                {/* Header Section - Performance Summary */}
                <div className="px-4 sm:px-6 py-5 border-b border-theme-line">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-3 items-start">
                        {/* Wrapper uses display:contents so the title, badge row, and action buttons
                            all participate directly in the grid (title + buttons on row 1, badges on row 2). */}
                        <div className="contents">
                            <h1 className="font-serif text-xl sm:text-2xl text-theme-text sm:col-start-1 sm:row-start-1">
                                {isPlayground ? 'Playground Results' : 'Session Complete'}
                            </h1>
                            {/* Badges span the full header width on desktop (own row) so chips wrap later */}
                            <div className="flex flex-wrap gap-2 items-center sm:col-start-1 sm:col-span-2 sm:row-start-2">
                                {/* Performance Badge */}
                                <span className={`inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border ${performanceDisplay.bgClass} ${performanceDisplay.borderClass} ${performanceDisplay.textClass}`}>
                                    {performanceDisplay.text}
                                </span>
                                {/* Duration Badge */}
                                {durationMs !== null && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted">
                                        {formatDuration(durationMs)}
                                    </span>
                                )}
                                {/* Today-totals group is rendered last so it can right-align on desktop — see below */}
                                {/* Partial Result Badge */}
                                {isPartialResult && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-accent/50 bg-theme-accent/10 text-theme-accent">
                                        Partial: {trialsCompleted}/{totalTrialsPlanned}
                                    </span>
                                )}
                                {/* Playground Badge */}
                                {isPlayground && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-neural-pulse/50 bg-neural-pulse/10 text-theme-neural-blue">
                                        Playground
                                    </span>
                                )}
                                {/* Today totals (sessions + time trained) — grouped and pushed right on desktop
                                    via sm:ml-auto; wraps to its own line on mobile. Placed last so the left
                                    badges (Performance, Duration, Partial) stay grouped on the left. */}
                                {!isPlayground && gameResults?.todaySessionCount > 0 && (
                                    <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
                                        {/* Sessions Today Badge - all-modes session count for today */}
                                        <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted whitespace-nowrap">
                                            {gameResults.todaySessionCount} session{gameResults.todaySessionCount === 1 ? '' : 's'} today
                                        </span>
                                        {/* Time Trained Today Badge - all-modes total duration (optional field;
                                            older backend responses omit it, so the chip simply won't render). */}
                                        {(gameResults?.todayTotalDurationMs ?? 0) > 0 && (
                                            <span
                                                className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted whitespace-nowrap"
                                                aria-label={`${formatTotalDurationAria(gameResults.todayTotalDurationMs)} trained`}
                                            >
                                                {formatTotalDuration(gameResults.todayTotalDurationMs)} trained
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Replay + Add Note buttons — top-right beside the title on desktop, wrap below on mobile */}
                        <div className="flex items-center gap-2 sm:col-start-2 sm:row-start-1 sm:justify-self-end">
                            {canReplay && (
                                <button
                                    onClick={handleReplay}
                                    className="px-3 py-2 text-xs font-mono uppercase tracking-wider
                                             text-theme-text-secondary hover:text-theme-text
                                             border border-theme-line hover:border-theme-accent/50
                                             bg-theme-bg-elevated hover:bg-theme-bg-surface
                                             transition-all duration-150 flex items-center gap-2"
                                    title="Replay this session"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Replay
                                </button>
                            )}
                            {sessionId && !isNoteEditing && !noteSaved && (
                                <button
                                    onClick={() => setIsNoteEditing(true)}
                                    className="px-3 py-2 text-xs font-mono uppercase tracking-wider
                                             text-theme-text-secondary hover:text-theme-text
                                             border border-theme-line hover:border-theme-accent/50
                                             bg-theme-bg-elevated hover:bg-theme-bg-surface
                                             transition-all duration-150 flex items-center gap-2"
                                    title="Add a note to this session"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Add Note
                                </button>
                            )}
                            {noteSaved && !isNoteEditing && (
                                <button
                                    onClick={() => setIsNoteEditing(true)}
                                    className="px-3 py-2 text-xs font-mono uppercase tracking-wider
                                             text-theme-accent/70 hover:text-theme-accent
                                             border border-theme-accent/30 hover:border-theme-accent/50
                                             bg-theme-accent/5 hover:bg-theme-accent/10
                                             transition-all duration-150 flex items-center gap-2"
                                    title="Edit note"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Note Saved
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Note Editor */}
                {isNoteEditing && (
                    <div className="px-4 sm:px-6 py-3 border-b border-theme-line bg-theme-bg-elevated/50">
                        <textarea
                            value={noteText}
                            onChange={(e) => {
                                setNoteText(e.target.value);
                                setNoteError(null);
                            }}
                            maxLength={500}
                            rows={2}
                            placeholder="Add a note about this session..."
                            className="w-full px-3 py-2 text-xs font-mono
                                     border border-theme-line bg-theme-bg-elevated
                                     text-theme-text placeholder-theme-text-muted/50
                                     focus:outline-none focus:border-theme-accent/50
                                     resize-none rounded-sm"
                        />
                        <div className="flex items-center justify-between mt-2">
                            <span className={`text-[0.625rem] font-mono ${noteText.length > 450 ? 'text-status-error' : 'text-theme-text-muted'}`}>
                                {noteText.length}/500
                            </span>
                            <div className="flex items-center gap-2">
                                {noteError && (
                                    <span className="text-[0.625rem] font-mono text-status-error">{noteError}</span>
                                )}
                                <button
                                    onClick={() => {
                                        setIsNoteEditing(false);
                                        setNoteError(null);
                                        if (!noteSaved) setNoteText('');
                                    }}
                                    className="px-3 py-1 text-[0.625rem] font-mono uppercase tracking-wider
                                             text-theme-text-muted hover:text-theme-text transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveNote}
                                    disabled={noteSaving || noteText.trim().length === 0}
                                    className="px-3 py-1 text-[0.625rem] font-mono uppercase tracking-wider
                                             text-theme-accent border border-theme-accent/30
                                             hover:bg-theme-accent/10 transition-all duration-150
                                             disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {noteSaving ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tabs Navigation */}
                <div className="border-b border-theme-line">
                    <nav className="flex px-4 sm:px-6 items-center justify-between" aria-label="Tabs">
                        <div className="flex">
                            <button
                                onClick={() => handleTabChange('overview')}
                                className={`py-3 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === 'overview'
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => handleTabChange('detailed')}
                                className={`py-3 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === 'detailed'
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                            >
                                <span className="sm:hidden">Analysis</span>
                                <span className="hidden sm:inline">Detailed Analysis</span>
                            </button>
                            <button
                                onClick={() => handleTabChange('sequence')}
                                className={`py-3 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === 'sequence'
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                            >
                                Sequence
                            </button>
                        </div>
                        {/* Tab nav arrows — clickable buttons styled as keyboard-shortcut chips. Desktop only. */}
                        <div className="hidden sm:flex items-center gap-1.5 text-theme-text-muted">
                            <button
                                type="button"
                                onClick={() => goToTabByDelta(-1)}
                                disabled={TAB_ORDER.indexOf(activeTab) <= 0}
                                aria-label="Previous tab"
                                className="px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg rounded border border-theme-line
                                           hover:bg-theme-bg-elevated hover:text-theme-text-secondary
                                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-theme-bg disabled:hover:text-theme-text-muted
                                           transition-colors"
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                onClick={() => goToTabByDelta(1)}
                                disabled={TAB_ORDER.indexOf(activeTab) >= TAB_ORDER.length - 1}
                                aria-label="Next tab"
                                className="px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg rounded border border-theme-line
                                           hover:bg-theme-bg-elevated hover:text-theme-text-secondary
                                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-theme-bg disabled:hover:text-theme-text-muted
                                           transition-colors"
                            >
                                →
                            </button>
                        </div>
                    </nav>
                </div>

                {/* Tab Content Area — supports horizontal swipe-to-switch on touch devices. */}
                <div
                    className="p-4 sm:p-6 touch-pan-y"
                    onTouchStart={handleTabContentTouchStart}
                    onTouchEnd={handleTabContentTouchEnd}
                >
                    {activeTab === 'overview' && (
                        <div className="space-y-4">
                            {/* Performance Gauge Panel with d' scale bar */}
                                <div className="border border-theme-line bg-theme-bg-elevated p-4 relative">
                                    {/* Corner Accents */}
                                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-theme-accent/30" />
                                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-theme-accent/30" />
                                    <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-theme-accent/30" />
                                    <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-theme-accent/30" />

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                                        {isClassicMode ? (
                                            /* Classic: Accuracy Gauge */
                                            <div className="flex-1">
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-2">
                                                    Overall Accuracy
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className="text-2xl font-mono font-bold text-theme-text">
                                                        {formatAcc(displayAcc.overall)}%
                                                    </span>
                                                    <span className="text-xs font-mono pb-1 text-theme-text-secondary">
                                                        {performanceDisplay.text}
                                                    </span>
                                                </div>
                                                {/* Accuracy Bar (0-100%) */}
                                                <div className="mt-3 h-2 bg-theme-bg-elevated border border-theme-line relative overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${
                                                            performanceCategory === 'excellent' || performanceCategory === 'very-good'
                                                                ? 'bg-theme-neural-green'
                                                                : performanceCategory === 'good'
                                                                ? 'bg-theme-neural-blue'
                                                                : performanceCategory === 'fair'
                                                                ? 'bg-theme-accent'
                                                                : 'bg-theme-neural-red'
                                                        }`}
                                                        style={{ width: `${Math.min(100, displayAcc.overall || 0)}%` }}
                                                    />
                                                </div>
                                                <div className="flex justify-between mt-1 text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal font-mono text-theme-text-muted">
                                                    <span>0%</span>
                                                    <span>50%</span>
                                                    <span>100%</span>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Adaptive: D-Prime Gauge (unchanged) */
                                            <div className="flex-1">
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-2">
                                                    Sensitivity Index (d′)
                                                </div>
                                                <div className="flex items-end gap-3">
                                                    <span className={`text-4xl font-mono font-bold ${performanceDisplay.textClass}`}>
                                                        {formatNum(overallDprime, 2)}
                                                    </span>
                                                    <span className="text-xs font-mono text-theme-text-muted pb-1">
                                                        {performanceDisplay.text}
                                                    </span>
                                                </div>
                                                {/* Gauge Bar */}
                                                <div className="mt-3 h-2 bg-theme-bg-elevated border border-theme-line relative overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${
                                                            performanceCategory === 'excellent' || performanceCategory === 'very-good'
                                                                ? 'bg-theme-neural-green'
                                                                : performanceCategory === 'good'
                                                                ? 'bg-theme-neural-blue'
                                                                : performanceCategory === 'fair'
                                                                ? 'bg-theme-accent'
                                                                : 'bg-theme-neural-red'
                                                        }`}
                                                        style={{ width: `${dprimeGaugePercent}%` }}
                                                    />
                                                    {/* Scale markers */}
                                                    <div className="absolute inset-0 flex">
                                                        {[1, 2, 3].map((i) => (
                                                            <div key={i} className="flex-1 border-r border-theme-line/50" />
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex justify-between mt-1 text-[0.6875rem] font-medium sm:text-[0.5625rem] sm:font-normal font-mono text-theme-text-muted">
                                                    <span>0</span>
                                                    <span>1</span>
                                                    <span>2</span>
                                                    <span>3</span>
                                                    <span>4+</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Divider — dropped in Recall, where the modality grid is empty */}
                                        {!isRecallMode && <div className="hidden sm:block w-px h-20 bg-theme-line" />}

                                        {/* Modality Scores — Recall has no binary modality to score here;
                                            RecallResultsCard below replaces this grid. */}
                                        <div className={`${isRecallMode ? 'hidden' : 'grid'} gap-4 sm:gap-6 ${
                                            activeModalityCount === 1 ? 'grid-cols-1' :
                                            activeModalityCount === 4 ? 'grid-cols-2 sm:grid-cols-4' :
                                            activeModalityCount === 3 ? 'grid-cols-3' : 'grid-cols-2'
                                        }`}>
                                            {/* Position */}
                                            {hasVisualModality && (
                                            <div className="text-center">
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                                    Position
                                                </div>
                                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-blue`}>
                                                    {formatAcc(displayAcc.visual)}%
                                                </div>
                                                {!isClassicMode && (
                                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                        d′ {formatNum(visualDprime, 1)}
                                                    </div>
                                                )}
                                                {isClassicMode && (
                                                    <>
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            {visualCorrect ?? '?'}/{visualTargetCount ?? '?'} hits
                                                        </div>
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            {visualFalseAlarms ?? '?'} false alarm{visualFalseAlarms !== 1 ? 's' : ''}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            )}
                                            {/* Audio */}
                                            {hasAudioModality && (
                                            <div className="text-center">
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                                    Audio
                                                </div>
                                                <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-green`}>
                                                    {formatAcc(displayAcc.audio)}%
                                                </div>
                                                {!isClassicMode && (
                                                    <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                        d′ {formatNum(audioDprime, 1)}
                                                    </div>
                                                )}
                                                {isClassicMode && (
                                                    <>
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            {audioCorrect ?? '?'}/{audioTargetCount ?? '?'} hits
                                                        </div>
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            {audioFalseAlarms ?? '?'} false alarm{audioFalseAlarms !== 1 ? 's' : ''}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            )}
                                            {/* Color (Triple/Quad only — never Recall, which is not a match task) */}
                                            {hasColorModality && !isRecallMode && (
                                                <div className="text-center">
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                                        Color
                                                    </div>
                                                    <div className={`${accuracyTextSize} font-mono font-bold text-theme-accent`}>
                                                        {formatAcc(displayAcc.color)}%
                                                    </div>
                                                    {!isClassicMode && (
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            d′ {formatNum(colorDprime, 1)}
                                                        </div>
                                                    )}
                                                    {isClassicMode && (
                                                        <>
                                                            <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                                {colorCorrect ?? '?'}/{colorTargetCount ?? '?'} hits
                                                            </div>
                                                            <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                                {colorFalseAlarms ?? '?'} false alarm{colorFalseAlarms !== 1 ? 's' : ''}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {/* Shape (Quad only) */}
                                            {hasShapeModality && (
                                                <div className="text-center">
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-1">
                                                        Shape
                                                    </div>
                                                    <div className={`${accuracyTextSize} font-mono font-bold text-theme-neural-red`}>
                                                        {formatAcc(displayAcc.shape)}%
                                                    </div>
                                                    {!isClassicMode && (
                                                        <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                            d′ {formatNum(shapeDprime, 1)}
                                                        </div>
                                                    )}
                                                    {isClassicMode && (
                                                        <>
                                                            <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                                {shapeCorrect ?? '?'}/{shapeTargetCount ?? '?'} hits
                                                            </div>
                                                            <div className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                                                {shapeFalseAlarms ?? '?'} false alarm{shapeFalseAlarms !== 1 ? 's' : ''}
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            {/* Recall Mode: exact/blank/wrong breakdown, in place of the binary Color block */}
                            {isRecallMode && (
                                <RecallResultsCard
                                    recall={recall}
                                    colorDprime={colorDprime}
                                    isClassicMode={isClassicMode}
                                />
                            )}

                            {/* Level Progression Panel */}
                            {!isPlayground && (
                                <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                    {isClassicMode ? (
                                        /* Classic: suggested or current level display */
                                        <>
                                            <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                                                {isManualClassicMode ? 'Current Level' : 'Suggested Level'}
                                            </div>
                                            <div className="text-center py-2">
                                                <div className={`text-3xl font-mono font-bold ${
                                                    !isManualClassicMode && levelChange === 'up' ? 'text-theme-neural-green' : 'text-theme-text'
                                                }`}>
                                                    N = {isManualClassicMode ? nBackPlayed : (dAlgoNBack || nBackPlayed)}
                                                </div>
                                            </div>
                                            {!isManualClassicMode && levelChange === 'up' && (
                                                <div className="text-center text-xs font-mono text-theme-neural-green mt-1">
                                                    ↑ Up from N = {nBackPlayed}
                                                </div>
                                            )}
                                            {!isManualClassicMode && levelChange === 'down' && (
                                                <div className="text-center text-xs font-mono text-theme-text mt-1">
                                                    ↓ Down from N = {nBackPlayed}
                                                </div>
                                            )}
                                            <div className="border-t border-theme-line pt-3 mt-3 flex items-center justify-center gap-1.5">
                                                <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                                                    Auto level adjustment {classicAutoLevel ? 'on' : 'off'}
                                                </span>
                                                <span className="text-[0.6875rem] text-theme-text-muted">·</span>
                                                <button
                                                    onClick={() => updateSetting('classicAutoLevel', !classicAutoLevel)}
                                                    className="text-[0.6875rem] font-mono text-theme-accent hover:underline"
                                                >
                                                    {classicAutoLevel ? 'Disable' : 'Enable'}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        /* Adaptive: d-prime-based progression (unchanged) */
                                        <>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                                                    Level Progression
                                                </div>
                                                <div className="text-xs font-mono text-theme-text-muted flex items-center gap-2">
                                                    Based on d′ {formatNum(overallDprime, 2)}
                                                    {rewardedProSessionsRemaining > 0 && (
                                                        <span className="px-1.5 py-0.5 text-[0.625rem] font-mono uppercase tracking-wider bg-theme-accent/10 text-theme-accent border border-theme-accent/30 rounded">
                                                            Pro · {rewardedProSessionsRemaining} left
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-center gap-4 mb-4">
                                                <div className="text-center">
                                                    <div className="text-2xl font-mono font-bold text-theme-text">
                                                        {playedCombinedDisplay}
                                                    </div>
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                                        Played
                                                    </div>
                                                </div>
                                                <svg className="w-6 h-6 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                </svg>
                                                <div className="text-center">
                                                    {isManualAdaptiveMode ? (
                                                        <LevelStepper
                                                            displayValue={effectiveSuggestedDisplay}
                                                            valueClassName={`text-2xl font-mono font-bold ${
                                                                isDynamicSession && subModeChanged ? 'text-theme-neural-green'
                                                                    : effectiveAlgoNBack > nBackPlayed ? 'text-theme-neural-green'
                                                                    : 'text-theme-text'
                                                            }`}
                                                            onDecrement={() => handleStepLevel(-1)}
                                                            onIncrement={() => handleStepLevel(+1)}
                                                            canDecrement={canStepDown}
                                                            canIncrement={canStepUp}
                                                        />
                                                    ) : (
                                                        <div className={`text-2xl font-mono font-bold ${
                                                            isDynamicSession && subModeChanged ? 'text-theme-neural-green'
                                                                : effectiveAlgoNBack > nBackPlayed ? 'text-theme-neural-green'
                                                                : effectiveAlgoNBack < nBackPlayed ? 'text-theme-text'
                                                                : effectiveAlgoDifficulty > difficultyPlayed ? 'text-theme-neural-green'
                                                                : effectiveAlgoDifficulty < difficultyPlayed ? 'text-theme-text'
                                                                : 'text-theme-text'
                                                        }`}>
                                                            {effectiveSuggestedDisplay}
                                                        </div>
                                                    )}
                                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                                                        {isManualAdaptiveMode ? 'Next Level' : 'Suggested'}
                                                    </div>
                                                </div>
                                            </div>

                                            {!isManualAdaptiveMode && effectiveAlgoNBack > nBackPlayed && (
                                                <div className="border-l-2 border-neural-dendrite bg-neural-dendrite/5 p-3">
                                                    <div className="flex items-center gap-2 text-theme-neural-green text-sm font-mono">
                                                        <span className="text-lg">↑</span>
                                                        <span>Advanced to {effectiveAlgoNBack}-back! Starting at {effectiveSuggestedDisplay}.</span>
                                                    </div>
                                                </div>
                                            )}

                                            {isPro && !isManualAdaptiveMode && (
                                                <div className="border-t border-theme-line pt-3 mt-3 flex items-center justify-center gap-1.5">
                                                    <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                                                        {DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS.find(o => o.key === (settings.difficultyAdjustmentRange || adjustmentRangeKey || 'standard'))?.label || 'Standard'} progression
                                                    </span>
                                                    <span className="text-[0.6875rem] text-theme-text-muted">·</span>
                                                    <button
                                                        onClick={() => setIsRangeModalOpen(true)}
                                                        className="text-[0.6875rem] font-mono text-theme-accent hover:underline"
                                                    >
                                                        Change
                                                    </button>
                                                </div>
                                            )}
                                            {isManualAdaptiveMode && (
                                                <div className="border-t border-theme-line pt-3 mt-3 flex items-center justify-center gap-1.5">
                                                    <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                                                        Auto level adjustment off
                                                    </span>
                                                    <span className="text-[0.6875rem] text-theme-text-muted">·</span>
                                                    <button
                                                        onClick={() => {
                                                            // Revert the stepper override so the algorithm's
                                                            // suggestion shows again immediately.
                                                            setOverrideSuggestion(null);
                                                            updateSetting('adaptiveAutoLevel', true);
                                                        }}
                                                        className="text-[0.6875rem] font-mono text-theme-accent hover:underline"
                                                    >
                                                        Enable
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Progression Speed Modal — rendered via portal below */}

                            {/* Promotion credits (Sept 2026) */}
                            {showPromotionCredits && (
                                <PromotionCreditsCard
                                    credits={newPromotionCredits}
                                    required={promotionCreditsRequired}
                                    nBack={nBackPlayed}
                                    unit="session"
                                    destinationLabel={promotionDestinationLabel}
                                />
                            )}

                            {/* Feature Intro Message */}
                            {introMessage && (
                                <div>
                                    <FeatureIntroMessage message={introMessage} />
                                </div>
                            )}

                            {/* Cohort Progress Update Card */}
                            {activeCohortId && !isTodayRestDay && todaysSessionTarget > 0 && (
                                <div className={`border border-theme-line bg-theme-bg-elevated p-3 mt-2 ${
                                    todaysSessionsCompleted >= todaysSessionTarget
                                        ? 'border-green-500/30'
                                        : ''
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-0.5">
                                                Cohort — Day {programDay}
                                            </p>
                                            <p className="text-sm text-theme-text">
                                                <span className={todaysSessionsCompleted >= todaysSessionTarget ? 'text-green-500' : ''}>
                                                    {todaysSessionsCompleted}/{todaysSessionTarget} sessions
                                                    {todaysSessionsCompleted >= todaysSessionTarget && (
                                                        <FontAwesomeIcon icon={faCheck} className="ml-1.5 h-3 w-3" />
                                                    )}
                                                </span>
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => onNavigate('/program')}
                                            className="flex items-center gap-1.5 text-xs text-theme-accent hover:text-theme-accent/80 transition-colors"
                                        >
                                            View Cohort →
                                            {unreadChatCount > 0 && (
                                                <span
                                                    className="min-w-[1.125rem] h-4 flex items-center justify-center rounded-full bg-theme-accent text-theme-bg text-[0.625rem] font-bold px-0.5"
                                                    aria-label={`${unreadChatCount} unread message${unreadChatCount !== 1 ? 's' : ''}`}
                                                >
                                                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Promotional / upsell card */}
                            {selectedCard}
                        </div>
                    )}

                    {activeTab === 'detailed' && (
                        <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {/* Performance Cards - Dynamic grid based on game mode */}
                            <div className={`grid gap-4 ${
                                activeModalityCount === 1 ? 'grid-cols-1' :
                                activeModalityCount === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                                activeModalityCount === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
                            }`}>
                                {/* Position Performance */}
                                {hasVisualModality && (
                                <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 bg-theme-neural-blue" />
                                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                                            Position Channel
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">Acc</span>
                                            <span className="text-theme-text">{formatAcc(displayAcc.visual)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">Hits</span>
                                            <span className="text-theme-text">{visualCorrect ?? '?'} / {visualTargetCount ?? '?'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">False Alarms</span>
                                            <span className="text-theme-text">{visualFalseAlarms ?? '?'}</span>
                                        </div>
                                        {!isClassicMode && (
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Median RT</span>
                                                <span className="text-theme-text">{visualHitRTMedian != null ? `${visualHitRTMedian} ms` : '—'}</span>
                                            </div>
                                        )}
                                        {!isClassicMode && (
                                            <div className="pt-2 border-t border-theme-line mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-theme-text-muted">d′ Score</span>
                                                    <span className="text-lg text-theme-neural-blue font-bold">{formatNum(visualDprime, 2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {/* Audio Performance */}
                                {hasAudioModality && (
                                <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2 h-2 bg-theme-neural-green" />
                                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                                            Audio Channel
                                        </span>
                                    </div>
                                    <div className="space-y-2 text-sm font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">Acc</span>
                                            <span className="text-theme-text">{formatAcc(displayAcc.audio)}%</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">Hits</span>
                                            <span className="text-theme-text">{audioCorrect ?? '?'} / {audioTargetCount ?? '?'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-theme-text-muted">False Alarms</span>
                                            <span className="text-theme-text">{audioFalseAlarms ?? '?'}</span>
                                        </div>
                                        {!isClassicMode && (
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Median RT</span>
                                                <span className="text-theme-text">{audioHitRTMedian != null ? `${audioHitRTMedian} ms` : '—'}</span>
                                            </div>
                                        )}
                                        {!isClassicMode && (
                                            <div className="pt-2 border-t border-theme-line mt-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-theme-text-muted">d′ Score</span>
                                                    <span className="text-lg text-theme-neural-green font-bold">{formatNum(audioDprime, 2)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                )}

                                {/* Color Performance (Triple/Quad only — never Recall, which is not a match task) */}
                                {hasColorModality && !isRecallMode && (
                                    <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2 h-2 bg-theme-accent" />
                                            <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                                                Color Channel
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm font-mono">
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Acc</span>
                                                <span className="text-theme-text">{formatAcc(displayAcc.color)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Hits</span>
                                                <span className="text-theme-text">{colorCorrect ?? '?'} / {colorTargetCount ?? '?'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">False Alarms</span>
                                                <span className="text-theme-text">{colorFalseAlarms ?? '?'}</span>
                                            </div>
                                            {!isClassicMode && (
                                                <div className="flex justify-between">
                                                    <span className="text-theme-text-muted">Median RT</span>
                                                    <span className="text-theme-text">{colorHitRTMedian != null ? `${colorHitRTMedian} ms` : '—'}</span>
                                                </div>
                                            )}
                                            {!isClassicMode && (
                                                <div className="pt-2 border-t border-theme-line mt-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-theme-text-muted">d′ Score</span>
                                                        <span className="text-lg text-theme-accent font-bold">{formatNum(colorDprime, 2)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Shape Performance (Quad only) */}
                                {hasShapeModality && (
                                    <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-2 h-2 bg-theme-neural-red" />
                                            <span className="text-xs font-mono uppercase tracking-wider text-theme-text-secondary">
                                                Shape Channel
                                            </span>
                                        </div>
                                        <div className="space-y-2 text-sm font-mono">
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Acc</span>
                                                <span className="text-theme-text">{formatAcc(displayAcc.shape)}%</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">Hits</span>
                                                <span className="text-theme-text">{shapeCorrect ?? '?'} / {shapeTargetCount ?? '?'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-theme-text-muted">False Alarms</span>
                                                <span className="text-theme-text">{shapeFalseAlarms ?? '?'}</span>
                                            </div>
                                            {!isClassicMode && (
                                                <div className="flex justify-between">
                                                    <span className="text-theme-text-muted">Median RT</span>
                                                    <span className="text-theme-text">{shapeHitRTMedian != null ? `${shapeHitRTMedian} ms` : '—'}</span>
                                                </div>
                                            )}
                                            {!isClassicMode && (
                                                <div className="pt-2 border-t border-theme-line mt-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-theme-text-muted">d′ Score</span>
                                                        <span className="text-lg text-theme-neural-red font-bold">{formatNum(shapeDprime, 2)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Recall Mode: fills the channel grid the gated Color card left empty */}
                                {isRecallMode && (
                                    <RecallResultsCard
                                        recall={recall}
                                        colorDprime={colorDprime}
                                        isClassicMode={isClassicMode}
                                    />
                                )}
                            </div>

                            {/* Session Details */}
                            <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted mb-3">
                                    Session Parameters
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-mono">
                                    <div>
                                        <div className="text-theme-text-muted text-xs">Level</div>
                                        <div className="text-theme-text">{playedCombinedDisplay}</div>
                                    </div>
                                    <div>
                                        <div className="text-theme-text-muted text-xs">Trials</div>
                                        <div className="text-theme-text">{trialsCompleted} / {totalTrialsPlanned}</div>
                                    </div>
                                    <div>
                                        <div className="text-theme-text-muted text-xs">Duration</div>
                                        <div className="text-theme-text">{formatDuration(durationMs)}</div>
                                    </div>
                                    <div>
                                        <div className="text-theme-text-muted text-xs">Overall Acc.</div>
                                        <div className="text-theme-text">{formatAcc(displayAcc.overall)}%</div>
                                    </div>
                                </div>
                            </div>

                            {/* Performance Scale Reference (Adaptive only — Classic doesn't use d' thresholds) */}
                            {!isClassicMode && <div className="border border-theme-line bg-theme-bg-elevated p-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                                        Performance Scale (d′)
                                    </span>
                                    {overallDprime !== null && (
                                        <span className="text-sm sm:text-xs font-mono text-theme-text-muted">
                                            Your score: {formatNum(overallDprime, 2)}
                                        </span>
                                    )}
                                </div>
                                {thresholdsValid ? (
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                        <div className={`flex items-center gap-2 ${performanceCategory === 'excellent' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                            <div className="w-2 h-2 bg-theme-neural-green" />
                                            <span>Excellent: ≥ {formatNum(excellentThreshold, 2)}</span>
                                        </div>
                                        <div className={`flex items-center gap-2 ${performanceCategory === 'very-good' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                            <div className="w-2 h-2 bg-theme-neural-blue" />
                                            <span>Very Good: {formatNum(veryGoodT, 2)}+</span>
                                        </div>
                                        <div className={`flex items-center gap-2 ${performanceCategory === 'good' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                            <div className="w-2 h-2 bg-theme-neural-blue opacity-60" />
                                            <span>Good: {formatNum(goodThreshold, 2)}+</span>
                                        </div>
                                        <div className={`flex items-center gap-2 ${performanceCategory === 'fair' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                            <div className="w-2 h-2 bg-theme-accent" />
                                            <span>Fair: {formatNum(fairThreshold, 2)}+</span>
                                        </div>
                                        <div className={`flex items-center gap-2 ${performanceCategory === 'needs-improvement' ? 'text-theme-text' : 'text-theme-text-muted'}`}>
                                            <div className="w-2 h-2 bg-theme-neural-red" />
                                            <span>Needs Work: &lt; {formatNum(fairThreshold, 2)}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs font-mono text-theme-text-muted">
                                        Performance thresholds not available.
                                    </div>
                                )}
                            </div>}
                        </div>
                    )}

                    {activeTab === 'sequence' && (
                        hasValidReplayDataStructure && sequence.length > 0 ? (
                            <SequenceTimeline
                                sequence={sequence}
                                events={replayData.events}
                                nBack={nBackPlayed}
                                modality={gameMode}
                                totalTrials={trialsCompleted}
                                currentTrialIndex={-1}
                                onSeekToTrial={() => {}}
                                compactMode={true}
                                palette={gameResults?.session?.palette || currentPalette}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <svg className="w-8 h-8 text-theme-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                </svg>
                                <p className="text-sm font-mono text-theme-text-muted">
                                    Sequence data not available for this session
                                </p>
                            </div>
                        )
                    )}
                </div>

                {/* Action Buttons Footer */}
                <div className="px-4 sm:px-6 py-4 bg-theme-bg-elevated border-t border-theme-line">
                    <div className="space-y-3">
                        {/* Main Action Buttons */}
                        <div className={`grid gap-3 ${
                            actionButtons.length === 3 ? 'grid-cols-1 sm:grid-cols-3'
                            : actionButtons.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
                            : 'grid-cols-1'
                        }`}>
                            {actionButtons.map((btn, index) => (
                                <button
                                    key={index}
                                    onClick={btn.action}
                                    className={`w-full px-4 py-3 text-sm font-mono uppercase tracking-wider
                                             transition-all duration-150 flex items-center justify-center gap-2
                                             ${btn.style === "primary"
                                                 ? 'bg-theme-accent hover:bg-theme-accent-hover text-theme-bg border border-theme-accent'
                                                 : btn.style === "rewarded"
                                                 ? 'bg-theme-bg-elevated hover:bg-theme-bg-surface text-theme-accent hover:text-theme-accent-hover border border-theme-accent/40 hover:border-theme-accent/70'
                                                 : 'bg-theme-bg-elevated hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text border border-theme-line hover:border-theme-accent/50'
                                             }`}
                                    title={btn.title}
                                >
                                    {btn.style === "rewarded" && (
                                        <FontAwesomeIcon icon={faPlay} className="h-3 w-3" />
                                    )}
                                    {btn.text}
                                    {btn.kbdHint && (
                                        <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[0.75rem] font-mono bg-theme-bg/20 rounded border border-charcoal/30">
                                            {btn.kbdHint}
                                        </kbd>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Dashboard Button */}
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={onDashboard}
                                className="px-4 py-2 text-xs font-mono uppercase tracking-wider
                                         text-theme-text-muted hover:text-theme-text-secondary
                                         border border-theme-line hover:border-theme-line
                                         bg-transparent hover:bg-theme-bg-elevated
                                         transition-all duration-150 flex items-center gap-2"
                                title="Return to dashboard"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Dashboard
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom Accent Line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-line to-transparent" />
            </div>

            {/* Confirmation Modal for "Back to Previous Stored" — never for recall sessions
                (its level label and its write both target the singleColor Match track). */}
            <ConfirmationModal
                isOpen={!isRecallMode && isConfirmBackModalOpen}
                onClose={cancelGoBack}
                onConfirm={confirmGoBackAndStart}
                title="Go Back to Previous Level?"
                confirmText="Go Back"
                cancelText="Cancel"
            >
                <p className="text-theme-text-secondary font-mono text-sm">
                    Are you sure you want to go back to level {prevNBackStoredLevelDisplay}?
                </p>
                {nBackPlayed && prevNBackStoredLevelDisplay && nBackPlayed > 1 && (
                    <p className="text-theme-text-muted font-mono text-xs mt-2">
                        This will take you to the difficulty you last played at for {nBackPlayed - 1}-Back.
                    </p>
                )}
            </ConfirmationModal>

            {/* Fatigue Warning Modal - shown after extended sessions with declining performance */}
            <FatigueWarningModal
                isOpen={shouldShowFatigueWarning}
                onContinue={handleFatigueContinue}
                onTakeBreak={handleFatigueTakeBreak}
                consecutiveCount={consecutiveSessionCount}
                declineData={declineData}
            />

            {/* Pro-trial upgrade modal — fires on game-1 Continue click (chess.com onboarding pattern). */}
            {/* Shown only to users in the beta cohort (config/upgradeModalRollout.allowedEmails). */}
            <ProTrialUpgradeModal
                isOpen={!!showProTrialUpgradeModal}
                onClose={handleProTrialModalClose}
                trigger={proTrialUpgradeModalTrigger || 'game_1'}
            />

            {/* Daily Adaptive cap modal — mounted here so the pre-start gate
                from results-page Continue/Retry/Next-Level handlers renders
                without navigating back to /dashboard. State is single-instance
                in UserContext; DailyCapModal portals to document.body, so
                mounting in both ProfileDashboard and GameResults is safe. */}
            <DailyCapModal
                isOpen={!!showDailyCapModal}
                onClose={() => setShowDailyCapModal(false)}
                dailyCapInfo={dailyCapInfo}
            />

            {/* Progression Speed Modal — portal-rendered to match site-wide modal pattern */}
            {isRangeModalOpen && ReactDOM.createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 99999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.85)',
                            backdropFilter: 'blur(4px)',
                        }}
                        onClick={() => setIsRangeModalOpen(false)}
                    />
                    <div
                        style={{
                            position: 'relative',
                            width: '100%',
                            maxWidth: '28rem',
                            backgroundColor: 'rgb(var(--color-bg-secondary))',
                            border: '1px solid rgb(var(--color-line))',
                            borderRadius: '2px',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        }}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="range-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 pt-6 pb-4">
                            <h3 id="range-modal-title" className="text-lg font-serif text-theme-text mb-4">
                                Progression Speed
                            </h3>
                            <div className="space-y-2">
                                {DIFFICULTY_ADJUSTMENT_RANGE_OPTIONS.map((option) => {
                                    const currentRange = settings.difficultyAdjustmentRange || adjustmentRangeKey || 'standard';
                                    const isSelected = (pendingRange || currentRange) === option.key;
                                    return (
                                        <button
                                            key={option.key}
                                            onClick={() => setPendingRange(option.key)}
                                            className={`
                                                w-full text-left px-4 py-3 border transition-all duration-150
                                                ${isSelected
                                                    ? 'border-theme-accent/50 bg-theme-accent/10'
                                                    : 'border-theme-line bg-theme-bg-surface hover:bg-theme-bg-secondary'
                                                }
                                            `}
                                        >
                                            <div>
                                                <span className={`text-sm font-mono font-medium ${
                                                    isSelected ? 'text-theme-accent' : 'text-theme-text-secondary'
                                                }`}>
                                                    {option.label}
                                                </span>
                                                <p className="text-xs font-mono text-theme-text-secondary mt-0.5">
                                                    {option.description} · {option.detail}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                            <button
                                type="button"
                                disabled={!pendingRange || pendingRange === (settings.difficultyAdjustmentRange || adjustmentRangeKey || 'standard')}
                                onClick={() => {
                                    updateSetting('difficultyAdjustmentRange', pendingRange);
                                    // Manual mode: the stepper owns the "to" level — don't clobber it
                                    // with a recalculated suggestion (the setting itself still saves).
                                    const recalc = isManualAdaptiveMode ? null : recalculateSuggestion(pendingRange);
                                    if (recalc) {
                                        setOverrideSuggestion(recalc);
                                        updateProfileProgress(null, {
                                            currentNBack: recalc.nBack,
                                            currentDifficulty: recalc.difficulty,
                                            // Don't pass gameMode in Dynamic mode — let it use activeGameMode ('dynamic')
                                            ...(!isDynamicSession && { gameMode: gameMode }),
                                            // difficultyAdjustmentRange is an Adaptive-only (Pro) feature
                                            trainingMode: 'adaptive',
                                        });
                                    }
                                    setPendingRange(null);
                                    setIsRangeModalOpen(false);
                                }}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                                    bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
                                    transition-all duration-200
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Save
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPendingRange(null);
                                    setIsRangeModalOpen(false);
                                }}
                                className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                                    bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text
                                    border border-theme-line transition-all duration-200
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default GameResults;
