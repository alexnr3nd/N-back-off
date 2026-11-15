/* File: src/components/game/ContinuousResults.js */
/*
 * Results page for a Continuous Mode chain.
 *
 * Visually mirrors `GameResults.js` (same panel chrome, header, badges, tabs, action
 * footer) but adapted to show chain-aggregate stats + per-session breakdowns.
 * GameResults.js itself is intentionally untouched — see plan
 * `~/.claude/plans/silly-foraging-snowglobe.md`. Helper duplication (~40 lines) is
 * the explicit price of that constraint.
 *
 * Renders in place of GameResults when `gameResults.chainSummary` or
 * `gameResults.mode === 'continuous'` (see GameScreen.js:512).
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStickyNote, faUsers, faBookOpen, faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { faReddit, faDiscord, faGoogle } from '@fortawesome/free-brands-svg-icons';

import { useUser } from '../../contexts/UserContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useFatigueDetection } from '../../contexts/FatigueDetectionContext';
import { useReadinessScore } from '../../hooks/useReadinessScore';
import { useDailyCapStatus } from '../../hooks/useDailyCapStatus';
import useReviewPrompt from '../../hooks/useReviewPrompt';
import FatigueWarningModal from '../ui/FatigueWarningModal';
import DailyCapModal from '../ui/DailyCapModal';
import { trackEvent } from '../../utils/analyticsTracker';
import { FREE_TRIAL_SESSION_THRESHOLD } from '../../contexts/user/userConstants';
import { aggregateChainStats } from '../../utils/chainAggregate';
import { formatCombinedDifficulty, computeVeryGoodThreshold } from '../../contexts/gameHelpers';
import { DPRIME_THRESHOLDS_INTERPRETATION, DAILY_ADAPTIVE_CAP } from '../../constants/gameConstants';
import { formatDuration, formatTotalDuration, formatTotalDurationAria } from '../dashboard/utils/formatters';

import ChainOverviewTab from './continuous/ChainOverviewTab';
import ChainDetailedTab from './continuous/ChainDetailedTab';
import ChainSequenceTab from './continuous/ChainSequenceTab';
import PromotionCreditsCard from './PromotionCreditsCard';

// --- Visual mirror of GameResults helpers — keep in sync ---
// (Duplicated by design; extracting would touch GameResults.)

const getPerformanceCategory = (dprime, excellentT, goodT, fairT, calculatedVeryGoodT) => {
    const useDynamicThresholds = excellentT !== null && goodT !== null && fairT !== null && calculatedVeryGoodT !== null;
    if (dprime === null || typeof dprime !== 'number') return 'unknown';
    if (useDynamicThresholds) {
        if (dprime >= excellentT) return 'excellent';
        if (dprime >= calculatedVeryGoodT) return 'very-good';
        if (dprime >= goodT) return 'good';
        if (dprime >= fairT) return 'fair';
        return 'needs-improvement';
    }
    if (dprime >= 2.0) return 'good';
    if (dprime >= 1.0) return 'fair';
    return 'needs-improvement';
};

const getClassicPerformanceCategory = (accuracy) => {
    if (accuracy === null || typeof accuracy !== 'number') return 'unknown';
    if (accuracy >= 90) return 'excellent';
    if (accuracy >= 80) return 'very-good';
    if (accuracy >= 70) return 'good';
    if (accuracy >= 60) return 'fair';
    return 'needs-improvement';
};

const getPerformanceDisplay = (category, isClassicMode) => {
    switch (category) {
        case 'excellent':
            return { text: 'Excellent', bgClass: 'bg-neural-dendrite/10', borderClass: 'border-neural-dendrite/50', textClass: 'text-theme-neural-green' };
        case 'very-good':
            return { text: 'Very Good', bgClass: 'bg-neural-pulse/10', borderClass: 'border-neural-pulse/50', textClass: 'text-theme-neural-blue' };
        case 'good':
            return { text: 'Good', bgClass: 'bg-neural-pulse/10', borderClass: 'border-neural-pulse/50', textClass: 'text-theme-neural-blue' };
        case 'fair':
            return { text: isClassicMode ? 'Developing' : 'Fair', bgClass: 'bg-theme-accent/10', borderClass: 'border-theme-accent/50', textClass: 'text-theme-accent' };
        case 'needs-improvement':
            return isClassicMode
                ? { text: 'Keep Practicing', bgClass: 'bg-neural-synapse/10', borderClass: 'border-neural-synapse/50', textClass: 'text-theme-neural-red' }
                : { text: 'Needs Work', bgClass: 'bg-neural-synapse/10', borderClass: 'border-neural-synapse/50', textClass: 'text-theme-neural-red' };
        default:
            return { text: 'Unknown', bgClass: 'bg-theme-bg-elevated', borderClass: 'border-theme-line', textClass: 'text-theme-text-muted' };
    }
};

const formatNum = (num, decimals = 2) => ((typeof num === 'number' && Number.isFinite(num)) ? num.toFixed(decimals) : '—');
const formatAcc = (num) => formatNum(num, 1);

const ContinuousResults = ({
    gameResults,
    onDashboard,
    onStartNextSession,
    onNavigate, // eslint-disable-line no-unused-vars
}) => {
    // --- Context & state ---
    const {
        subscriptionTier, coachGrantedPremium, updateSessionNote, canStartFreeTrial, setShowFreeTrialOffer,
        showDailyCapModal, setShowDailyCapModal, dailyCapInfo, setDailyCapInfo,
    } = useUser();
    const { settings } = useSettings();
    const classicAutoLevel = settings?.classicAutoLevel !== false;
    const {
        consecutiveSessionCount,
        shouldShowFatigueWarning,
        declineData,
        recordSessionCompletion,
        dismissFatigueWarning,
        handleTakeBreak,
    } = useFatigueDetection();

    const { sessionCount: readinessSessionCount } = useReadinessScore(gameResults?.gameMode || 'dual');

    const isPro = subscriptionTier === 'premium' || coachGrantedPremium;

    const [activeTab, setActiveTab] = useState('overview');

    // Note state
    const [noteText, setNoteText] = useState('');
    const [isNoteEditing, setIsNoteEditing] = useState(false);
    const [noteSaving, setNoteSaving] = useState(false);
    const [noteSaved, setNoteSaved] = useState(false);
    const [noteError, setNoteError] = useState(null);

    const lastRecordedSessionIdRef = useRef(null);

    // --- Derive primary fields from gameResults ---
    const {
        sessionId = null,
        gameMode = 'dual',
        trainingMode = null,
        durationMs = null,
        nBack: nBackPlayed = null,
        chainSummary = {},
        newNBack = null,
        newDifficulty = null,
        preSessionProfileContext = null,
        excellentThreshold = null, goodThreshold = null, fairThreshold = null,
        newPromotionCredits = 0,
        promotionCreditsRequired = null,
        // True when the server skipped the progression write (stale offline replay);
        // the credit fields still ride along but describe a write that never happened.
        progressionSkipped = false,
    } = gameResults || {};

    const isClassicMode = trainingMode === 'classic';
    // Manual Adaptive mode: backend echoes adaptiveAutoLevel on non-classic saves;
    // absent field (old responses) means auto.
    const isManualAdaptive = !isClassicMode && gameResults?.adaptiveAutoLevel === false;
    const cs = chainSummary || {};
    const blocks = useMemo(
        () => Array.isArray(cs.blocks) ? cs.blocks
            : (Array.isArray(gameResults?.blocks) ? gameResults.blocks : []),
        [cs.blocks, gameResults?.blocks],
    );
    const totalBlocks = cs.totalBlocks ?? gameResults?.totalBlocks ?? blocks.length;
    const totalTrials = useMemo(
        () => blocks.reduce((s, b) => s + (b?.trials || 0), 0) || gameResults?.totalTrials || 0,
        [blocks, gameResults?.totalTrials],
    );
    const maxNBackReached = cs.maxNBackReached ?? gameResults?.maxNBackReached
        ?? Math.max(...blocks.map(b => b?.nBack || 0).filter(n => n > 0), nBackPlayed || 0);
    const totalDurationMs = durationMs
        ?? blocks.reduce((s, b) => s + (b?.durationMs || 0), 0)
        ?? 0;

    // --- Chain-wide aggregate stats, recomputed from per-block data ---
    // The top-level gameResults per-modality counts / d′ are the FINAL session's (a chain
    // is composed from the last per-block save response), so feeding them to the accuracy
    // formula alongside the whole-chain totalTrials inflated accuracy toward 100%. Aggregate
    // from chainSummary.blocks instead. See src/utils/chainAggregate.js.
    const agg = useMemo(() => aggregateChainStats(blocks, gameMode), [blocks, gameMode]);
    const displayAcc = agg.accuracy;
    const overallDprime = agg.overallDprime;

    // gameResults with chain-aggregate per-modality fields substituted for the inherited
    // final-session values, so the Channel cards in both tabs render the whole chain.
    // Median RT is omitted (null): a true pooled median needs raw hit latencies, which
    // aren't carried per block — the per-session rows still show each session's median.
    const aggregatedGameResults = useMemo(() => {
        const flat = { overallDprime };
        for (const m of ['visual', 'audio', 'color', 'shape']) {
            const md = agg.byModality[m];
            flat[`${m}Correct`] = md ? md.correct : null;
            flat[`${m}TargetCount`] = md ? md.targetCount : null;
            flat[`${m}FalseAlarms`] = md ? md.falseAlarms : null;
            flat[`${m}Dprime`] = md ? md.dprime : null;
            flat[`${m}HitRTMedian`] = null;
        }
        return { ...gameResults, ...flat };
    }, [gameResults, agg, overallDprime]);

    const thresholdsValid = excellentThreshold !== null && goodThreshold !== null && fairThreshold !== null;
    // Shared with progressionLogic RULE 1 clause A and free-tier snapping.
    const veryGoodT = thresholdsValid ? computeVeryGoodThreshold({ goodThreshold, excellentThreshold }) : null;

    const performanceCategory = isClassicMode
        ? getClassicPerformanceCategory(displayAcc.overall)
        : getPerformanceCategory(overallDprime, excellentThreshold, goodThreshold, fairThreshold, veryGoodT);

    const performanceDisplay = getPerformanceDisplay(performanceCategory, isClassicMode);

    // --- Classic chain outcome (for review prompt) ---
    const levelChange = useMemo(() => {
        if (!isClassicMode) return null;
        const startN = preSessionProfileContext?.originalNBack ?? nBackPlayed;
        if (newNBack > startN) return 'up';
        if (newNBack < startN) return 'down';
        return 'stay';
    }, [isClassicMode, newNBack, preSessionProfileContext?.originalNBack, nBackPlayed]);

    // --- Action buttons (Continue / Retry / Go-up / Manual N±1) ---
    // Mirrors GameResults' actionButtons pattern (lines 588-611) but scoped to chain
    // semantics: Continue = backend's chain-end progression; Retry = level user left
    // off on (final block); Go-up (Adaptive) = N+1 D=0.00 when chain aggregates warrant it.
    const actionButtons = useMemo(() => {
        if (!Array.isArray(blocks) || blocks.length === 0) return [];
        const finalBlock = blocks[blocks.length - 1];
        if (!finalBlock || typeof finalBlock.nBack !== 'number') return [];

        const finalN = finalBlock.nBack;
        const finalD = typeof finalBlock.difficulty === 'number' ? finalBlock.difficulty : 0;
        const chainStartN = preSessionProfileContext?.originalNBack ?? blocks[0]?.nBack ?? finalN;
        const algoN = typeof newNBack === 'number' ? newNBack : finalN;
        const algoD = typeof newDifficulty === 'number' ? newDifficulty : finalD;

        const continueLabel = isClassicMode
            ? `Continue at N=${algoN}`
            : `Continue at ${formatCombinedDifficulty(algoN, algoD)}`;
        const retryLabel = isClassicMode
            ? `Retry at N=${finalN}`
            : `Retry at ${formatCombinedDifficulty(finalN, finalD)}`;

        const continueBtn = {
            key: 'continue',
            text: continueLabel,
            title: continueLabel,
            style: 'primary',
            overrideNBack: algoN,
            overrideDifficulty: algoD,
            overrideLevelLabel: isClassicMode ? `N=${algoN}` : formatCombinedDifficulty(algoN, algoD),
        };
        const retryBtn = {
            key: 'retry',
            text: retryLabel,
            title: retryLabel,
            style: 'secondary',
            overrideNBack: finalN,
            overrideDifficulty: finalD,
            overrideLevelLabel: isClassicMode ? `N=${finalN}` : formatCombinedDifficulty(finalN, finalD),
        };

        // Hide Retry when it equals Continue (round D to 100ths to dodge float noise).
        const retrySameAsContinue = continueBtn.overrideNBack === retryBtn.overrideNBack
            && Math.round((continueBtn.overrideDifficulty ?? 0) * 100) === Math.round((retryBtn.overrideDifficulty ?? 0) * 100);

        // ---- Manual Classic ----
        if (isClassicMode && !classicAutoLevel) {
            // Manual classic: Continue at chain N, plus optional N+1 / N-1.
            // Override the "continueLabel/algoN" with chain N (we're ignoring the algo's
            // suggestion in manual mode — the user controls progression themselves).
            const manualContinue = {
                ...continueBtn,
                text: `Continue at N=${chainStartN}`,
                title: `Continue at N=${chainStartN}`,
                overrideNBack: chainStartN,
                overrideDifficulty: 0.50,
                overrideLevelLabel: `N=${chainStartN}`,
            };
            const upBtn = chainStartN < 20 ? {
                key: 'manual-up',
                text: `N=${chainStartN + 1}`,
                title: `Go up to N-Back ${chainStartN + 1}`,
                style: 'secondary',
                overrideNBack: chainStartN + 1,
                overrideDifficulty: 0.50,
                overrideLevelLabel: `N=${chainStartN + 1}`,
            } : null;
            const downBtn = chainStartN > 1 ? {
                key: 'manual-down',
                text: `N=${chainStartN - 1}`,
                title: `Go down to N-Back ${chainStartN - 1}`,
                style: 'secondary',
                overrideNBack: chainStartN - 1,
                overrideDifficulty: 0.50,
                overrideLevelLabel: `N=${chainStartN - 1}`,
            } : null;
            return [manualContinue, downBtn, upBtn].filter(Boolean);
        }

        // ---- Manual Adaptive (adaptiveAutoLevel off) ----
        // The backend froze the stored level at the chain anchor; Continue targets that
        // anchor (not the algo suggestion). No Go-up — the user controls progression.
        // Level stepping lives on the single-session results screen.
        if (!isClassicMode && isManualAdaptive) {
            const anchorD = typeof preSessionProfileContext?.originalDifficulty === 'number'
                ? preSessionProfileContext.originalDifficulty
                : (typeof blocks[0]?.difficulty === 'number' ? blocks[0].difficulty : finalD);
            const anchorLabel = formatCombinedDifficulty(chainStartN, anchorD);
            const manualContinue = {
                ...continueBtn,
                text: `Continue at ${anchorLabel}`,
                title: `Continue at ${anchorLabel}`,
                overrideNBack: chainStartN,
                overrideDifficulty: anchorD,
                overrideLevelLabel: anchorLabel,
            };
            const retrySameAsManual = manualContinue.overrideNBack === retryBtn.overrideNBack
                && Math.round((manualContinue.overrideDifficulty ?? 0) * 100) === Math.round((retryBtn.overrideDifficulty ?? 0) * 100);
            return retrySameAsManual ? [manualContinue] : [manualContinue, retryBtn];
        }

        // ---- Adaptive: per-block evidence drives Go-up gating ----
        // The server's per-block `promoted` flag decides (Sept 2026 credit-aware backend).
        // The disjunction re-derivation below is a fallback for pre-Sept-2026 responses:
        //   (A) difficulty >= 0.50 AND d' >= veryGood, or
        //   (B) difficulty >= 0.99 AND d' >= good.
        // Secondary "Go up" still appears whenever any block reached 0.50+; it becomes
        // PRIMARY only when some block actually promoted (server flag) or, for legacy
        // responses, would have under the old rule (per-block d' and thresholds, not
        // chain aggregates).
        if (!isClassicMode) {
            const chainGood = (typeof goodThreshold === 'number' && Number.isFinite(goodThreshold))
                ? goodThreshold
                : DPRIME_THRESHOLDS_INTERPRETATION.GOOD;
            const chainVeryGood = veryGoodT !== null
                ? veryGoodT
                : DPRIME_THRESHOLDS_INTERPRETATION.VERY_GOOD;
            const EPSILON = 0.005;
            const anyBlockHitFloor = blocks.some(b => (b?.difficulty ?? 0) >= 0.50 - EPSILON);
            // Sept 2026: blocks saved by the credit-aware backend carry `promoted` — the
            // server's actual decision for that block's save. Prefer it. The legacy per-block
            // re-derivation below only runs for blocks from older responses (field absent);
            // it cannot know about credits, so it may over-promise a primary Go-up there.
            const serverDecided = blocks.some(b => typeof b?.promoted === 'boolean');
            const promotingBlock = serverDecided
                ? blocks.find(b => b?.promoted === true)
                : blocks.find(b => {
                    const d = b?.difficulty ?? 0;
                    const dp = b?.overallDprime;
                    if (!Number.isFinite(dp)) return false;
                    // Prefer the block's own thresholds (present on blocks written by the
                    // Aug 2026 backend); fall back to the chain-level values otherwise.
                    const blockGood = (typeof b?.goodThreshold === 'number' && Number.isFinite(b.goodThreshold))
                        ? b.goodThreshold
                        : chainGood;
                    const blockVeryGood = computeVeryGoodThreshold(b) ?? chainVeryGood;
                    const meetsMax = d >= 0.99 - EPSILON && dp >= blockGood;
                    const meetsEarly = d >= 0.50 - EPSILON && dp >= blockVeryGood;
                    return meetsMax || meetsEarly;
                });

            const showGoUp = anyBlockHitFloor && chainStartN < 20;
            const goUpIsPrimary = showGoUp && promotingBlock != null;

            const goUpBtn = showGoUp ? {
                key: 'go-up',
                text: `Go up to N=${chainStartN + 1}`,
                title: `Promote to N=${chainStartN + 1} (D=0.00)`,
                style: goUpIsPrimary ? 'primary' : 'secondary',
                overrideNBack: chainStartN + 1,
                overrideDifficulty: 0.0,
                overrideLevelLabel: formatCombinedDifficulty(chainStartN + 1, 0.0),
            } : null;

            // Hide Continue if the algo already promoted to the same level Go-up offers.
            const continueSameAsGoUp = goUpBtn != null
                && continueBtn.overrideNBack === goUpBtn.overrideNBack
                && Math.round((continueBtn.overrideDifficulty ?? 0) * 100) === Math.round((goUpBtn.overrideDifficulty ?? 0) * 100);

            // When Go-up is primary, demote Continue to secondary.
            const adjustedContinue = goUpIsPrimary
                ? { ...continueBtn, style: 'secondary' }
                : continueBtn;

            const list = [];
            if (goUpIsPrimary && goUpBtn) list.push(goUpBtn);
            if (!continueSameAsGoUp) list.push(adjustedContinue);
            if (!retrySameAsContinue) list.push(retryBtn);
            if (!goUpIsPrimary && goUpBtn) list.push(goUpBtn);

            // Safety net: Continue is dropped when it duplicates Go-up, so if Go-up did
            // not qualify as primary the screen would render only secondaries and lose
            // its CTA. That happens whenever this client's per-block promotion check
            // disagrees with the server's (the server recomputes d' from the driving
            // block's sequence, so a borderline block can fall either side). Promote the
            // first button rather than depend on the two mirrors agreeing exactly.
            if (list.length > 0 && !list.some(b => b.style === 'primary')) {
                list[0] = { ...list[0], style: 'primary' };
            }
            return list;
        }

        // ---- Auto-level Classic ----
        return retrySameAsContinue ? [continueBtn] : [continueBtn, retryBtn];
    }, [
        blocks, isClassicMode, classicAutoLevel, isManualAdaptive,
        newNBack, newDifficulty, overallDprime, goodThreshold, veryGoodT,
        preSessionProfileContext?.originalNBack,
        preSessionProfileContext?.originalDifficulty,
    ]);

    const primaryButton = actionButtons.find(b => b.style === 'primary');

    // Promotion credits (Sept 2026): the last block's response carries the post-chain count.
    const chainStartNForCredits = preSessionProfileContext?.originalNBack ?? blocks[0]?.nBack ?? null;
    // Hidden when any block already promoted: per-block saves can promote on block 3 while
    // blocks 4-5 (still played at the old N) re-bank credits, so the final response shows
    // newNBack === chainStartN with a fresh count even though "Go up" is the primary CTA.
    const showPromotionCredits = !isClassicMode && !isManualAdaptive
        && !progressionSkipped
        && typeof promotionCreditsRequired === 'number'
        && typeof newPromotionCredits === 'number' && newPromotionCredits > 0
        && typeof chainStartNForCredits === 'number'
        && !(typeof newNBack === 'number' && newNBack > chainStartNForCredits)
        && !blocks.some(b => b?.promoted === true);

    // --- Effects: gifted Pro trial threshold trigger (mirror GameResults) ---
    useEffect(() => {
        if (gameResults?.totalSessions >= FREE_TRIAL_SESSION_THRESHOLD && canStartFreeTrial) {
            setShowFreeTrialOffer(true);
        }
    }, [gameResults?.totalSessions, canStartFreeTrial, setShowFreeTrialOffer]);

    // --- Record chain completion for fatigue detection + analytics ---
    useEffect(() => {
        if (sessionId && sessionId !== lastRecordedSessionIdRef.current) {
            lastRecordedSessionIdRef.current = sessionId;
            recordSessionCompletion({
                nBack: nBackPlayed,
                difficulty: gameResults?.difficulty,
                overallDprime,
                gameMode,
            });
            trackEvent('continuous_chain_complete', {
                game_mode: gameMode,
                training_mode: trainingMode,
                chain_blocks: totalBlocks,
                max_n_back: maxNBackReached,
                d_prime: overallDprime,
                duration_sec: totalDurationMs ? Math.round(totalDurationMs / 1000) : undefined,
            });
        }
    }, [
        sessionId, recordSessionCompletion, nBackPlayed, gameResults?.difficulty,
        overallDprime, gameMode, trainingMode, totalBlocks, maxNBackReached, totalDurationMs,
    ]);

    // --- Daily Adaptive cap: chain ended early ---
    // GameContext flags the summary (client-only) when a capped cohort ran out of daily
    // Adaptive credits mid-chain. Surface the same upsell the single-session flow uses,
    // once per chain so a dismissal doesn't re-open on the next render.
    const endedByDailyCap = cs.endedByDailyCap === true;
    // Real used count for the modal; saves have drained by the time results render,
    // so this reflects the final server count. Falls back to the cap if the local
    // counter is somehow behind (a cap-ended chain implies the cap was reached).
    const { used: capUsedToday } = useDailyCapStatus();
    const capModalFiredForChainRef = useRef(null);
    useEffect(() => {
        if (!endedByDailyCap) return;
        const chainKey = cs.chainId || sessionId || 'chain';
        if (capModalFiredForChainRef.current === chainKey) return;
        capModalFiredForChainRef.current = chainKey;
        if (typeof setDailyCapInfo === 'function') {
            setDailyCapInfo({
                sessionsUsed: capUsedToday > 0 ? capUsedToday : DAILY_ADAPTIVE_CAP,
                dailyCap: DAILY_ADAPTIVE_CAP,
                source: 'chain_end',
            });
        }
        if (typeof setShowDailyCapModal === 'function') {
            setShowDailyCapModal(true);
        }
        trackEvent('daily_cap_reached', { source: 'continuous_chain_end' });
    }, [endedByDailyCap, cs.chainId, sessionId, setDailyCapInfo, setShowDailyCapModal, capUsedToday]);

    // --- Review prompt hook (mirrors GameResults usage) ---
    useReviewPrompt({
        levelChange,
        newNBack,
        nBackPlayed,
        isNewHighestNBackGood: gameResults?.isNewHighestNBackGood,
        performanceCategory,
        totalSessions: gameResults?.totalSessions,
        sessionId,
    });

    // --- Keyboard handlers: Enter → primary, ←/→ → tab swap ---
    const handleButtonAction = useCallback((btn) => {
        if (typeof onStartNextSession !== 'function') return;
        if (!btn) {
            onStartNextSession();
            return;
        }
        onStartNextSession({
            overrideNBack: btn.overrideNBack,
            overrideDifficulty: btn.overrideDifficulty,
            overrideLevelLabel: btn.overrideLevelLabel,
        });
    }, [onStartNextSession]);

    const handlePrimaryAction = useCallback(() => {
        handleButtonAction(primaryButton);
    }, [handleButtonAction, primaryButton]);

    useEffect(() => {
        const handler = (e) => {
            if (shouldShowFatigueWarning) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                handlePrimaryAction();
                return;
            }
            const tabs = ['overview', 'detailed', 'sequence'];
            const i = tabs.indexOf(activeTab);
            if (e.key === 'ArrowLeft' && i > 0) {
                e.preventDefault();
                setActiveTab(tabs[i - 1]);
            } else if (e.key === 'ArrowRight' && i < tabs.length - 1) {
                e.preventDefault();
                setActiveTab(tabs[i + 1]);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [activeTab, handlePrimaryAction, shouldShowFatigueWarning]);

    // --- Note handlers ---
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

    // --- Fatigue warning handlers ---
    const handleFatigueContinue = useCallback(() => dismissFatigueWarning(), [dismissFatigueWarning]);
    const handleFatigueTakeBreak = useCallback(() => {
        handleTakeBreak();
        if (typeof onDashboard === 'function') onDashboard();
    }, [handleTakeBreak, onDashboard]);

    // --- Promotional card rotation (mirror GameResults logic, skip classic-adaptive upsell) ---
    const trackCardClick = (linkName) => trackEvent('continuous_results_card_click', { link_name: linkName });

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
                <a href="https://www.reddit.com/r/DualnBack/" target="_blank" rel="noopener noreferrer" onClick={() => trackCardClick('reddit')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors">
                    <FontAwesomeIcon icon={faReddit} className="w-3.5 h-3.5 text-[#FF4500]" />
                    Reddit
                </a>
                <a href="https://discord.gg/yC48K6qM4s" target="_blank" rel="noopener noreferrer" onClick={() => trackCardClick('discord')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors">
                    <FontAwesomeIcon icon={faDiscord} className="w-3.5 h-3.5 text-[#5865F2]" />
                    Discord
                </a>
                <a href="https://groups.google.com/g/brain-training" target="_blank" rel="noopener noreferrer" onClick={() => trackCardClick('google_groups')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors">
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
            <a href="https://dualnback.com/articles/how-to-guides/intuitive-vs-rehearsal-strategies/" target="_blank" rel="noopener noreferrer" onClick={() => trackCardClick('article_intuitive_vs_rehearsal')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono text-theme-text-secondary border border-theme-line/70 bg-theme-bg-elevated/50 hover:border-theme-text-muted/50 transition-colors">
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
                Save your thoughts on this chain — strategies you tried, what you noticed, or how you felt. Use the Note button in the top right of this page.
            </p>
        </div>
    );

    const promotionalCards = sessionId ? [communityCard, articleCard, noteCard] : [communityCard, articleCard];
    const poolIndex = (readinessSessionCount ?? 0) % promotionalCards.length;
    const selectedCard = promotionalCards[poolIndex];

    // --- Render guard ---
    if (!gameResults) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="text-theme-neural-red font-mono text-sm uppercase tracking-wider">
                    Error: Chain data unavailable
                </div>
            </div>
        );
    }

    const continuousModeLabel = isClassicMode ? 'Continuous · Classic' : 'Continuous · Adaptive';

    return (
        <div
            data-game-active={true}
            className={`min-h-screen bg-theme-bg flex items-center justify-center p-4 sm:p-6 ${!isPro ? 'pt-16' : ''}`}
        >
            {/* Visual mirror of GameResults lines 779–796 — keep in sync */}
            <div className="fixed inset-0 pointer-events-none">
                <div
                    className="absolute inset-0 opacity-20"
                    style={{
                        backgroundImage: `
                            linear-gradient(var(--color-line) 1px, transparent 1px),
                            linear-gradient(90deg, var(--color-line) 1px, transparent 1px)
                        `,
                        backgroundSize: '32px 32px',
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--color-bg-primary) 70%, transparent) 100%)',
                    }}
                />
            </div>

            {/* Main Results Panel — visual mirror of GameResults lines 799–1684, keep in sync */}
            <div className="relative z-10 bg-theme-bg-secondary border border-theme-line w-full max-w-2xl">
                {/* Top Accent Line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-accent/50 to-transparent" />

                {/* Top bar */}
                <div className="border-b border-theme-line px-4 sm:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 ${performanceDisplay.textClass}`} style={{ background: 'currentColor' }} />
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Chain Analysis
                        </span>
                    </div>
                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                        {continuousModeLabel}
                    </div>
                </div>

                {/* Header — title + badges + top-right buttons. Grid mirrors GameResults.js so the
                    note button aligns with the "Chain Complete" title row and the today-totals chips
                    right-align on desktop. */}
                <div className="px-4 sm:px-6 py-5 border-b border-theme-line">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-x-4 gap-y-3 items-start">
                        {/* display:contents so the title (row1/col1), badges (row2 span), and buttons
                            (row1/col2) all participate directly in the grid. */}
                        <div className="contents">
                            <h1 className="font-serif text-xl sm:text-2xl text-theme-text sm:col-start-1 sm:row-start-1">
                                Chain Complete
                            </h1>
                            <div className="flex flex-wrap gap-2 items-center sm:col-start-1 sm:col-span-2 sm:row-start-2">
                                <span className={`inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border ${performanceDisplay.bgClass} ${performanceDisplay.borderClass} ${performanceDisplay.textClass}`}>
                                    {performanceDisplay.text}
                                </span>
                                {totalDurationMs > 0 && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted">
                                        {formatDuration(totalDurationMs)}
                                    </span>
                                )}
                                {totalBlocks > 0 && (
                                    <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted">
                                        {totalBlocks} {totalBlocks === 1 ? 'session' : 'sessions'}
                                    </span>
                                )}
                                {/* Today totals (sessions + time trained today) — grouped and pushed right
                                    on desktop via sm:ml-auto; wraps to its own line on mobile. */}
                                {gameResults?.todaySessionCount > 0 && (
                                    <div className="flex flex-wrap gap-2 items-center sm:ml-auto">
                                        <span className="inline-flex items-center px-3 py-1 text-xs font-mono uppercase tracking-wider border border-theme-line bg-theme-bg-elevated text-theme-text-muted whitespace-nowrap">
                                            {gameResults.todaySessionCount} session{gameResults.todaySessionCount === 1 ? '' : 's'} today
                                        </span>
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

                        {/* Note button (Replay omitted — no per-block replays). Aligned to the title row. */}
                        <div className="flex items-center gap-2 sm:col-start-2 sm:row-start-1 sm:justify-self-end">
                            {sessionId && !isNoteEditing && !noteSaved && (
                                <button
                                    onClick={() => setIsNoteEditing(true)}
                                    className="px-3 py-2 text-xs font-mono uppercase tracking-wider
                                             text-theme-text-secondary hover:text-theme-text
                                             border border-theme-line hover:border-theme-accent/50
                                             bg-theme-bg-elevated hover:bg-theme-bg-surface
                                             transition-all duration-150 flex items-center gap-2"
                                    title="Add a note to this chain"
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

                {/* Note editor — visual mirror of GameResults lines 912–961 */}
                {isNoteEditing && (
                    <div className="px-4 sm:px-6 py-3 border-b border-theme-line bg-theme-bg-elevated/50">
                        <textarea
                            value={noteText}
                            onChange={(e) => { setNoteText(e.target.value); setNoteError(null); }}
                            maxLength={500}
                            rows={2}
                            placeholder="Add a note about this chain..."
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

                {/* Tabs nav — visual mirror of GameResults lines 964–1009 */}
                <div className="border-b border-theme-line">
                    <nav className="flex px-4 sm:px-6 items-center justify-between" aria-label="Tabs">
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('overview')}
                                className={`py-3 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === 'overview'
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                            >
                                Overview
                            </button>
                            <button
                                onClick={() => setActiveTab('detailed')}
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
                                onClick={() => setActiveTab('sequence')}
                                className={`py-3 px-4 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
                                    activeTab === 'sequence'
                                        ? 'border-theme-accent text-theme-accent'
                                        : 'border-transparent text-theme-text-muted hover:text-theme-text-secondary'
                                }`}
                            >
                                Sequence
                            </button>
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 text-theme-text-muted">
                            <kbd className="px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg rounded border border-theme-line">←</kbd>
                            <kbd className="px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg rounded border border-theme-line">→</kbd>
                        </div>
                    </nav>
                </div>

                {/* Tab content */}
                <div className="p-4 sm:p-6">
                    {activeTab === 'overview' && (
                        <ChainOverviewTab
                            gameResults={aggregatedGameResults}
                            displayAcc={displayAcc}
                            performanceCategory={performanceCategory}
                            performanceDisplay={performanceDisplay}
                            isClassicMode={isClassicMode}
                            selectedCard={selectedCard}
                            formatNum={formatNum}
                            formatAcc={formatAcc}
                            veryGoodT={veryGoodT}
                        />
                    )}
                    {activeTab === 'detailed' && (
                        <ChainDetailedTab
                            gameResults={aggregatedGameResults}
                            displayAcc={displayAcc}
                            performanceCategory={performanceCategory}
                            isClassicMode={isClassicMode}
                            veryGoodT={veryGoodT}
                            totalTrials={totalTrials}
                            totalDurationMs={totalDurationMs}
                            totalBlocks={totalBlocks}
                            formatNum={formatNum}
                            formatAcc={formatAcc}
                            blocks={blocks}
                            newNBack={newNBack}
                            newDifficulty={newDifficulty}
                        />
                    )}
                    {activeTab === 'sequence' && (
                        <ChainSequenceTab
                            blocks={blocks}
                            gameMode={gameMode}
                            isClassicMode={isClassicMode}
                        />
                    )}
                </div>

                {/* Action footer — visual mirror of GameResults lines 1627–1680 */}
                <div className="px-4 sm:px-6 py-4 bg-theme-bg-elevated border-t border-theme-line">
                    <div className="space-y-3">
                        {/* Dynamic chains still read "N+1" here, matching this screen's existing Go-up button (pre-existing gap, follow-up). */}
                        {showPromotionCredits && (
                            <PromotionCreditsCard
                                credits={newPromotionCredits}
                                required={promotionCreditsRequired}
                                nBack={chainStartNForCredits}
                                unit="block"
                                destinationLabel={`${chainStartNForCredits + 1}-back`}
                            />
                        )}
                        {typeof onStartNextSession === 'function' && actionButtons.length > 0 && (
                            <div className={`grid gap-3 ${
                                actionButtons.length === 3 ? 'grid-cols-1 sm:grid-cols-3'
                                : actionButtons.length === 2 ? 'grid-cols-1 sm:grid-cols-2'
                                : 'grid-cols-1'
                            }`}>
                                {actionButtons.map(btn => (
                                    <button
                                        key={btn.key}
                                        onClick={() => handleButtonAction(btn)}
                                        className={`w-full px-4 py-3 text-sm font-mono uppercase tracking-wider
                                                 transition-all duration-150 flex items-center justify-center gap-2
                                                 ${btn.style === 'primary'
                                                     ? 'bg-theme-accent hover:bg-theme-accent-hover text-theme-bg border border-theme-accent'
                                                     : 'bg-theme-bg-elevated hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text border border-theme-line hover:border-theme-accent/50'
                                                 }`}
                                        title={btn.title}
                                    >
                                        {btn.text}
                                        {btn.style === 'primary' && (
                                            <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[0.75rem] font-mono bg-theme-bg/20 rounded border border-charcoal/30">
                                                Enter ↵
                                            </kbd>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Dashboard button */}
                        {typeof onDashboard === 'function' && (
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
                        )}
                    </div>
                </div>

                {/* Bottom Accent Line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-theme-line to-transparent" />
            </div>

            {/* Fatigue Warning Modal */}
            <FatigueWarningModal
                isOpen={shouldShowFatigueWarning}
                onContinue={handleFatigueContinue}
                onTakeBreak={handleFatigueTakeBreak}
                consecutiveCount={consecutiveSessionCount}
                declineData={declineData}
            />

            {/* Daily Adaptive cap modal — opened when the chain ended at the cap, and by
                the "Start Another Session" pre-start gate in GameScreen. State is
                single-instance in UserContext and the modal portals to document.body,
                so mounting it here alongside the other surfaces is safe. */}
            <DailyCapModal
                isOpen={!!showDailyCapModal}
                onClose={() => setShowDailyCapModal(false)}
                dailyCapInfo={dailyCapInfo}
            />
        </div>
    );
};

export default ContinuousResults;
