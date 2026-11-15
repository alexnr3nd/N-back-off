/* src/components/settings/SettingSectionComponents.js */
/* Updated: Cognitive Lab dark theme */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ButtonSpinner from '../ui/ButtonSpinner';

// Section Card - Now transparent since parent provides the card styling
export const SectionCard = ({ title, icon, children }) => (
    <div>
        {children}
    </div>
);

// Key Binding Input - Lab theme
export const KeyBindingInput = ({ label, currentKey, isSetting, onStartSetting, disabled = false }) => {
    const formatKeyDisplay = (key) => {
        if (!key) return 'None';
        if (key === ' ') return 'Spacebar';
        if (key === 'ArrowLeft') return '←';
        if (key === 'ArrowRight') return '→';
        if (key === 'ArrowUp') return '↑';
        if (key === 'ArrowDown') return '↓';
        if (key.length === 1) return key.toUpperCase();
        if (key.startsWith('Key')) return key.substring(3).toUpperCase();
        if (key.startsWith('Digit')) return key.substring(5);
        return key;
    };
    return (
        <div className="flex items-center justify-between py-3 border-b border-theme-line last:border-b-0">
            <span className="text-sm font-mono text-theme-text-secondary">{label}</span>
            <button
                onClick={onStartSetting}
                className={`px-4 py-2 rounded-lab text-sm font-mono uppercase tracking-wider transition-all duration-200 min-w-[140px] text-center border ${
                    isSetting
                        ? 'bg-theme-accent/20 text-theme-accent border-theme-accent animate-pulse'
                        : 'bg-theme-bg-elevated text-theme-text border-theme-line hover:border-theme-accent/50 hover:text-theme-accent'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                aria-live="polite"
                aria-label={`${label}, Current key: ${formatKeyDisplay(currentKey)}, Click to change`}
                disabled={disabled}
            >
                 {isSetting ? 'Press a key...' : formatKeyDisplay(currentKey)}
            </button>
        </div>
    );
};

// Toggle Switch Component - Lab theme
export const ToggleSwitch = ({ label, description, checked, onChange, disabled = false }) => (
    <div className="flex items-center justify-between py-4">
        <span className="flex-grow flex flex-col mr-4">
            <span className="text-sm font-mono text-theme-text">{label}</span>
            {description && <span className="text-xs text-theme-text-muted mt-1 font-mono">{description}</span>}
        </span>
        <button
            type="button"
            onClick={() => !disabled && onChange(!checked)}
            className={`${
                checked ? 'bg-theme-accent' : 'bg-theme-line'
            } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-theme-accent ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            aria-label={label}
        >
            <span
                aria-hidden="true"
                className={`${
                    checked ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 rounded-full bg-theme-bg shadow-lg transform ring-0 transition ease-in-out duration-200`}
            />
        </button>
    </div>
);

// Dropdown Input Component - Lab theme
export const DropdownInput = ({ label, id, value, onChange, options, disabled = false, description = null, className = "" }) => (
    <div className={`py-3 ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <label htmlFor={id} className="text-sm font-mono text-theme-text flex-shrink-0">{label}</label>
            <div className="relative flex-grow sm:max-w-[280px]">
                <select
                    id={id}
                    name={id}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    className="block w-full pl-4 pr-10 py-2.5 text-sm font-mono
                        bg-theme-bg-elevated border border-theme-line rounded-lab
                        text-theme-text
                        focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                        disabled:opacity-50 disabled:cursor-not-allowed
                        appearance-none cursor-pointer
                        transition-colors duration-200
                        hover:border-theme-border"
                >
                    {options.map(option => (
                        <option key={option.value} value={option.value} className="bg-theme-bg-elevated text-theme-text">
                            {option.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-theme-text-muted">
                    <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </div>
            </div>
        </div>
        {description && !disabled && <p className="text-xs text-theme-text-muted mt-2 font-mono sm:text-right">{description}</p>}
    </div>
);

// Slider Input Component - Lab theme
export const SliderInput = ({ label, id, value, onChange, min, max, step, disabled = false, displayValue }) => (
    <div className="py-4">
        <div className="flex items-center justify-between mb-3">
             <label htmlFor={id} className="text-sm font-mono text-theme-text-secondary">{label}</label>
             <span className={`text-lg font-mono font-semibold ${disabled ? 'text-theme-text-muted' : 'text-theme-accent'} tabular-nums`}>
                {displayValue}
             </span>
        </div>
        <div className="relative">
            <input
                type="range"
                id={id}
                name={id}
                value={value}
                onChange={onChange}
                min={min}
                max={max}
                step={step}
                disabled={disabled}
                className="w-full h-2 bg-theme-line rounded-full appearance-none cursor-pointer
                    disabled:cursor-not-allowed disabled:opacity-50
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-theme-accent
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-5
                    [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-theme-accent
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:duration-150
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-webkit-slider-thumb]:shadow-lg
                    [&::-moz-range-thumb]:w-5
                    [&::-moz-range-thumb]:h-5
                    [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-theme-accent
                    [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer"
            />
        </div>
    </div>
);

// Save Button - Lab theme (reusable)
export const SaveButton = ({ onClick, disabled, isSaving, savingText = "Saving...", text, minWidth = "150px" }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`px-5 py-2.5 bg-theme-accent hover:bg-amber-highlight text-theme-bg border border-theme-accent
            rounded-lab text-sm font-mono uppercase tracking-wider
            disabled:opacity-50 disabled:cursor-not-allowed
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal focus:ring-theme-accent
            transition-all duration-200 flex items-center justify-center`}
        style={{ minWidth }}
    >
        {isSaving ? (
            <><ButtonSpinner color="charcoal" /> <span className="ml-2">{savingText}</span></>
        ) : (
            text
        )}
    </button>
);

// Status Message - Lab theme
export const StatusMessage = ({ status }) => {
    if (!status.message) return null;
    return (
        <span className={`text-sm font-mono ${status.type === 'success' ? 'text-neural-dendrite' : 'text-neural-synapse'}`}>
            {status.message}
        </span>
    );
};

// Save Button Area - Lab theme wrapper
export const SaveButtonArea = ({ children }) => (
    <div className="mt-6 pt-4 border-t border-theme-line flex items-center justify-end gap-4">
        {children}
    </div>
);
