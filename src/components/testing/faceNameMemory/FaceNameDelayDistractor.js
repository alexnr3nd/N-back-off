/* src/components/testing/faceNameMemory/FaceNameDelayDistractor.js */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';

/**
 * Filled-delay distractor between immediate and delayed recall. A domain-neutral
 * arithmetic equation-verification task (research-chosen over n-back: no
 * cross-session learning confound, no face/name modality interference — see
 * docs/plans/2026-06-17-face-name-memory-design.md §Filled-delay). Its only job
 * is to block subvocal rehearsal of the studied names for ~2.5 min. Fully
 * self-contained: it NEVER touches the game engine, progression, or save path.
 * Reports its accuracy (correct/total) on completion (surfaced in results like
 * Counting Span's processing accuracy).
 */
const genProblem = () => {
    const a = 2 + Math.floor(Math.random() * 8);   // 2-9
    const b = 2 + Math.floor(Math.random() * 8);   // 2-9
    const useMinus = Math.random() < 0.5;
    const [x, y] = useMinus && b > a ? [b, a] : [a, b];
    const real = useMinus ? x - y : x + y;
    const correct = Math.random() < 0.5;
    let shown = real;
    if (!correct) {
        shown = real + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 2));
        if (shown === real) shown = real + 1;
    }
    return { text: `${x} ${useMinus ? '−' : '+'} ${y} = ${shown}`, isCorrect: shown === real };
};

const FaceNameDelayDistractor = ({ durationMs, onComplete }) => {
    const [problem, setProblem] = useState(genProblem);
    const [remaining, setRemaining] = useState(Math.ceil(durationMs / 1000));
    const [feedback, setFeedback] = useState(null); // 'right' | 'wrong' | null
    const doneRef = useRef(false);
    const feedbackTimerRef = useRef(null);
    const correctRef = useRef(0);   // arithmetic accuracy (surfaced in results, like Counting Span)
    const totalRef = useRef(0);
    // Stable refs so the countdown effect never has to re-run (which could fire
    // onComplete more than once) and answer() never goes stale on the problem.
    const problemRef = useRef(problem);
    const onCompleteRef = useRef(onComplete);
    useEffect(() => { problemRef.current = problem; }, [problem]);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

    useEffect(() => {
        const start = Date.now();
        const tick = setInterval(() => {
            const left = Math.max(0, durationMs - (Date.now() - start));
            setRemaining((prev) => {
                const next = Math.ceil(left / 1000);
                return next !== prev ? next : prev; // only re-render when the second changes
            });
            if (left <= 0 && !doneRef.current) {
                doneRef.current = true;
                clearInterval(tick);
                if (onCompleteRef.current) onCompleteRef.current({ correct: correctRef.current, total: totalRef.current });
            }
        }, 250);
        return () => {
            clearInterval(tick);
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, [durationMs]);

    const answer = useCallback((said) => {
        if (doneRef.current) return;
        const isRight = said === problemRef.current.isCorrect;
        totalRef.current += 1;
        if (isRight) correctRef.current += 1;
        setFeedback(isRight ? 'right' : 'wrong');
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
            setProblem(genProblem());
        }, 250);
    }, []);

    const totalSecs = Math.max(1, Math.ceil(durationMs / 1000));
    const progress = Math.min(100, Math.max(0, ((totalSecs - remaining) / totalSecs) * 100));
    const mm = Math.floor(remaining / 60);
    const ss = String(remaining % 60).padStart(2, '0');
    const borderColor = feedback === 'right' ? 'border-status-success'
        : feedback === 'wrong' ? 'border-status-error'
            : 'border-theme-line';

    return (
        <div className="w-full max-w-sm mx-auto text-center">
            <p className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-widest mb-4">Mental Break</p>

            {/* Timer bar */}
            <div className="w-full h-1 bg-theme-bg-elevated border border-theme-line overflow-hidden mb-1.5">
                <div className="h-full bg-theme-accent transition-[width] duration-200 ease-linear" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[0.625rem] font-mono text-theme-text-muted uppercase tracking-wider mb-7">
                Faces return in {mm}:{ss}
            </p>

            {/* Equation */}
            <div className={`bg-theme-bg-elevated border ${borderColor} px-6 py-7 mb-6 transition-colors`}>
                <p className="text-4xl font-mono text-theme-text">{problem.text}</p>
            </div>

            {/* Answer */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => answer(true)}
                    className="bg-theme-bg-elevated border border-theme-line py-3.5 text-sm font-mono uppercase tracking-wider text-theme-text-secondary hover:text-status-success hover:border-status-success transition-colors inline-flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faCheck} className="h-3 w-3" /> Correct
                </button>
                <button
                    onClick={() => answer(false)}
                    className="bg-theme-bg-elevated border border-theme-line py-3.5 text-sm font-mono uppercase tracking-wider text-theme-text-secondary hover:text-status-error hover:border-status-error transition-colors inline-flex items-center justify-center gap-2"
                >
                    <FontAwesomeIcon icon={faXmark} className="h-3 w-3" /> Wrong
                </button>
            </div>

            <p className="text-[0.625rem] font-mono text-theme-text-muted/70 uppercase tracking-wider mt-5">
                Is each equation right or wrong? · this keeps the names from being rehearsed
            </p>
        </div>
    );
};

export default FaceNameDelayDistractor;
