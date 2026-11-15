/* src/components/testing/trainer/TrainerPanel.js */
/**
 * Generic landing panel for an adaptive Trainer (shared chassis), rendered inside
 * a task's SummaryPage when the (owner-gated) toggle is on "Trainer". Pro-gated.
 * Four cards: Overview + Practice (level/best + Start), History (level-over-time
 * chart + period toggle), Recent Sessions (log), FAQ. Everything task-specific
 * (copy, level noun, callable name, start route, faqs) comes from `config`.
 *
 * Re-fetches progress whenever `config.fetchKey` changes (e.g. the digit-span
 * Forward/Backward sub-toggle passes a direction-keyed config).
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../../contexts/UserContext';
import { canAccessProAssessments } from '../../../utils/assessmentAccess';
import { trackEvent } from '../../../utils/analyticsTracker';
import { functions, httpsCallable } from '../../../firebaseConfig';
import TrainerChart from './TrainerChart';
import TrainerFaq from './TrainerFaq';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faDumbbell, faTrophy, faPlay, faLock, faSpinner,
    faChevronDown, faChevronUp, faArrowUp, faArrowDown, faMinus,
} from '@fortawesome/free-solid-svg-icons';

const PERIODS = ['today', 'week', 'month', 'all'];
const DEFAULT_VISIBLE = 20;
const HISTORY_CAP = 120;

const fmtDateTime = (iso) =>
    iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

const CardHeader = ({ title, subtitle }) => (
    <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-theme-accent" />
        <div>
            <h2 className="text-lg font-serif italic text-theme-text">{title}</h2>
            <p className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-wider">{subtitle}</p>
        </div>
    </div>
);
CardHeader.propTypes = { title: PropTypes.string, subtitle: PropTypes.string };

const StatBox = ({ icon, label, children }) => (
    <div className="bg-theme-bg-elevated border border-theme-line p-3 text-center">
        <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mb-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={icon} className="h-2.5 w-2.5" />{label}
        </p>
        <p className="text-2xl font-mono text-theme-text">{children}</p>
    </div>
);
StatBox.propTypes = { icon: PropTypes.object, label: PropTypes.string, children: PropTypes.node };

const TrainerPanel = ({ config }) => {
    const {
        title, subtitle, description, footnote,
        levelLabel = 'Level', levelTag = 'L', maxLevel = 99, showMaxBadge = true,
        formatLevel = (n) => `${levelLabel} ${n}`,
        progressFnName, progressData = {}, fetchKey,
        startRoute, startNavState, beforeStart,
        locked = {}, faqs = [], faqSubtitle = subtitle,
        icon = faDumbbell,
        requiresPro = true,
    } = config;

    const { userData, subscriptionTier } = useUser();
    const navigate = useNavigate();
    // requiresPro: false = free trainer (e.g. Operation Span) — no Pro gate, no locked card.
    const canAccess = useMemo(
        () => (requiresPro === false ? true : canAccessProAssessments(userData, subscriptionTier)),
        [requiresPro, userData, subscriptionTier]
    );

    const [progression, setProgression] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('week');
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        let active = true;
        if (!canAccess) { setLoading(false); return undefined; }
        setLoading(true);
        (async () => {
            try {
                const getProgress = httpsCallable(functions, progressFnName);
                const res = await getProgress(progressData);
                if (!active) return;
                setProgression(res.data?.progression || null);
                setSessions(Array.isArray(res.data?.sessions) ? res.data.sessions : []);
            } catch (e) {
                console.warn('[TrainerPanel] progress load failed:', e?.message);
                if (active) { setProgression(null); setSessions([]); }
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canAccess, fetchKey, progressFnName]);

    const handleStart = useCallback(() => {
        if (typeof beforeStart === 'function') beforeStart();
        navigate(startRoute, { state: startNavState || { autoStart: true } });
    }, [beforeStart, navigate, startRoute, startNavState]);

    if (!canAccess) {
        return (
            <section className="specimen-card p-6 text-center mb-8">
                <div className="h-12 w-12 mx-auto mb-4 bg-theme-bg-elevated border border-theme-line flex items-center justify-center text-theme-text-muted">
                    <FontAwesomeIcon icon={faLock} className="h-5 w-5" />
                </div>
                <h2 className="font-serif italic text-lg text-theme-text mb-2">{locked.title || title}</h2>
                <p className="text-sm text-theme-text-secondary max-w-md mx-auto mb-4">
                    {locked.body || 'This adaptive trainer is a Pro feature.'}
                </p>
                <button onClick={() => {
                    trackEvent('trainer_locked_cta_clicked', { task: title });
                    navigate(locked.upgradeRoute || '/subscribe');
                }}
                    className="btn-primary-lab px-6 py-2.5 text-sm font-mono uppercase tracking-wider">
                    See Pro
                </button>
            </section>
        );
    }

    const level = progression?.level ?? null;
    const bestLevel = progression?.bestLevel ?? null;
    const visibleSessions = showAll ? sessions.slice(0, HISTORY_CAP) : sessions.slice(0, DEFAULT_VISIBLE);
    const extraCount = Math.min(sessions.length, HISTORY_CAP) - DEFAULT_VISIBLE;

    return (
        <div className="space-y-6 mb-8">
            {/* Card 1 — Overview + Practice */}
            <section className="specimen-card p-5 sm:p-6">
                <CardHeader title={title} subtitle={subtitle} />
                <p className="text-theme-text-secondary text-sm mt-4 mb-5">{description}</p>

                <div className="grid grid-cols-2 gap-3 max-w-[220px] mb-4">
                    <StatBox icon={faDumbbell} label={levelLabel}>
                        {loading ? (
                            <FontAwesomeIcon icon={faSpinner} spin className="h-4 w-4 text-theme-text-muted" />
                        ) : level == null ? '—' : (showMaxBadge && level >= maxLevel) ? (
                            <span className="text-status-success">{level}<span className="text-xs"> MAX</span></span>
                        ) : showMaxBadge ? (
                            <>{level}<span className="text-sm text-theme-text-muted">/{maxLevel}</span></>
                        ) : level}
                    </StatBox>
                    <StatBox icon={faTrophy} label="Best">{loading ? '—' : (bestLevel ?? '—')}</StatBox>
                </div>
                <button
                    onClick={handleStart}
                    className="btn-primary-lab py-2.5 px-8 text-sm inline-flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faPlay} className="h-4 w-4" /><span>Start Session</span>
                </button>

                <p className="text-theme-text-muted text-xs leading-relaxed mt-5 pt-4 border-t border-theme-line">{footnote}</p>
            </section>

            {/* Card 2 — History */}
            <section className="specimen-card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <CardHeader title="History" subtitle={`${levelLabel} Over Time`} />
                    <div className="flex border-b border-theme-line self-start">
                        {PERIODS.map((p) => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                aria-pressed={period === p}
                                className={`tab-lab px-3 py-1.5 text-[0.6875rem] font-mono uppercase tracking-wider transition-colors ${period === p ? 'active text-theme-accent' : 'text-theme-text-muted hover:text-theme-text-secondary'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="h-56 flex items-center justify-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="h-5 w-5 text-theme-text-muted" />
                    </div>
                ) : (
                    <TrainerChart sessions={sessions} period={period} formatLevel={formatLevel} maxLevel={maxLevel} />
                )}
            </section>

            {/* Card 3 — Recent Sessions */}
            <section className="specimen-card p-5 sm:p-6">
                <CardHeader title="Recent Sessions" subtitle="Session Log" />
                <div className="mt-4">
                    {(!loading && visibleSessions.length === 0) ? (
                        <p className="text-xs font-mono text-theme-text-muted">No sessions yet — start one above.</p>
                    ) : (
                        <ul className="divide-y divide-theme-line">
                            {visibleSessions.map((s) => {
                                const delta = (s.endLevel != null && s.startLevel != null) ? s.endLevel - s.startLevel : 0;
                                const dIcon = delta > 0 ? faArrowUp : (delta < 0 ? faArrowDown : faMinus);
                                const dColor = delta > 0 ? 'text-status-success' : (delta < 0 ? 'text-status-warning' : 'text-theme-text-muted');
                                return (
                                    <li key={s.id} className="flex items-center justify-between py-2 text-xs font-mono">
                                        <span className="text-theme-text-secondary">{fmtDateTime(s.timestamp)}</span>
                                        <span className="flex items-center gap-3">
                                            <span className="text-theme-text-muted">{typeof s.accuracy === 'number' ? `${Math.round(s.accuracy * 100)}%` : '—'}</span>
                                            <span className={`flex items-center gap-1 ${dColor}`}>
                                                <FontAwesomeIcon icon={dIcon} className="h-2.5 w-2.5" />{levelTag}{s.endLevel ?? '—'}
                                            </span>
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {extraCount > 0 && (
                        <button
                            onClick={() => setShowAll((v) => !v)}
                            className="mt-3 w-full text-xs font-mono text-theme-text-muted hover:text-theme-accent flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <FontAwesomeIcon icon={showAll ? faChevronUp : faChevronDown} className="h-2.5 w-2.5" />
                            {showAll ? 'Show less' : `Show ${extraCount} more`}
                        </button>
                    )}
                </div>
            </section>

            <TrainerFaq faqs={faqs} subtitle={faqSubtitle} />
        </div>
    );
};

TrainerPanel.propTypes = { config: PropTypes.object.isRequired };

export default TrainerPanel;
