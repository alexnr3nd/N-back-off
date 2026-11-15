/* eslint-disable react-hooks/exhaustive-deps */

// src/components/feedback/FeedbackModal.js
import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '../../contexts/UserContext';
import ButtonSpinner from '../ui/ButtonSpinner';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFormattedCapturedLogs } from '../../utils/logInterceptor'; // Import log getter
import { isNative } from '../../utils/platform';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faTimes,
    faCheck,
    faExclamationCircle,
    faCommentDots,
    faQuestionCircle,
    faBug,
    faLightbulb,
    faEllipsisH
} from '@fortawesome/free-solid-svg-icons';

const functions = getFunctions();
const submitFeedbackFn = httpsCallable(functions, 'submitFeedback');

const FeedbackModal = ({ isOpen, onClose }) => {
    // Use ProfileContext to get auth user AND userId
    const { authUser, userId } = useUser();
    const [feedbackText, setFeedbackText] = useState('');
    const [userProvidedEmail, setUserProvidedEmail] = useState('');
    const [category, setCategory] = useState('General Feedback');
    const [includeLogs, setIncludeLogs] = useState(false); // State for the checkbox
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const formRef = useRef(null);

    const feedbackCategories = [
        { id: "General Feedback", icon: faCommentDots },
        { id: "Bug Report", icon: faBug },
        { id: "Feature Request", icon: faLightbulb },
        { id: "Question", icon: faQuestionCircle },
        { id: "Other", icon: faEllipsisH }
    ];

    // Pre-fill email if user is logged in when modal opens & reset form
    useEffect(() => {
        if (isOpen) {
             // Use authUser email if available and userProvidedEmail hasn't been set yet
             if (authUser?.email && !userProvidedEmail) {
                 setUserProvidedEmail(authUser.email);
             }
        }

        // Reset form when opening/closing
        if (!isOpen) {
            setFeedbackText('');
            // Reset email to auth user's email or empty if no auth user
            setUserProvidedEmail(authUser?.email || '');
            setCategory('General Feedback');
            setIncludeLogs(false); // Reset checkbox
            setError('');
            setSuccessMessage('');
            setIsSubmitting(false);
        }
    }, [isOpen, authUser]); // Rerun effect if isOpen or authUser changes

    // Handle clicking outside to close (if not submitting)
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (formRef.current && !formRef.current.contains(e.target) && !isSubmitting && isOpen) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSubmitting, onClose, isOpen]);

    // Escape key handler
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && !isSubmitting && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isSubmitting, onClose, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!feedbackText.trim()) {
            setError('Please enter your feedback.');
            return;
        }
        if (feedbackText.length > 5000) {
            setError('Feedback is too long (max 5000 characters).');
            return;
        }

        setIsSubmitting(true);
        setError('');
        setSuccessMessage('');

        try {
             // Capture console logs if requested
             let consoleLogs = null;
             if (includeLogs) {
                 consoleLogs = getFormattedCapturedLogs(); // Get formatted logs (max length default 50k)
             }

             // Installed app version (native only — App.getInfo() throws on web,
             // where the deployed bundle is always current anyway). Lets support
             // tell whether a reporter is on an old APK without asking.
             let appVersion = null;
             if (isNative()) {
                 try {
                     const { App } = await import('@capacitor/app');
                     const info = await App.getInfo();
                     appVersion = `${info.version} (${info.build})`;
                 } catch (versionErr) {
                     // Best-effort; submit without it
                 }
             }

             // Create the payload object with keys matching the backend function expectations
             const payload = {
                 // Renamed 'category' to 'feedbackType'
                 feedbackType: category,
                 // Renamed 'feedbackText' to 'message'
                 message: feedbackText.trim(),
                 // Renamed 'userProvidedEmail' to 'email'
                 email: userProvidedEmail.trim() || null, // Send trimmed email or null if empty

                 // Added context information expected by the backend
                 userId: authUser?.uid || null, // Get user ID from context if available
                 profileId: userId || null, // Get profile ID from context if available

                 // Kept these as they are useful context for the backend
                 pageUrl: window.location.href,
                 userAgent: navigator.userAgent,
                 consoleLogs: consoleLogs, // Add logs to payload (will be null if not included)
                 appVersion: appVersion, // Installed native build, e.g. "1.1.43 (94)"; null on web
             };
             // Log payload for debugging if needed (remove in production)


            // Call the Cloud Function with the corrected payload
            const result = await submitFeedbackFn(payload);

            // The backend function itself doesn't return success/message in data for onCall v2 success
            // It returns an empty object on success or throws an HttpsError on failure.
            // We'll assume success if no error is thrown.
            setSuccessMessage('Thank you for your feedback! It has been submitted successfully.'); // Set generic success message
            setTimeout(() => {
               onClose(); // Close modal after a delay
            }, 2500);

        } catch (err) {
            console.error("Error submitting feedback:", err);
            // err.message will contain the message from HttpsError thrown by the backend
            setError(err.message || 'Failed to submit feedback. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        >
            <div
                ref={formRef}
                className="bg-theme-bg-secondary border border-theme-border p-6 rounded-lg shadow-xl w-full max-w-lg transform transition-all relative"
                style={{ maxHeight: '90vh', overflowY: 'auto' }}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-theme-text-muted hover:text-theme-text p-1 rounded-full transition-colors"
                    aria-label="Close feedback modal"
                    disabled={isSubmitting}
                >
                    <FontAwesomeIcon icon={faTimes} size="lg" />
                </button>

                <div className="flex items-center mb-6">
                    <div className="bg-theme-accent/20 p-3 rounded-full mr-3">
                        <FontAwesomeIcon icon={faCommentDots} className="text-theme-accent" />
                    </div>
                    <h3 className="text-xl font-medium text-theme-text">We'd Love Your Feedback</h3>
                </div>

                {successMessage ? (
                    <div className="text-center p-6 bg-status-success/20 text-status-success rounded-md">
                        <div className="flex justify-center mb-3">
                            <div className="bg-status-success/30 p-3 rounded-full">
                                <FontAwesomeIcon icon={faCheck} className="text-status-success text-xl" />
                            </div>
                        </div>
                        <p className="text-lg font-medium mb-1">{successMessage}</p>
                        {/* Removed sub-text as backend doesn't provide specific message on success */}
                    </div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        {/* Category Selector */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                                What type of feedback do you have?
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {feedbackCategories.map(cat => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategory(cat.id)}
                                        className={`flex items-center py-2 px-3 rounded-md border text-sm transition-colors ${
                                            category === cat.id
                                                ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/50'
                                                : 'bg-theme-bg-elevated text-theme-text-secondary border-theme-border hover:bg-theme-bg-surface'
                                        }`}
                                        disabled={isSubmitting}
                                    >
                                        <FontAwesomeIcon
                                            icon={cat.icon}
                                            className={`mr-2 ${category === cat.id ? 'text-theme-accent' : 'text-theme-text-muted'}`}
                                        />
                                        <span>{cat.id}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Feedback Textarea */}
                        <div className="mb-4">
                            <label htmlFor="feedbackText" className="block text-sm font-medium text-theme-text-secondary mb-2">
                                Your Feedback <span className="text-status-error">*</span>
                            </label>
                            <textarea
                                id="feedbackText"
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Share your thoughts, report a bug, or suggest a feature..."
                                rows="5"
                                required
                                maxLength={5000}
                                className="w-full p-3 border border-theme-border rounded-md bg-theme-bg-elevated text-theme-text placeholder-warm-muted focus:ring-theme-accent focus:border-theme-accent"
                                aria-label="Feedback details"
                                disabled={isSubmitting}
                            />
                            <div className="flex justify-end mt-1 text-xs text-theme-text-muted">
                                <span>{feedbackText.length}/5000</span>
                            </div>
                        </div>

                        {/* Email Input (Optional) */}
                        <div className="mb-4">
                            <label htmlFor="feedbackEmail" className="block text-sm font-medium text-theme-text-secondary mb-2">
                                Your Email <span className="text-xs text-theme-text-muted font-normal">(Optional)</span>
                            </label>
                            <input
                                type="email"
                                id="feedbackEmail"
                                value={userProvidedEmail}
                                onChange={(e) => setUserProvidedEmail(e.target.value)}
                                placeholder={authUser?.email ? "Using your account email" : "example@domain.com"}
                                className="w-full p-3 border border-theme-border rounded-md bg-theme-bg-elevated text-theme-text placeholder-warm-muted focus:ring-theme-accent focus:border-theme-accent"
                                aria-label="Your email for follow-up"
                                disabled={isSubmitting}
                            />
                            <p className="text-xs text-theme-text-muted mt-1">We'll only use this to follow up on your feedback if needed.</p>
                        </div>

                        {/* Include Console Logs Checkbox */}
                        <div className="mb-6">
                            <div className="flex items-start">
                                <div className="flex items-center h-5">
                                    <input
                                        id="includeLogs"
                                        name="includeLogs"
                                        type="checkbox"
                                        checked={includeLogs}
                                        onChange={(e) => setIncludeLogs(e.target.checked)}
                                        className="focus:ring-theme-accent h-4 w-4 text-theme-accent bg-theme-bg-elevated border-theme-border rounded"
                                        disabled={isSubmitting}
                                    />
                                </div>
                                <div className="ml-3 text-sm">
                                    <label htmlFor="includeLogs" className="font-medium text-theme-text-secondary">
                                        Include technical logs
                                    </label>
                                    <p className="text-xs text-theme-text-muted">
                                        Check this box to send recent browser console logs with your feedback. This helps us troubleshoot technical issues but may include diagnostic data.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-status-error/20 rounded-md mb-4">
                                <div className="flex">
                                    <FontAwesomeIcon icon={faExclamationCircle} className="text-status-error mt-0.5 mr-2" />
                                    <p className="text-sm text-status-error">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-between items-center"> {/* Use items-center for vertical alignment */}
                             <button
                                 type="button"
                                 onClick={onClose}
                                 disabled={isSubmitting}
                                 className="px-4 py-2 bg-theme-bg-elevated text-theme-text-secondary rounded-md hover:bg-theme-bg-surface border border-theme-border disabled:opacity-50"
                             >
                                 Cancel
                             </button>

                            <button
                                type="submit"
                                disabled={isSubmitting || !feedbackText.trim()}
                                className="px-6 py-2 min-w-[140px] h-10 bg-theme-accent text-theme-bg rounded-md hover:bg-amber-highlight disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center font-medium" // Added h-10 for consistent height
                            >
                                {isSubmitting ? (
                                    <ButtonSpinner color="charcoal" />
                                ) : (
                                    "Submit Feedback"
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
