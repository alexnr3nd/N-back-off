/* src/components/coach/CoachSignup.js */
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { functions, httpsCallable } from '../../firebaseConfig';
import LoadingSpinner from '../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBrain, faCheckCircle } from '@fortawesome/free-solid-svg-icons';

const coachSignupFn = httpsCallable(functions, 'coachSignup');

const PRACTICE_TYPES = [
    { value: 'adhd_coaching', label: 'ADHD Coaching' },
    { value: 'sports_psychology', label: 'Sports Psychology' },
    { value: 'academic_performance', label: 'Academic Performance' },
    { value: 'cognitive_coaching', label: 'Cognitive Coaching' },
    { value: 'clinical', label: 'Clinical' },
    { value: 'other', label: 'Other' },
];

const CoachSignup = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const { authUser, isLoading: isAuthLoading } = useUser();

    const [displayName, setDisplayName] = useState('');
    const [practiceType, setPracticeType] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    if (isAuthLoading) {
        return <LoadingSpinner message="Loading..." fullScreen theme="auto" />;
    }

    if (!authUser) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line p-8 text-center">
                    <h2 className="text-lg font-serif text-theme-text mb-4">Sign In Required</h2>
                    <p className="text-sm text-theme-text-secondary mb-6">
                        Please sign in or create an account to complete your coach registration.
                    </p>
                    <Link
                        to={`/login?redirect=/coach/signup/${token}`}
                        className="text-sm font-mono text-theme-accent hover:underline"
                    >
                        Go to Login
                    </Link>
                    <span className="text-sm text-theme-text-muted mx-2">or</span>
                    <Link
                        to={`/signup?redirect=/coach/signup/${token}`}
                        className="text-sm font-mono text-theme-accent hover:underline"
                    >
                        Create Account
                    </Link>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line p-8 text-center">
                    <div className="w-12 h-12 bg-neural-dendrite/20 border border-neural-dendrite/30 flex items-center justify-center mx-auto mb-4">
                        <FontAwesomeIcon icon={faCheckCircle} className="w-6 h-6 text-neural-dendrite" />
                    </div>
                    <h2 className="text-lg font-serif text-theme-text mb-2">Welcome, Coach!</h2>
                    <p className="text-sm text-theme-text-secondary mb-6">
                        Your coach account has been created. You can now access the Coach Portal.
                    </p>
                    <button
                        onClick={() => {
                            // Force token refresh to pick up new coach claim
                            authUser.getIdToken(true).then(() => {
                                navigate('/coach/dashboard');
                            });
                        }}
                        className="px-6 py-3 text-sm font-mono uppercase tracking-wider
                                 text-theme-bg bg-theme-accent hover:bg-amber-highlight transition-all duration-200"
                    >
                        Go to Coach Portal
                    </button>
                </div>
            </div>
        );
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!displayName.trim() || !practiceType) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const result = await coachSignupFn({
                token,
                displayName: displayName.trim(),
                practiceType,
            });
            if (result.data?.success) {
                setSuccess(true);
            }
        } catch (err) {
            console.error('[CoachSignup] Error:', err);
            if (isMountedRef.current) {
                setError(err.message || 'Registration failed. Please try again.');
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line">
                {/* Header */}
                <div className="border-b border-theme-line px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-theme-accent/20 border border-theme-accent/40 flex items-center justify-center">
                        <FontAwesomeIcon icon={faBrain} className="w-4 h-4 text-theme-accent" />
                    </div>
                    <div>
                        <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Coach Registration
                        </span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
                    <div>
                        <label htmlFor="displayName" className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                            Display Name
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="How clients will see your name"
                            required
                            className="w-full px-4 py-3 bg-theme-bg border border-theme-line text-theme-text
                                     placeholder-warm-muted/50 font-mono text-sm
                                     focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                                     transition-all duration-200"
                        />
                    </div>

                    <div>
                        <label htmlFor="practiceType" className="block text-xs font-mono uppercase tracking-wider text-theme-text-muted mb-2">
                            Practice Type
                        </label>
                        <select
                            id="practiceType"
                            value={practiceType}
                            onChange={(e) => setPracticeType(e.target.value)}
                            required
                            className="w-full pl-4 pr-10 py-3 bg-theme-bg border border-theme-line text-theme-text
                                     font-mono text-sm
                                     focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent
                                     transition-all duration-200"
                        >
                            <option value="">Select your practice type</option>
                            {PRACTICE_TYPES.map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {error && (
                        <div className="p-3 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !displayName.trim() || !practiceType}
                        className="w-full px-5 py-3 text-sm font-mono uppercase tracking-wider
                                 text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                 transition-all duration-200
                                 flex items-center justify-center gap-2
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="h-4 w-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin"></div>
                                Creating Account...
                            </>
                        ) : (
                            'Complete Registration'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CoachSignup;
