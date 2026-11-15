/* src/components/settings/colors/ColorPickerModal.js */

import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Colorful from '@uiw/react-color-colorful';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faXmark, faRotateLeft } from '@fortawesome/free-solid-svg-icons';
import ContrastAdvisory from './ContrastAdvisory';

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

/**
 * Modal-based color picker. Wraps @uiw/react-color-colorful and a hex
 * text input. Modal pattern (not inline expand) avoids the Capacitor
 * Android keyboard/WebView resize bugs (capacitor#8166, #8055) that
 * break inline pickers when the hex input opens the keyboard.
 *
 * Renders via React Portal at document.body level, mirroring
 * ConfirmationModal's pattern.
 */
const ColorPickerModal = ({
    isOpen,
    initialHex,
    presetHex,         // for the "reset to preset" affordance
    slotLabel,         // e.g., "Swatch 4"
    onApply,           // (hex: string) => void
    onClose,
}) => {
    const [hex, setHex] = useState(initialHex || '#000000');
    const [hexInput, setHexInput] = useState(initialHex || '#000000');

    // Reset state whenever the modal opens with a different initialHex
    useEffect(() => {
        if (isOpen) {
            setHex(initialHex || '#000000');
            setHexInput(initialHex || '#000000');
        }
    }, [isOpen, initialHex]);

    // Lock body scroll while open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Escape closes
    useEffect(() => {
        if (!isOpen) return undefined;
        const handler = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isOpen, onClose]);

    const handlePickerChange = useCallback((color) => {
        const next = (color?.hex || '').toUpperCase();
        if (HEX_RE.test(next)) {
            setHex(next);
            setHexInput(next);
        }
    }, []);

    const handleHexInputChange = useCallback((e) => {
        const raw = e.target.value;
        setHexInput(raw);
        const normalized = raw.startsWith('#') ? raw : '#' + raw;
        if (HEX_RE.test(normalized)) {
            setHex(normalized.toUpperCase());
        }
    }, []);

    const handleApply = useCallback(() => {
        if (HEX_RE.test(hex)) {
            onApply(hex);
            onClose();
        }
    }, [hex, onApply, onClose]);

    const handleResetToPreset = useCallback(() => {
        if (presetHex && HEX_RE.test(presetHex)) {
            setHex(presetHex.toUpperCase());
            setHexInput(presetHex.toUpperCase());
        }
    }, [presetHex]);

    if (!isOpen) return null;

    const modalContent = (
        <div
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '1rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={onClose}
            />

            {/* Centered panel (mirrors ConfirmationModal layout) */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '28rem',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-label={`Customize ${slotLabel}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-theme-line">
                    <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text">
                        {slotLabel}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 -m-2 rounded-lab text-theme-text-muted hover:text-theme-text"
                        aria-label="Close"
                    >
                        <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
                    </button>
                </div>

                {/* Picker body */}
                <div className="px-5 py-4 space-y-4">
                    <div className="flex justify-center">
                        <Colorful
                            color={hex}
                            disableAlpha
                            onChange={handlePickerChange}
                            style={{ width: '100%', maxWidth: '280px' }}
                        />
                    </div>

                    {/* Hex input + swatch preview */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded-lab border border-theme-line flex-shrink-0"
                            style={{ backgroundColor: hex }}
                            aria-hidden="true"
                        />
                        <div className="flex-1">
                            <label htmlFor="hex-input" className="sr-only">Hex value</label>
                            <input
                                id="hex-input"
                                type="text"
                                value={hexInput}
                                onChange={handleHexInputChange}
                                placeholder="#RRGGBB"
                                className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-line rounded-lab
                                    text-theme-text font-mono text-sm uppercase
                                    focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent"
                                autoComplete="off"
                                autoCapitalize="off"
                                spellCheck="false"
                                maxLength={7}
                            />
                        </div>
                    </div>

                    <ContrastAdvisory hex={hex} />

                    {presetHex && presetHex.toUpperCase() !== hex.toUpperCase() && (
                        <button
                            type="button"
                            onClick={handleResetToPreset}
                            className="text-xs font-mono text-theme-text-muted hover:text-theme-accent
                                inline-flex items-center gap-1.5"
                        >
                            <FontAwesomeIcon icon={faRotateLeft} className="h-3 w-3" />
                            Reset to preset
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-theme-bg-elevated px-5 py-3 border-t border-theme-line flex flex-row-reverse gap-3">
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={!HEX_RE.test(hex)}
                        className="px-5 py-2 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-all duration-200"
                    >
                        Apply
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary
                            border border-theme-line transition-all duration-200"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

export default ColorPickerModal;
