/* src/components/game/GamePaused.js */
/* Cognitive Lab Aesthetic - Test Suspension Interface */

import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { useSettings } from '../../contexts/SettingsContext';
import { ToggleSwitch, KeyBindingInput } from '../settings/SettingSectionComponents';
import { GAME_MODES } from '../../constants/gameConstants';

const DEFAULT_KEY_BINDINGS = {
    visual: 'ArrowLeft',
    audio: 'ArrowRight',
    color: 'ArrowDown',
    shape: 'ArrowUp',
};

const MODALITY_LABELS = {
    visual: 'Position',
    audio: 'Audio',
    color: 'Color',
    shape: 'Shape',
};

const MODALITY_BINDING_LABELS = {
    visual: 'Position Match Key',
    audio: 'Audio Match Key',
    color: 'Color Match Key',
    shape: 'Shape Match Key',
};

const ALL_MODALITIES = ['visual', 'audio', 'color', 'shape'];

const announceKey = (key) => {
    if (key === ' ') return 'Spacebar';
    if (key === 'ArrowLeft') return 'Left Arrow';
    if (key === 'ArrowRight') return 'Right Arrow';
    if (key === 'ArrowUp') return 'Up Arrow';
    if (key === 'ArrowDown') return 'Down Arrow';
    if (typeof key === 'string' && key.length === 1) return key.toUpperCase();
    return key;
};

/**
 * GamePaused Component - Laboratory test suspension overlay
 * Displays when game is paused with resume and end options. Also surfaces
 * two compact accordion sections for Instant Feedback toggles and keyboard
 * controls rebinding so the player can tweak them without leaving the session.
 */
