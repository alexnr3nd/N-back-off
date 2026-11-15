/* src/components/ui/LabControls.js */
/* Shared Cognitive Lab styled controls (extracted from SettingsPage) */
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faExclamationCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import ButtonSpinner from './ButtonSpinner';

export const LabButton = ({ onClick, disabled = false, isLoading = false, loadingText = "Processing...", text, variant = "primary", icon = null, fullWidth = false, type = "button" }) => {
    const variants = {
        primary: "bg-theme-accent hover:bg-amber-highlight text-theme-bg border-theme-accent",
        secondary: "bg-theme-bg-elevated hover:bg-theme-bg-surface text-theme-text border-theme-line",
        danger: "bg-neural-synapse/20 hover:bg-neural-synapse/30 text-neural-synapse border-neural-synapse/50",
        ghost: "bg-transparent hover:bg-theme-bg-surface text-theme-text-secondary border-transparent",
    };
    const spinnerColor = variant === 'primary' ? 'charcoal' : 'amber';
    return (
        <button type={type} onClick={onClick} disabled={disabled || isLoading}
            className={`${fullWidth ? 'w-full' : 'w-auto'} px-5 py-2.5 border text-sm font-mono uppercase tracking-wider rounded-lab
                ${variants[variant]} disabled:opacity-50 disabled:cursor-not-allowed
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg focus:ring-theme-accent
                transition-all duration-200 flex items-center justify-center ${isLoading ? 'cursor-wait' : ''}`}>
            {isLoading ? (<><ButtonSpinner color={spinnerColor} /><span className="ml-2">{loadingText}</span></>) : (<>{icon && <FontAwesomeIcon icon={icon} className="mr-2 h-3.5 w-3.5" />}{text}</>)}
        </button>
    );
};

export const LabAlert = ({ type, message }) => {
    const types = {
        success: { bg: "bg-neural-dendrite/10", border: "border-neural-dendrite/30", text: "text-neural-dendrite", icon: faCheckCircle },
        warning: { bg: "bg-theme-accent/10", border: "border-theme-accent/30", text: "text-theme-accent", icon: faExclamationTriangle },
        error: { bg: "bg-neural-synapse/10", border: "border-neural-synapse/30", text: "text-neural-synapse", icon: faExclamationCircle },
        info: { bg: "bg-neural-pulse/10", border: "border-neural-pulse/30", text: "text-neural-pulse", icon: faExclamationCircle }
    };
    if (!message) return null;
    const style = types[type];
    if (!style) return null;
    return (
        <div className={`${style.bg} ${style.text} ${style.border} border rounded-lab p-4 mb-4 flex items-start`}>
            <FontAwesomeIcon icon={style.icon} className="mr-3 h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="text-sm font-mono">{message}</span>
        </div>
    );
};
