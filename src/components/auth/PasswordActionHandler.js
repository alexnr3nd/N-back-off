/* File: src/components/auth/PasswordActionHandler.js */
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
    verifyPasswordResetCode,
    confirmPasswordReset,
    applyActionCode // <<<--- IMPORT THIS
} from 'firebase/auth';
import { auth } from '../../firebaseConfig'; // Adjust path if needed
import { useLoading } from '../../contexts/LoadingContext'; // Import loading context

// Helper for user-friendly error messages (expanded)
const getActionErrorMessage = (errorCode, mode = 'unknown') => {
    switch (errorCode) {
        // Common Codes
        case 'auth/expired-action-code':
            return `This ${mode === 'verifyEmail' ? 'verification' : 'password reset'} link has expired. Please request a new one.`;
        case 'auth/invalid-action-code':
            return `This ${mode === 'verifyEmail' ? 'verification' : 'password reset'} link is invalid or has already been used.`;
        case 'auth/user-disabled':
            return 'This account has been disabled.';
        case 'auth/user-not-found':
            return 'No account found associated with this request.';
        // Password Reset Specific
        case 'auth/weak-password':
            return 'Password is too weak. Please choose a stronger password (at least 6 characters).';
        // Add other codes as needed
        default:
            console.error(`Unhandled Firebase Action Error Code (${mode}):`, errorCode);
            return 'An unexpected error occurred. Please try again.';
    }
};

