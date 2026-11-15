/* src/components/program/ProgramCalendar.js */

/**
 * 28-day visual calendar grid showing completed/missed/rest/upcoming days.
 * Design: A clean 7-column grid — each cell is a data point in the experiment timeline.
 */

import React, { useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faBed, faTimes, faBolt } from '@fortawesome/free-solid-svg-icons';
import { useCohort } from '../../contexts/CohortContext';

const WEEK_LABELS = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const ProgramCalendar = () => {
    const { programData, programDay, myMemberData } = useCohort();

    const prescriptions = programData?.dailyPrescriptions || [];
    const dailyProgress = myMemberData?.dailyProgress || {};

    // Build 4 weeks of 7 days each
    const weeks = useMemo(() => {
        const result = [];
        for (let w = 0; w < 4; w++) {
            const days = [];
            for (let d = 0; d < 7; d++) {
                const dayNum = w * 7 + d + 1;
                const prescription = prescriptions.find(p => p.day === dayNum);
                const progress = dailyProgress[String(dayNum)];
                const isTraining = prescription?.type === 'training';
                const isRest = prescription?.type === 'rest';
                const isPast = dayNum < programDay;
                const isToday = dayNum === programDay;
                const isFuture = dayNum > programDay;
                const isCompleted = progress?.completed === true;
                const sessionsPlayed = progress?.sessionsPlayed || 0;
                const sessionTarget = prescription?.sessionTarget || 0;

                let status;
                if (isFuture) {
                    status = 'upcoming';
                } else if (isRest) {
                    status = 'rest';
                } else if (isCompleted) {
                    status = 'completed';
                } else if (isPast && isTraining && !isCompleted) {
                    status = sessionsPlayed > 0 ? 'partial' : 'missed';
                } else if (isToday && isTraining) {
                    status = isCompleted ? 'completed' : 'today';
                } else {
                    status = 'upcoming';
                }

                days.push({
                    dayNum,
                    isTraining,
                    isRest,
                    isToday,
                    isPast,
                    isFuture,
                    status,
                    sessionsPlayed,
                    sessionTarget,
                    focusTip: prescription?.focusTip || prescription?.message || '',
                });
            }
            result.push({ weekNum: w + 1, label: WEEK_LABELS[w], days });
        }
        return result;
    }, [prescriptions, dailyProgress, programDay]);

    // Stats
    const totalTrainingDays = prescriptions.filter(p => p.type === 'training').length;
    const completedDays = myMemberData?.daysCompleted || 0;
    const missedDays = useMemo(() => {
        let count = 0;
        for (let d = 1; d < programDay; d++) {
            const p = prescriptions.find(pr => pr.day === d);
            if (p?.type === 'training' && !dailyProgress[String(d)]?.completed) {
                count++;
            }
        }
        return count;
    }, [prescriptions, dailyProgress, programDay]);

    return (
        <div>
            {/* Stats row */}
            <div className="flex items-center gap-4 sm:gap-6 mb-5 flex-wrap">
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-green-500/30 border border-green-500/50" />
                    <span className="text-xs text-theme-text-muted">{completedDays} completed</span>
                </div>
                {missedDays > 0 && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-red-500/20 border border-red-500/30" />
                        <span className="text-xs text-theme-text-muted">{missedDays} missed</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-theme-bg-elevated border border-theme-line" />
                    <span className="text-xs text-theme-text-muted">rest</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border border-dashed border-theme-line" />
                    <span className="text-xs text-theme-text-muted">upcoming</span>
                </div>
            </div>

            {/* Calendar grid */}
            <div className="space-y-4">
                {weeks.map(week => (
                    <div key={week.weekNum}>
                        <p className="text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                            {week.label}
                        </p>
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                            {week.days.map(day => (
                                <CalendarCell key={day.dayNum} day={day} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Overall progress */}
            <div className="mt-6 pt-4 border-t border-theme-line">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-theme-text-muted">Program progress</span>
                    <span className="text-xs font-mono text-theme-text-muted tabular-nums">
                        {completedDays}/{totalTrainingDays} training days
                    </span>
                </div>
                <div className="w-full h-2 bg-theme-line rounded-full overflow-hidden">
                    <div
                        className="h-full bg-theme-accent rounded-full transition-all duration-700"
                        style={{ width: `${totalTrainingDays > 0 ? (completedDays / totalTrainingDays) * 100 : 0}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

const CalendarCell = ({ day }) => {
    const baseClasses = 'relative aspect-square rounded flex flex-col items-center justify-center text-center transition-all';

    let cellClasses;
    let icon = null;

    switch (day.status) {
        case 'completed':
            cellClasses = `${baseClasses} bg-green-500/15 border border-green-500/30`;
            icon = day.sessionsPlayed > day.sessionTarget
                ? <span className="text-[0.625rem] font-mono text-green-500">{day.sessionsPlayed}/{day.sessionTarget}</span>
                : <FontAwesomeIcon icon={faCheck} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-green-500" />;
            break;
        case 'today':
            cellClasses = `${baseClasses} bg-theme-accent/10 border-2 border-theme-accent/50 ring-1 ring-theme-accent/20`;
            icon = <FontAwesomeIcon icon={faBolt} className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-theme-accent" />;
            break;
        case 'partial':
            cellClasses = `${baseClasses} bg-amber-500/10 border border-amber-500/30`;
            icon = <span className="text-[0.625rem] font-mono text-amber-400">{day.sessionsPlayed}/{day.sessionTarget}</span>;
            break;
        case 'missed':
            cellClasses = `${baseClasses} bg-red-500/8 border border-red-500/20`;
            icon = <FontAwesomeIcon icon={faTimes} className="h-3 w-3 text-red-400/60" />;
            break;
        case 'rest':
            cellClasses = `${baseClasses} bg-theme-bg-elevated border border-theme-line`;
            icon = <FontAwesomeIcon icon={faBed} className="h-3 w-3 text-theme-text-muted/40" />;
            break;
        case 'upcoming':
        default:
            cellClasses = `${baseClasses} border border-dashed border-theme-line/50`;
            break;
    }

    return (
        <div className={cellClasses} title={day.focusTip}>
            <span className={`text-[0.625rem] font-mono mb-0.5 ${
                day.isToday ? 'text-theme-accent font-medium' : 'text-theme-text-muted/60'
            }`}>
                {day.dayNum}
            </span>
            {icon}
        </div>
    );
};

export default ProgramCalendar;