const GamePaused = ({ onResume, onEndGame, gameMode = 'dual' }) => {
    const { settings, updateSetting } = useSettings();

    const [openSection, setOpenSection] = useState(null); // 'feedback' | 'controls' | null
    const [settingKey, setSettingKey] = useState(null); // 'visual' | 'audio' | 'color' | 'shape' | null
    const [reservedKeyMessage, setReservedKeyMessage] = useState(null);
    const [captureAnnouncement, setCaptureAnnouncement] = useState('');
    const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

    const feedbackHeaderRef = useRef(null);
    const controlsHeaderRef = useRef(null);
    const previousOpenSectionRef = useRef(null);

    // Which modality keybinds to show unconditionally vs. tuck behind the
    // "Other Mode Keys" disclosure. Driven by GAME_MODES so every mode
    // (including singleVisual/singleAudio/singleColor/singleShape) surfaces
    // only its own hotkeys by default.
    const modeModalities = GAME_MODES[gameMode]?.modalities;
    const activeModalities = Array.isArray(modeModalities) && modeModalities.length > 0
        ? ALL_MODALITIES.filter((m) => modeModalities.includes(m))
        : ['visual', 'audio'];
    const hiddenModalities = ALL_MODALITIES.filter((m) => !activeModalities.includes(m));

    const keyBindings = settings?.keyBindings || DEFAULT_KEY_BINDINGS;
    const feedbackPositive = settings?.instantFeedbackPositive ?? true;
    // Per-type keys preferred; fall back to legacy `instantFeedbackNegative` shadow
    // for users who haven't yet round-tripped through the new save path.
    const feedbackNegativeFallback = settings?.instantFeedbackNegative ?? true;
    const feedbackErrors = settings?.instantFeedbackErrors ?? feedbackNegativeFallback;
    const feedbackMisses = settings?.instantFeedbackMisses ?? feedbackNegativeFallback;

    // Capture-phase keydown listener preempts useGameControls during keybind capture.
    // Without { capture: true } + stopImmediatePropagation, pressing Space would
    // resume the game instead of being offered as a binding (and is rejected as reserved).
    useEffect(() => {
        if (!settingKey) return undefined;

        setCaptureAnnouncement('Listening for key. Press any key or Escape to cancel.');

        const onCapture = (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();

            if (e.key === 'Escape' || e.key === 'Tab') {
                setSettingKey(null);
                setReservedKeyMessage(null);
                setCaptureAnnouncement('Capture cancelled.');
                return;
            }

            const reserved = [' ', 'p', 'P'];
            if (reserved.includes(e.key)) {
                const msg = 'That key is reserved for pause/resume. Press another key.';
                setReservedKeyMessage(msg);
                setCaptureAnnouncement(msg);
                return;
            }

            updateSetting('keyBindings', { ...keyBindings, [settingKey]: e.key });
            setCaptureAnnouncement(`${MODALITY_LABELS[settingKey] || settingKey} bound to ${announceKey(e.key)}.`);
            setSettingKey(null);
            setReservedKeyMessage(null);
        };

        window.addEventListener('keydown', onCapture, { capture: true });
        return () => window.removeEventListener('keydown', onCapture, { capture: true });
    }, [settingKey, keyBindings, updateSetting]);

    // Focus restoration when a panel collapses (WCAG 2.4.3).
    useEffect(() => {
        const prev = previousOpenSectionRef.current;
        if (prev && openSection !== prev) {
            if (prev === 'feedback') feedbackHeaderRef.current?.focus();
            else if (prev === 'controls') controlsHeaderRef.current?.focus();
        }
        previousOpenSectionRef.current = openSection;
    }, [openSection]);

    const toggleSection = (section) => {
        // Cancel any in-progress keybind capture if switching sections or closing.
        if (settingKey) {
            setSettingKey(null);
            setReservedKeyMessage(null);
        }
        setOpenSection((prev) => (prev === section ? null : section));
    };

    const startSettingKey = (name) => {
        setReservedKeyMessage(null);
        setSettingKey(name);
    };

    return (
        <div className="absolute inset-0 flex items-center justify-center z-10">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-theme-bg/90 backdrop-blur-sm">
                {/* Subtle scan lines */}
                <div
                    className="absolute inset-0 opacity-5"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, color-mix(in srgb, var(--color-accent) 10%, transparent) 2px, color-mix(in srgb, var(--color-accent) 10%, transparent) 4px)',
                    }}
                />
            </div>

            {/* Modal Container */}
            <div className="relative z-10 bg-theme-bg-secondary border border-theme-line shadow-lab-elevated max-w-sm w-full mx-4 animate-slide-up max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="border-b border-theme-line px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                            <div className="absolute inset-0 w-2 h-2 bg-theme-accent rounded-full animate-ping opacity-50"></div>
                        </div>
                        <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Test Suspended
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 py-6">
                    <div className="text-center">
                        <h2 className="text-xl font-serif text-theme-text mb-2">
                            Session Paused
                        </h2>
                        <p className="text-sm text-theme-text-secondary mb-6">
                            Test sequence suspended. Ready to resume when you are.
                        </p>

                        {/* Status Indicator */}
                        <div className="bg-theme-bg-elevated border border-theme-line px-4 py-3 mb-6">
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-1.5 h-1.5 bg-theme-accent rounded-full animate-pulse"></div>
                                <span className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-[0.15em] text-theme-accent">
                                    Awaiting Input
                                </span>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={onResume}
                                className="px-4 py-3 font-mono text-sm uppercase tracking-wider
                                         text-theme-bg bg-theme-accent hover:bg-theme-accent-hover
                                         transition-all duration-200
                                         flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                Resume
                            </button>

                            <button
                                onClick={onEndGame}
                                className="px-4 py-3 font-mono text-sm uppercase tracking-wider
                                         text-theme-text-secondary hover:text-theme-text
                                         border border-theme-line hover:border-neural-synapse/50
                                         bg-theme-bg-elevated hover:bg-neural-synapse/10
                                         transition-all duration-200
                                         flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                                </svg>
                                End
                            </button>
                        </div>
                    </div>

                    {/* Accordion: Instant Feedback */}
                    <div className="mt-6 border-t border-theme-line pt-4">
                        <button
                            ref={feedbackHeaderRef}
                            type="button"
                            id="gp-feedback-header"
                            aria-expanded={openSection === 'feedback'}
                            aria-controls="gp-feedback-panel"
                            onClick={() => toggleSection('feedback')}
                            className="w-full flex items-center gap-2 text-xs text-theme-text-muted hover:text-theme-text font-mono uppercase tracking-[0.15em] transition-colors"
                        >
                            <FontAwesomeIcon
                                icon={faChevronRight}
                                className={`transition-transform duration-200 ${openSection === 'feedback' ? 'rotate-90' : ''}`}
                            />
                            Instant Feedback
                        </button>

                        {openSection === 'feedback' && (
                            <div
                                id="gp-feedback-panel"
                                role="region"
                                aria-labelledby="gp-feedback-header"
                                className="mt-2 pl-4 border-l border-theme-line"
                            >
                                <p className="text-xs text-theme-text-muted font-mono mt-2 mb-1">
                                    Show visual and audio cues after responding to a stimulus.
                                </p>
                                <ToggleSwitch
                                    label="Correct Responses"
                                    description="Green highlight when you correctly identify a match"
                                    checked={feedbackPositive}
                                    onChange={(v) => updateSetting('instantFeedbackPositive', v)}
                                />
                                <ToggleSwitch
                                    label="Errors"
                                    description="Red highlight when you press a key that wasn't a match"
                                    checked={feedbackErrors}
                                    onChange={(v) => updateSetting('instantFeedbackErrors', v)}
                                />
                                <ToggleSwitch
                                    label="Misses"
                                    description="Red highlight on the grid tile you should have responded to"
                                    checked={feedbackMisses}
                                    onChange={(v) => updateSetting('instantFeedbackMisses', v)}
                                />
                            </div>
                        )}
                    </div>

                    {/* Accordion: Controls */}
                    <div className="mt-3 border-t border-theme-line pt-4">
                        <button
                            ref={controlsHeaderRef}
                            type="button"
                            id="gp-controls-header"
                            aria-expanded={openSection === 'controls'}
                            aria-controls="gp-controls-panel"
                            onClick={() => toggleSection('controls')}
                            className="w-full flex items-center gap-2 text-xs text-theme-text-muted hover:text-theme-text font-mono uppercase tracking-[0.15em] transition-colors"
                        >
                            <FontAwesomeIcon
                                icon={faChevronRight}
                                className={`transition-transform duration-200 ${openSection === 'controls' ? 'rotate-90' : ''}`}
                            />
                            Controls
                        </button>

                        {openSection === 'controls' && (
                            <div
                                id="gp-controls-panel"
                                role="region"
                                aria-labelledby="gp-controls-header"
                                className="mt-2 pl-4 border-l border-theme-line"
                            >
                                <p className="text-xs text-theme-text-muted font-mono mt-2 mb-2">
                                    Click a button, then press the desired key. Space and P stay reserved for pause/resume.
                                </p>
                                <div className="space-y-1">
                                    {activeModalities.map((m) => (
                                        <KeyBindingInput
                                            key={m}
                                            label={MODALITY_BINDING_LABELS[m]}
                                            currentKey={keyBindings[m]}
                                            isSetting={settingKey === m}
                                            onStartSetting={() => startSettingKey(m)}
                                        />
                                    ))}
                                </div>

                                {hiddenModalities.length > 0 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedKeys(!showAdvancedKeys)}
                                            className="flex items-center gap-2 text-xs text-theme-text-muted hover:text-theme-text font-mono mt-4 mb-2 transition-colors"
                                        >
                                            <FontAwesomeIcon
                                                icon={faChevronRight}
                                                className={`transition-transform duration-200 ${showAdvancedKeys ? 'rotate-90' : ''}`}
                                            />
                                            Other Mode Keys
                                        </button>

                                        {showAdvancedKeys && (
                                            <div className="space-y-1 pl-4 border-l border-theme-line">
                                                {hiddenModalities.map((m) => (
                                                    <KeyBindingInput
                                                        key={m}
                                                        label={MODALITY_BINDING_LABELS[m]}
                                                        currentKey={keyBindings[m]}
                                                        isSetting={settingKey === m}
                                                        onStartSetting={() => startSettingKey(m)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}

                                {settingKey && (
                                    <p className="mt-3 text-xs text-theme-accent font-mono animate-pulse">
                                        Press any key to bind (Escape or Tab to cancel)
                                    </p>
                                )}
                                {reservedKeyMessage && (
                                    <p className="mt-2 text-xs text-neural-synapse font-mono">
                                        {reservedKeyMessage}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Visually-hidden live region for screen reader announcements */}
                    <div className="sr-only" aria-live="assertive" aria-atomic="true">
                        {captureAnnouncement}
                    </div>
                </div>

                {/* Footer hint - hidden on mobile (no keyboard) */}
                <div className="hidden sm:block border-t border-theme-line px-5 py-2 text-center">
                    <span className="text-[0.6875rem] font-mono text-theme-text-muted uppercase tracking-wider">
                        Press <kbd className="px-1.5 py-0.5 bg-theme-bg-elevated border border-theme-line mx-1">P</kbd> to resume
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GamePaused;