const PasswordActionHandler = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showLoading, hideLoading, updateMessage } = useLoading();

    // Extract parameters from URL
    const mode = searchParams.get('mode');
    const actionCode = searchParams.get('oobCode');

    const [isLoading, setIsLoading] = useState(true); // Local loading state for initial phase
    const [error, setError] = useState(null); // General error or password reset specific error
    const [successMessage, setSuccessMessage] = useState(''); // Password reset success
    const [isValidCode, setIsValidCode] = useState(false); // For showing password reset form
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verifiedEmail, setVerifiedEmail] = useState(''); // Store email for display

    // --- NEW State for Email Verification ---
    const [verificationStatus, setVerificationStatus] = useState('pending'); // 'pending', 'success', 'error'
    const [verificationError, setVerificationError] = useState(null);

    useEffect(() => {
        setIsLoading(true); // Start loading
        setError(null); // Clear previous errors
        setVerificationError(null);

        if (!actionCode) {
            setError('Missing required action code.');
            setIsLoading(false);
            return;
        }

        // Handle different modes
        switch (mode) {
            case 'resetPassword':
                showLoading("Verifying reset code...");
                verifyPasswordResetCode(auth, actionCode)
                    .then((email) => {
                        setVerifiedEmail(email);
                        setIsValidCode(true);
                    })
                    .catch((err) => {
                        console.error("Error verifying password reset code:", err);
                        setError(getActionErrorMessage(err.code, 'resetPassword'));
                        setIsValidCode(false);
                    })
                    .finally(() => {
                        setIsLoading(false);
                        hideLoading();
                    });
                break;

            case 'verifyEmail':
                showLoading("Verifying email address...");
                setVerificationStatus('pending');
                applyActionCode(auth, actionCode)
                    .then(() => {
                        setVerificationStatus('success');
                        // Optional: Fetch the user's email to display, requires getting currentUser after successful verification
                        // This might be tricky if user isn't logged in on this browser tab.
                        // For now, just show a generic success message.
                        // auth.currentUser?.reload(); // Force refresh user state if needed
                    })
                    .catch((err) => {
                        console.error("Error applying email verification code:", err);
                        setVerificationError(getActionErrorMessage(err.code, 'verifyEmail'));
                        setVerificationStatus('error');
                    })
                    .finally(() => {
                        setIsLoading(false);
                        hideLoading();
                    });
                break;

            default:
                setError('Invalid action specified.');
                setIsLoading(false);
                hideLoading(); // Hide loading if mode is invalid
                break;
        }

    // Only depend on mode and actionCode for triggering the effect logic
    // showLoading/hideLoading are stable references from context typically
    }, [mode, actionCode]); // Added context functions as deps

    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setError(null); // Clear only password reset error field
        setSuccessMessage('');

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        showLoading("Resetting password...");
        try {
            await confirmPasswordReset(auth, actionCode, newPassword);
            setSuccessMessage('Password reset successfully! You can now log in with your new password.');
            setIsValidCode(false); // Hide form
            setTimeout(() => navigate('/login'), 4000);
        } catch (err) {
            console.error("Error confirming password reset:", err);
            setError(getActionErrorMessage(err.code, 'resetPassword'));
        } finally {
            hideLoading();
        }
    };

    // Render Initial Loading State (optional, context loader might be enough)
    if (isLoading && !error && !successMessage && !isValidCode && verificationStatus === 'pending') {
        // While initially verifying code for ANY mode
        return null; // Rely on global loading context
    }

    // Main Render
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm">

                {/* === MODE: verifyEmail === */}
                {mode === 'verifyEmail' && (
                    <>
                        {verificationStatus === 'success' && (
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-center mb-4 text-green-700">
                                    Email Verified
                                </h1>
                                <p className="mb-6 text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200" role="status">
                                    Your email address has been successfully verified.
                                </p>
                                <Link
                                    to="/login"
                                    className="w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Go to Login
                                </Link>
                            </div>
                        )}
                        {verificationStatus === 'error' && (
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-center mb-4 text-red-700">
                                    Email Verification Failed
                                </h1>
                                <p className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200" role="alert">
                                    {verificationError || 'Could not verify your email.'}
                                </p>
                                <Link
                                    to="/login"
                                    className="w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Go to Login
                                </Link>
                            </div>
                        )}
                        {/* No form needed for verification */}
                    </>
                )}

                {/* === MODE: resetPassword === */}
                {mode === 'resetPassword' && (
                    <>
                        {/* Display Error State (Code Invalid/Expired) */}
                        {error && !isValidCode && !successMessage && (
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-center mb-4 text-red-700">
                                    Password Reset Failed
                                </h1>
                                <p className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200" role="alert">
                                    {error}
                                </p>
                                <Link
                                    to="/login" // Maybe link to password reset request page instead?
                                    className="w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Go to Login
                                </Link>
                            </div>
                        )}

                        {/* Display Success State (Password Reset) */}
                        {successMessage && (
                            <div className="text-center">
                                <h1 className="text-xl font-bold text-center mb-4 text-green-700">
                                    Password Reset Successful
                                </h1>
                                <p className="mb-6 text-sm text-green-600 bg-green-50 p-3 rounded border border-green-200" role="status">
                                    {successMessage}
                                </p>
                                <Link
                                    to="/login"
                                    className="w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Go to Login
                                </Link>
                            </div>
                        )}

                        {/* Display Password Reset Form (if code is valid and not success/error) */}
                        {isValidCode && !successMessage && (
                            <>
                                <h1 className="text-xl font-bold text-center mb-2 text-gray-800">
                                    Set New Password
                                </h1>
                                {verifiedEmail && (
                                    <p className="text-center text-sm text-gray-500 mb-6">
                                        Resetting password for: <span className="font-medium">{verifiedEmail}</span>
                                    </p>
                                )}
                                <form onSubmit={handlePasswordReset}>
                                    {/* New Password Input */}
                                    <div className="mb-4">
                                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                            New Password
                                        </label>
                                        <input
                                            type="password"
                                            id="newPassword"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            required
                                            minLength="6"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="•••••••• (min. 6 chars)"
                                            aria-label="New Password"
                                        />
                                    </div>

                                    {/* Confirm New Password Input */}
                                    <div className="mb-6">
                                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                                            Confirm New Password
                                        </label>
                                        <input
                                            type="password"
                                            id="confirmPassword"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            minLength="6"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                            placeholder="••••••••"
                                            aria-label="Confirm New Password"
                                        />
                                    </div>

                                    {/* Display Form-Specific Error */}
                                    {error && ( // Display password reset form errors here
                                        <p className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200" role="alert">
                                            {error}
                                        </p>
                                    )}

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        Save New Password
                                    </button>
                                </form>
                            </>
                        )}
                    </>
                )}

                {/* === MODE: Invalid/Unknown === */}
                 {mode !== 'verifyEmail' && mode !== 'resetPassword' && error && (
                     <div className="text-center">
                         <h1 className="text-xl font-bold text-center mb-4 text-red-700">
                             Action Failed
                         </h1>
                         <p className="mb-6 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200" role="alert">
                             {error} {/* Display the 'Invalid action specified' or other general errors */}
                         </p>
                         <Link
                             to="/login"
                             className="w-full block text-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                         >
                             Go to Login
                         </Link>
                     </div>
                 )}


            </div>
        </div>
    );
};

export default PasswordActionHandler;