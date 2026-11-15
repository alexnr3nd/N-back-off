/* src/components/game/HealthSafetyNoticeModal.js
 *
 * One-time, blocking, clickwrap acknowledgment modal shown before a user's
 * first training session. Deliberately does NOT dismiss on Escape or backdrop
 * click — this is a mandatory legal acknowledgment. W3C ARIA APG recognizes
 * legal-acknowledgment dialogs as an accepted exception to the usual
 * Escape-to-close behavior; WCAG 2.1.2 is satisfied as long as keyboard focus
 * can move within the dialog.
 *
 * See plan: ~/.claude/plans/we-need-to-work-abstract-quilt.md
 * See research citations in that plan for WCAG APG, Chabolla v. ClassPass
 * (button-label specificity), and GDPR Art. 6(1)(f) framing.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import ButtonSpinner from '../ui/ButtonSpinner';

const TERMS_HREF = 'https://dualnback.com/terms';
const PRIVACY_HREF = 'https://dualnback.com/privacy';

const HealthSafetyNoticeModal = ({
    isOpen,
    notice,
    isFirstSession = false,
    onAffirm,
    onDecline,
    onShown,
    onLinkClicked,
}) => {
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const titleRef = useRef(null);
    const panelRef = useRef(null);
    const hasFiredShown = useRef(false);

    const displayTitle = (isFirstSession && notice?.titleFirstSession) || notice?.title;

    // Reset local state each time the modal opens, and fire the shown event.
    useEffect(() => {
        if (isOpen) {
            setChecked(false);
            setSubmitting(false);
            setError(null);
            document.body.style.overflow = 'hidden';
            if (!hasFiredShown.current) {
                hasFiredShown.current = true;
                if (onShown) onShown();
            }
            // Move focus to the title so screen readers read from the top.
            requestAnimationFrame(() => {
                if (titleRef.current) titleRef.current.focus();
            });
        } else {
            document.body.style.overflow = '';
            hasFiredShown.current = false;
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen, onShown]);

    // Focus trap: keep Tab cycling inside the panel.
    useEffect(() => {
        if (!isOpen) return undefined;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Deliberately swallowed — this is a mandatory acknowledgment.
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.key !== 'Tab' || !panelRef.current) return;

            const focusable = panelRef.current.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => document.removeEventListener('keydown', handleKeyDown, true);
    }, [isOpen]);

    const handleAffirm = useCallback(async () => {
        if (!checked || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await onAffirm();
            // Parent closes the modal on success.
        } catch (err) {
            console.error('[HealthSafetyNoticeModal] affirm failed:', err);
            setError("We couldn't record your acknowledgment. Please check your connection and try again.");
            setSubmitting(false);
        }
    }, [checked, submitting, onAffirm]);

    const handleDecline = useCallback(() => {
        if (submitting) return;
        onDecline();
    }, [submitting, onDecline]);

    const handleLinkClick = useCallback((which) => {
        if (onLinkClicked) onLinkClicked(which);
    }, [onLinkClicked]);

    if (!isOpen || !notice) return null;

    const renderBullet = (b, idx) => {
        if (typeof b === 'string') {
            return <li key={idx} className="text-theme-text-secondary">{b}</li>;
        }
        return (
            <li key={idx} className="text-theme-text-secondary">
                <span className="text-theme-text font-semibold">{b.label}</span> {b.body}
            </li>
        );
    };

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
            {/* Backdrop — click does NOT dismiss (mandatory acknowledgment). */}
            <div
                aria-hidden="true"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.85)',
                    backdropFilter: 'blur(4px)',
                }}
            />

            {/* Panel */}
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="health-safety-title"
                aria-describedby="health-safety-body"
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '36rem',
                    backgroundColor: 'rgb(var(--color-bg-secondary))',
                    border: '1px solid rgb(var(--color-line))',
                    borderRadius: '2px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    marginTop: 'auto',
                    marginBottom: 'auto',
                }}
            >
                <div className="px-6 pt-6 pb-4">
                    <h2
                        id="health-safety-title"
                        ref={titleRef}
                        tabIndex={-1}
                        className="text-xl sm:text-2xl font-serif text-theme-text outline-none"
                    >
                        {displayTitle}
                    </h2>

                    <div
                        id="health-safety-body"
                        tabIndex={0}
                        className="mt-4 text-sm font-mono text-theme-text-secondary space-y-4 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar"
                    >
                        <p>{notice.intro}</p>
                        {notice.sections.map((section, i) => (
                            <div key={i} className="space-y-1.5">
                                <p className="text-theme-text font-semibold">{section.heading}</p>
                                {section.bullets && (
                                    <ul className="list-disc pl-5 space-y-1">
                                        {section.bullets.map(renderBullet)}
                                    </ul>
                                )}
                                {section.body && <p>{section.body}</p>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Checkbox */}
                <div className="px-6 pb-3">
                    <label className="flex items-start gap-3 text-sm font-mono text-theme-text cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => setChecked(e.target.checked)}
                            disabled={submitting}
                            className="mt-1 h-4 w-4 flex-shrink-0 accent-theme-accent cursor-pointer"
                        />
                        <span>{notice.checkboxLabel}</span>
                    </label>
                </div>

                {/* Links */}
                <div className="px-6 pb-3 text-xs font-mono text-theme-text-muted">
                    <a
                        href={TERMS_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick('terms')}
                        className="text-theme-accent hover:text-amber-highlight underline underline-offset-2"
                    >
                        Read full Terms
                    </a>
                    <span className="mx-2 text-theme-line">·</span>
                    <a
                        href={PRIVACY_HREF}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => handleLinkClick('privacy')}
                        className="text-theme-accent hover:text-amber-highlight underline underline-offset-2"
                    >
                        Privacy Policy
                    </a>
                </div>

                {/* Error */}
                {error && (
                    <div className="px-6 pb-2 text-xs font-mono text-neural-synapse" role="alert">
                        {error}
                    </div>
                )}

                {/* Footer buttons */}
                <div className="bg-theme-bg-elevated px-6 py-4 border-t border-theme-line sm:flex sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        onClick={handleAffirm}
                        disabled={!checked || submitting}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            border transition-all duration-200 inline-flex items-center justify-center gap-2
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary
                            disabled:opacity-50 disabled:cursor-not-allowed
                            bg-theme-accent hover:bg-amber-highlight text-theme-bg border-theme-accent focus:ring-theme-accent"
                    >
                        {submitting ? (
                            <>
                                <ButtonSpinner color="charcoal" />
                                <span>Saving…</span>
                            </>
                        ) : (
                            notice.affirmButtonLabel
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleDecline}
                        disabled={submitting}
                        className="w-full sm:w-auto mt-3 sm:mt-0 px-5 py-2.5 rounded-lab text-sm font-mono uppercase tracking-wider
                            bg-theme-bg-secondary hover:bg-theme-bg-surface text-theme-text-secondary hover:text-theme-text
                            border border-theme-line transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-bg-secondary focus:ring-theme-accent
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {notice.declineButtonLabel}
                    </button>
                </div>

                <div className="px-6 pb-4 text-[0.625rem] font-mono text-theme-text-muted/70 text-center">
                    Health &amp; Safety Notice v{notice.version} ({notice.locale})
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};

HealthSafetyNoticeModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    notice: PropTypes.shape({
        version: PropTypes.string.isRequired,
        locale: PropTypes.string.isRequired,
        title: PropTypes.string.isRequired,
        titleFirstSession: PropTypes.string,
        intro: PropTypes.string.isRequired,
        sections: PropTypes.array.isRequired,
        checkboxLabel: PropTypes.string.isRequired,
        affirmButtonLabel: PropTypes.string.isRequired,
        declineButtonLabel: PropTypes.string.isRequired,
    }),
    isFirstSession: PropTypes.bool,
    onAffirm: PropTypes.func.isRequired,
    onDecline: PropTypes.func.isRequired,
    onShown: PropTypes.func,
    onLinkClicked: PropTypes.func,
};

export default HealthSafetyNoticeModal;
