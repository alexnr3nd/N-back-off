/* src/components/auth/PasswordReset.js */
/* Cognitive Lab Theme - Password Recovery Interface */

import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import ButtonSpinner from '../ui/ButtonSpinner';

// Echo Mark Logo Component
const EchoMarkLogo = () => (
    <svg width="56" height="56" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="44" y="44" width="48" height="48" rx="8" fill="none" stroke="#E4B85C" strokeWidth="3" opacity="0.4" />
        <rect x="28" y="28" width="48" height="48" rx="8" fill="#E4B85C" />
    </svg>
);

// Helper function for user-friendly error messages during password reset
const getResetErrorMessage = (errorCode) => {
    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/user-not-found':
            // Avoid confirming if an email exists for security, use a generic message.
            return 'If an account exists for this email, a password reset link has been sent.';
        case 'auth/missing-email':
            return 'Please enter your email address.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait a few minutes and try again.';
        default:
            console.error("Unhandled Firebase Reset Error Code:", errorCode);
            return 'An error occurred while trying to send the reset email. Please try again.';
    }
};

const PasswordReset = ({ onSwitchToLogin }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleResetRequest = async (e) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).');
            setIsLoading(false);
        } catch (firebaseError) {
            console.error("Firebase Password Reset Error:", firebaseError.code, firebaseError.message);
            const friendlyMessage = getResetErrorMessage(firebaseError.code);
            if (firebaseError.code === 'auth/user-not-found') {
                setMessage('If an account exists for this email, a password reset link has been sent. Please check your inbox (and spam folder).');
            } else {
                setError(friendlyMessage);
            }
            setIsLoading(false);
        }
    };

    const navigateToLogin = () => {
        if (onSwitchToLogin && typeof onSwitchToLogin === 'function') {
            onSwitchToLogin();
        } else {
            console.error("PasswordReset: onSwitchToLogin prop missing or not a function!");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-theme-bg px-4">
            <div className={`bg-theme-bg-secondary border border-theme-line p-8 rounded-lg shadow-lab w-full max-w-sm transition-opacity duration-200 ${isLoading ? 'opacity-80' : 'opacity-100'}`}>
                {/* Logo and Title */}
                <div className="flex flex-col items-center mb-6">
                    <div className="mb-3">
                        <EchoMarkLogo />
                    </div>
                    <h1 className="text-xl font-bold text-center text-theme-text font-sans">Dual N-Back</h1>
                    <p className="text-xs font-medium sm:text-[0.6875rem] sm:font-normal text-theme-text-muted mt-1 font-mono uppercase tracking-wider">Password Recovery</p>
                </div>

                {/* Description */}
                <p className="text-center text-[0.6875rem] text-theme-text-muted mb-6 font-mono">
                    Enter your email address below, and we'll send you a link to reset your password.
                </p>

                {/* Reset Form */}
                <form onSubmit={handleResetRequest} noValidate>
                    {/* Email Input */}
                    <div className="mb-4">
                        <label htmlFor="reset-email" className="block text-xs font-medium sm:text-[0.6875rem] sm:font-normal font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="reset-email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                            className="w-full px-3 py-2.5 bg-theme-bg-elevated border border-theme-line rounded text-theme-text placeholder-warm-muted/50 focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            placeholder="you@example.com"
                            aria-label="Email Address"
                            autoComplete="email"
                        />
                    </div>

                    {/* Error Message Display */}
                    {error && (
                        <p className="mb-4 text-sm text-neural-synapse bg-neural-synapse/10 p-3 rounded border border-neural-synapse/30 text-center" role="alert">
                            {error}
                        </p>
                    )}

                    {/* Success/Info Message Display */}
                    {message && (
                        <p className="mb-4 text-sm text-neural-dendrite bg-neural-dendrite/10 p-3 rounded border border-neural-dendrite/30 text-center" role="status">
                            {message}
                        </p>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={!email || isLoading}
                        className="py-2.5 px-4 rounded text-sm font-mono uppercase tracking-wider text-theme-bg bg-theme-accent hover:bg-amber-highlight focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-charcoal-surface focus:ring-theme-accent w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                        {isLoading ? (
                            <>
                                <ButtonSpinner color="charcoal" />
                                <span className="ml-2">Sending...</span>
                            </>
                        ) : (
                            'Send Reset Link'
                        )}
                    </button>
                </form>

                {/* Link back to Login */}
                <div className="mt-6 text-sm text-center">
                    <button
                        type="button"
                        onClick={navigateToLogin}
                        disabled={isLoading}
                        className="font-mono text-xs text-theme-accent hover:text-amber-highlight disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PasswordReset;
