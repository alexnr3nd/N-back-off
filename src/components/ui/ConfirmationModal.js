/* src/components/ui/ConfirmationModal.js */
/* Updated: Cognitive Lab dark theme */
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

/**
 * A reusable confirmation modal component with Cognitive Lab dark theme.
 * Supports standard confirmation and optional text input confirmation.
 * Uses React Portal to render at document body level.
 */
const ConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    children,
    confirmText = "Confirm",
    cancelText = "Cancel",
    confirmColor = "amber",
    isDestructive = false,
    requiredInputText = null,
    inputLabel = "Type the required text to confirm:",
    inputValue = "",
    onInputChange = () => {},
    confirmationPlaceholder = "",
    message,
    showEnterHint = false,
}) => {

    const isInputRequired = requiredInputText !== null && requiredInputText !== undefined;
    const [isConfirmed, setIsConfirmed] = useState(!isInputRequired);

    useEffect(() => {
        if (isInputRequired) {
            setIsConfirmed(inputValue.trim().toLowerCase() === requiredInputText.trim().toLowerCase());
        } else {
            setIsConfirmed(true);
        }
    }, [inputValue, requiredInputText, isInputRequired]);

    useEffect(() => {
        if (isOpen) {
            setIsConfirmed(!isInputRequired);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, isInputRequired]);

    const handleConfirm = useCallback(() => {
        if (isConfirmed) {
            onConfirm();
        } else {
            console.warn("ConfirmationModal: Confirm clicked but validation failed.");
        }
    }, [isConfirmed, onConfirm]);

    // Handle escape key to close modal and enter key to confirm
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'Enter' && isConfirmed) {
                e.preventDefault();
                handleConfirm();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, isConfirmed, handleConfirm]);

    const finalConfirmColor = isDestructive ? 'danger' : confirmColor;

    if (!isOpen) return null;

    const modalContent = (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '1rem',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
            }}
        >
            {/* Background overlay */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={onClose}
            />

            {/* Modal panel */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '32rem',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Body */}
                <div className="px-6 pt-6 pb-4">
                    <div className="sm:flex sm:items-start">
                        {/* Icon (show if destructive) */}
                        {isDestructive && (
                            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-neural-synapse/20 sm:mx-0 sm:h-10 sm:w-10">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="h-5 w-5 text-neural-synapse" aria-hidden="true" />
                            </div>
                        )}
                        <div className={`mt-3 text-center sm:mt-0 ${isDestructive ? 'sm:ml-4' : ''} sm:text-left w-full`}>
                            {/* Title */}
                            <h3 className="text-lg font-serif text-theme-text" id="modal-title">
                                {title}
                            </h3>
                            {/* Content */}
                            <div className="mt-3 text-sm text-theme-text-secondary font-mono space-y-2">
                                {children || message}
                            </div>

                            {/* Confirmation Input Section */}
                            {isInputRequired && (
                                <div className="mt-5">
                                    <label htmlFor="confirmation-input" className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                                        {inputLabel || `Type "${requiredInputText}" to confirm:`}
                                    </label>
                                    <input
                                        type="text"
                                        id="confirmation-input"
                                        className="block w-full px-4 py-3 bg-theme-bg-elevated border border-theme-line rounded-lab
                                            text-theme-text font-mono text-sm placeholder-warm-muted/50
                                            focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                                            transition-colors duration-200"
                                        value={inputValue}
                                        onChange={onInputChange}
                                        placeholder={confirmationPlaceholder || requiredInputText}
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck="false"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                    {/* Confirm Button */}
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!isConfirmed}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            border transition-all duration-200 inline-flex items-center justify-center gap-2
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${finalConfirmColor === 'danger'
                                ? 'bg-neural-synapse/20 hover:bg-neural-synapse/30 text-neural-synapse border-neural-synapse/50 focus:ring-neural-synapse'
                                : 'bg-theme-accent hover:bg-amber-highlight text-theme-bg border-theme-accent focus:ring-theme-accent'
                            }`}
                    >
                        {confirmText}
                        {showEnterHint && (
                            <kbd className="hidden sm:inline px-1.5 py-0.5 text-[0.6875rem] font-mono bg-theme-bg/20 rounded border border-charcoal/30 whitespace-nowrap">
                                ↵
                            </kbd>
                        )}
                    </button>

                    {/* Cancel Button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text
                            border border-theme-line transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );

    // Use React Portal to render modal at document body level
    return ReactDOM.createPortal(modalContent, document.body);
};

ConfirmationModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    title: PropTypes.string.isRequired,
    children: PropTypes.node,
    message: PropTypes.string,
    confirmText: PropTypes.string,
    cancelText: PropTypes.string,
    confirmColor: PropTypes.oneOf(['amber', 'danger']),
    isDestructive: PropTypes.bool,
    requiredInputText: PropTypes.string,
    inputLabel: PropTypes.string,
    inputValue: PropTypes.string,
    onInputChange: PropTypes.func,
    confirmationPlaceholder: PropTypes.string,
    showEnterHint: PropTypes.bool,
};

export default ConfirmationModal;
