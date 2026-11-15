/* src/components/game/ColorRecallPad.js */
/* Recall Mode response pad: the 8 pool colors as swatch buttons.
 * The player reports WHICH color appeared n trials back. First tap locks
 * the trial's answer (once-per-trial guard lives in useGameResponses). */

import React, { useCallback, useMemo, useRef } from 'react';
import { COLOR_STIMULI, COLOR_HEX_MAP } from '../../constants/gameConstants';
import { isNative } from '../../utils/platform';

const RESPONSE_LOCK_MS = 200; // same iOS phantom-touch lock as MatchButton

const ColorRecallPad = ({
    onSelect,
    feedbackState,
    selectedColor = null,
    disabled = false,
    isWatchPhase = false,
    palette = null,
    trialIndex = null,
}) => {
    // Blocks the phantom click iOS fires right after touchstart (MatchButton pattern).
    const lastResponseTimeRef = useRef(0);
    // Which trial armed the lock — a new trial voids it (see handleTap).
    const lastLockTrialRef = useRef(null);

    // The 1-8 hotkeys still work, but the numerals live only in the tooltip and the
    // accessible name — on the face of the swatch they just read as clutter.
    const showKeyHints = useMemo(() => {
        try {
            return window.matchMedia('(pointer: fine)').matches;
        } catch (e) {
            return false;
        }
    }, []);

    // Swatch fill comes from the live palette (color customization) so the pad always
    // matches the stimuli PositionGrid is drawing; falls back to the shared hex map.
    const hexFor = useCallback(
        (c) => (palette && palette[c]) || COLOR_HEX_MAP[c] || '#888',
        [palette]
    );

    const handleTap = useCallback((e, color) => {
        const now = Date.now();
        // The lock is PER-TRIAL: a new trial voids any armed window, so a late tap on
        // the previous trial (accepted or rejected upstream) can never swallow this
        // trial's answer. Recall players answer every trial, often within 200ms of
        // stimulus onset — a cross-trial lock silently scored those answers as blanks.
        if (trialIndex !== lastLockTrialRef.current) {
            lastLockTrialRef.current = trialIndex;
            lastResponseTimeRef.current = 0;
        }
        if (now - lastResponseTimeRef.current < RESPONSE_LOCK_MS) {
            e.stopPropagation();
            return;
        }
        if (e && e.isTrusted === false) return;
        if (disabled || isWatchPhase || !onSelect) return;
        // Arm only when the tap is actually forwarded — a bailed tap must not start
        // a window that could block a legitimate follow-up press.
        lastResponseTimeRef.current = now;
        if (isNative()) {
            import('@capacitor/haptics').then(({ Haptics, ImpactStyle }) => {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            }).catch(() => {});
        }
        onSelect(color);
    }, [disabled, isWatchPhase, onSelect, trialIndex]);

    // Pad-level ring only for a BLANK (missed) — nothing was pressed, so there is no
    // swatch to carry that feedback. Correct/incorrect/acknowledged render on the
    // pressed swatch itself (see buttonState below).
    const padBorder = feedbackState === 'missed'
        ? 'border-neural-synapse shadow-[0_0_20px_rgba(255,124,124,0.3)]'
        : 'border-theme-line';

    return (
        <div
            role="group"
            aria-label="Color recall response pad"
            className={`border ${padBorder} bg-theme-bg-elevated p-2 sm:p-3 transition-all duration-150 ${isWatchPhase ? 'opacity-60' : ''}`}
        >
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {COLOR_STIMULI.map((color, i) => {
                    const isSelected = selectedColor === color;
                    // Outcome feedback flashes on the pressed swatch's background; there is
                    // deliberately NO persistent selected state — once the flash clears the
                    // pad returns fully to neutral.
                    const buttonState =
                        isSelected && feedbackState === 'correct' ? 'border-neural-dendrite bg-neural-dendrite/25' :
                        isSelected && feedbackState === 'incorrect' ? 'border-neural-synapse bg-neural-synapse/25' :
                        isSelected && feedbackState === 'acknowledged' ? 'border-theme-accent bg-theme-accent/10' :
                        'border-theme-line hover:border-theme-accent/50';
                    return (
                        <button
                            key={color}
                            type="button"
                            disabled={disabled || isWatchPhase}
                            onClick={(e) => handleTap(e, color)}
                            onTouchStart={(e) => { e.stopPropagation(); handleTap(e, color); }}
                            style={{ touchAction: 'manipulation' }}
                            aria-pressed={isSelected}
                            aria-label={`${color}${showKeyHints ? ` (${i + 1})` : ''}`}
                            title={showKeyHints ? `${color} (Key: ${i + 1})` : color}
                            className={`relative min-h-[56px] flex items-center justify-center border transition-all duration-150
                                focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-accent/50 ${buttonState} ${(disabled || isWatchPhase) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            <span
                                className={`block w-7 h-7 sm:w-8 sm:h-8 rounded-full ${color === 'white' ? 'ring-1 ring-theme-line' : ''}`}
                                style={{ backgroundColor: hexFor(color) }}
                            />
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ColorRecallPad;
