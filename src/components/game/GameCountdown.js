/* File: src/components/game/GameCountdown.js */
/* Cognitive Lab Aesthetic - Test Sequence Initialization */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { playCountdownSound } from '../../utils/countdownSounds';
import { formatCombinedDifficulty } from '../../contexts/gameHelpers';
import { PROTOCOL_TIPS } from '../../constants/gameConstants';
import { MODE_LABELS } from '../../constants/modeStyles';

// Detect iOS devices (iPad, iPhone, iPod) for silent mode warning
const getIsIOS = () => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
};

/**
 * GameCountdown Component
 * Laboratory-style countdown sequence before cognitive test begins.
 * Features circular gauge animation and scientific instrumentation aesthetic.
 */
const GameCountdown = ({ onComplete, onCancel, nBack, difficulty, gameMode, isDynamic, trainingMode }) => {
    const [countdown, setCountdown] = useState(3);
    const [pulsing, setPulsing] = useState(false);
    const [paused, setPaused] = useState(false);
    const [coachingTip, setCoachingTip] = useState('');

    const completedRef = useRef(false);
    const prevCountdownRef = useRef(null);
    const isIOS = useMemo(() => getIsIOS(), []);

    // Ring gauge constants
    const ringRadius = 72;
    const ringCircumference = 2 * Math.PI * ringRadius;

    // Sound and pulse effect
    useEffect(() => {
        if (countdown > 0 && prevCountdownRef.current !== countdown) {
            playCountdownSound(countdown);
            prevCountdownRef.current = countdown;

            setPulsing(true);
            const pulseTimer = setTimeout(() => {
                if (!completedRef.current) {
                    setPulsing(false);
                }
            }, 300);

            return () => clearTimeout(pulseTimer);
        }
    }, [countdown]);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0 && !paused) {
            const timer = setTimeout(() => {
                setCountdown(c => c - 1);
            }, 1000);
            return () => clearTimeout(timer);
        } else if (countdown === 0 && !completedRef.current) {
            completedRef.current = true;
            onComplete();
        }
    }, [countdown, onComplete, paused]);

    // Protocol tip selection - random from full list
    useEffect(() => {
        if (PROTOCOL_TIPS && PROTOCOL_TIPS.length > 0) {
            const randomIndex = Math.floor(Math.random() * PROTOCOL_TIPS.length);
            setCoachingTip(PROTOCOL_TIPS[randomIndex]);
        }
    }, []);

    // Skip countdown with Enter key, abort with Escape key, pause with P key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !completedRef.current) {
                e.preventDefault();
                completedRef.current = true;
                onComplete();
            } else if (e.key === 'Escape' && !completedRef.current) {
                e.preventDefault();
                completedRef.current = true;
                onCancel();
            } else if ((e.key === 'p' || e.key === 'P') && !completedRef.current) {
                e.preventDefault();
                setPaused(p => !p);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onComplete, onCancel]);

    // Format level display
    const rawLevel = formatCombinedDifficulty(nBack, difficulty);
    const displayLevelValue = trainingMode === 'classic'
        ? `${MODE_LABELS[gameMode] || 'Dual'} ${nBack}-back`
        : isDynamic
            ? `${MODE_LABELS[gameMode] || 'Dual'} ${rawLevel}`
            : rawLevel;
    const protocolLabel = 'Training Protocol';

    // Don't render after countdown completes
    if (countdown <= 0) {
        return null;
    }

    return (
        <div className="absolute inset-0 flex items-center justify-center z-10">
            {/* Backdrop with grid pattern */}
            <div className="absolute inset-0 bg-theme-bg/95 backdrop-blur-md">
                {/* Subtle grid overlay */}
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
                {/* Radial vignette */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: 'radial-gradient(ellipse at center, transparent 0%, color-mix(in srgb, var(--color-bg-primary) 80%, transparent) 100%)'
                    }}
                />
            </div>

            {/* Main countdown container */}
            <div className="relative z-10 flex flex-col items-center px-4 max-w-md w-full">

                {/* Protocol Header */}
                <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <div className={`w-1.5 h-1.5 bg-theme-accent rounded-full ${paused ? '' : 'animate-pulse'}`}></div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.25em] text-theme-accent">
                            {protocolLabel}
                        </span>
                        <div className={`w-1.5 h-1.5 bg-theme-accent rounded-full ${paused ? '' : 'animate-pulse'}`}></div>
                    </div>
                    <h2 className="text-xl font-serif text-theme-text tracking-wide">
                        {paused ? 'Sequence Paused' : 'Initiating Sequence'}
                    </h2>
                </div>

                {/* Circular Countdown Gauge */}
                <div className="relative mb-8">
                    {/* Outer glow effect */}
                    <div
                        className={`absolute inset-0 rounded-full transition-opacity duration-300 ${
                            pulsing ? 'opacity-100' : 'opacity-40'
                        }`}
                        style={{
                            boxShadow: '0 0 60px rgba(228, 184, 92, 0.3), 0 0 120px rgba(228, 184, 92, 0.1)',
                            transform: 'scale(1.1)'
                        }}
                    />

                    {/* SVG Ring Gauge */}
                    <svg
                        width="180"
                        height="180"
                        className="transform -rotate-90"
                    >
                        {/* Background ring */}
                        <circle
                            cx="90"
                            cy="90"
                            r={ringRadius}
                            fill="none"
                            stroke="var(--color-line)"
                            strokeWidth="3"
                        />

                        {/* Tick marks */}
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
                            const angle = (i * 30) * (Math.PI / 180);
                            const x1 = 90 + (ringRadius - 8) * Math.cos(angle);
                            const y1 = 90 + (ringRadius - 8) * Math.sin(angle);
                            const x2 = 90 + (ringRadius + 2) * Math.cos(angle);
                            const y2 = 90 + (ringRadius + 2) * Math.sin(angle);
                            return (
                                <line
                                    key={i}
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke="var(--color-text-muted)"
                                    strokeWidth="1"
                                />
                            );
                        })}

                        {/* Progress ring - CSS animated over 3 seconds */}
                        <circle
                            cx="90"
                            cy="90"
                            r={ringRadius}
                            fill="none"
                            stroke="url(#amberGradient)"
                            strokeWidth="4"
                            strokeLinecap="square"
                            strokeDasharray={ringCircumference}
                            strokeDashoffset={ringCircumference}
                            style={{
                                animation: 'countdown-ring 3s linear forwards',
                                animationPlayState: paused ? 'paused' : 'running'
                            }}
                        />

                        {/* Gradient and animation definitions */}
                        <defs>
                            <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#B8943A" />
                                <stop offset="100%" stopColor="#E4B85C" />
                            </linearGradient>
                        </defs>
                        <style>
                            {`
                                @keyframes countdown-ring {
                                    from {
                                        stroke-dashoffset: ${ringCircumference};
                                    }
                                    to {
                                        stroke-dashoffset: 0;
                                    }
                                }
                            `}
                        </style>
                    </svg>

                    {/* Center number display */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                            className={`font-mono text-7xl font-bold text-theme-accent transition-transform duration-200 ${
                                pulsing ? 'scale-110' : 'scale-100'
                            }`}
                            style={{
                                textShadow: '0 0 30px color-mix(in srgb, var(--color-accent) 50%, transparent)'
                            }}
                        >
                            {countdown}
                        </span>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted mt-1">
                            Seconds
                        </span>
                    </div>
                </div>

                {/* Level Display Panel */}
                <div className="bg-theme-bg-secondary border border-theme-line w-full mb-6">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-theme-line">
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-text-muted">
                            Target Level
                        </span>
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 bg-status-success rounded-full"></div>
                            <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-status-success">
                                Ready
                            </span>
                        </div>
                    </div>
                    <div className="px-4 py-4 text-center">
                        <span className="text-3xl font-mono text-theme-text tracking-wider">
                            {displayLevelValue}
                        </span>
                    </div>
                </div>

                {/* Coaching Tip */}
                {coachingTip && (
                    <div className="bg-theme-bg-elevated border-l-2 border-theme-accent/50 w-full mb-6">
                        <div className="px-4 py-3">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-0.5">
                                    <svg className="w-4 h-4 text-theme-accent" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
                                    </svg>
                                </div>
                                <div>
                                    <div className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-accent/70 mb-1">
                                        Protocol Tip
                                    </div>
                                    <p className="text-sm text-theme-text-secondary leading-relaxed">
                                        {coachingTip}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* iOS Silent Mode Warning */}
                {isIOS && (
                    <div className="bg-theme-accent/10 border border-theme-accent/30 w-full mb-6 px-4 py-3">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5">
                                <svg className="w-4 h-4 text-theme-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6.253v11.494M8.464 8.464a5 5 0 000 7.072M19.07 4.93a10 10 0 010 14.142M4.93 4.93a10 10 0 000 14.142" />
                                </svg>
                            </div>
                            <p className="text-sm text-theme-accent leading-relaxed">
                                Please turn off Silent Mode (flip the switch on the side of your device) to hear game audio.
                            </p>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    {/* Cancel Button */}
                    <button
                        onClick={onCancel}
                        className="group flex items-center gap-2 px-5 py-2.5
                                 text-sm font-mono uppercase tracking-wider
                                 text-theme-text-muted hover:text-theme-text
                                 border border-theme-line hover:border-theme-text-muted
                                 bg-theme-bg-secondary hover:bg-theme-bg-elevated
                                 transition-all duration-200"
                        title="Abort sequence (Esc)"
                    >
                        <svg
                            className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path strokeLinecap="square" strokeLinejoin="miter" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Abort
                        <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg/20 rounded border border-theme-line/50">
                            Esc
                        </kbd>
                    </button>

                    {/* Pause/Resume Button */}
                    <button
                        onClick={() => setPaused(p => !p)}
                        className="group flex items-center gap-2 px-5 py-2.5
                                 text-sm font-mono uppercase tracking-wider
                                 text-theme-text-muted hover:text-theme-text
                                 border border-theme-line hover:border-theme-text-muted
                                 bg-theme-bg-secondary hover:bg-theme-bg-elevated
                                 transition-all duration-200"
                        title={paused ? "Resume sequence (P)" : "Pause sequence (P)"}
                    >
                        {paused ? (
                            <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        ) : (
                            <svg
                                className="w-4 h-4"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                        )}
                        {paused ? 'Resume' : 'Pause'}
                        <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-[0.625rem] font-mono bg-theme-bg/20 rounded border border-theme-line/50">
                            P
                        </kbd>
                    </button>
                </div>

                {/* Bottom status line */}
                <div className="mt-6 flex items-center gap-3 text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono text-theme-text-muted uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-theme-accent rounded-full animate-pulse"></div>
                        <span>Audio Active</span>
                    </div>
                    <span className="text-theme-line">|</span>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 bg-status-success rounded-full"></div>
                        <span>System Ready</span>
                    </div>
                    {/* Enter to skip hint - desktop only */}
                    <span className="hidden sm:inline text-theme-line">|</span>
                    <div className="hidden sm:flex items-center gap-1.5">
                        <kbd className="px-1.5 py-0.5 text-[0.625rem] bg-theme-bg-elevated rounded border border-theme-line">
                            Enter
                        </kbd>
                        <span>to skip</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameCountdown;
