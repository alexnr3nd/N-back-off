/* src/components/join/CoachInvitePage.js */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { functions, httpsCallable } from '../../firebaseConfig';
import LoadingSpinner from '../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldHalved, faChartLine, faBullseye, faCalendarCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';

const getCoachByInviteCodeFn = httpsCallable(functions, 'getCoachByInviteCode');
const joinCoachRosterFn = httpsCallable(functions, 'joinCoachRoster');

const PRACTICE_TYPE_LABELS = {
    adhd_coaching: 'ADHD Coach',
    sports_psychology: 'Sports Psychologist',
    academic_performance: 'Academic Performance Coach',
    cognitive_coaching: 'Cognitive Coach',
    clinical: 'Clinical Practitioner',
    other: 'Coach',
};

const CoachInvitePage = () => {
    const { inviteCode } = useParams();
    const navigate = useNavigate();
    const { authUser, userId, coachId, isLoading: isAuthLoading } = useUser();

    const [coachInfo, setCoachInfo] = useState(null);
    const [isLoadingCoach, setIsLoadingCoach] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Fetch coach info from invite code
    useEffect(() => {
        const fetchCoach = async () => {
            if (!inviteCode) {
                setError('No invite code provided.');
                setIsLoadingCoach(false);
                return;
            }
            try {
                const result = await getCoachByInviteCodeFn({ code: inviteCode });
                if (isMountedRef.current && result.data?.success) {
                    setCoachInfo(result.data.coach);
                }
            } catch (err) {
                console.error('[CoachInvitePage] Error fetching coach:', err);
                if (isMountedRef.current) {
                    setError(err.message || 'Invalid or expired invite code.');
                }
            } finally {
                if (isMountedRef.current) setIsLoadingCoach(false);
            }
        };
        fetchCoach();
    }, [inviteCode]);

    const handleJoin = async () => {
        if (isJoining) return;
        setIsJoining(true);
        setError(null);

        try {
            const result = await joinCoachRosterFn({ inviteCode });
            if (result.data?.success) {
                setSuccess(true);
                // Redirect to dashboard after a brief pause
                setTimeout(() => {
                    if (isMountedRef.current) navigate('/dashboard');
                }, 2000);
            }
        } catch (err) {
            console.error('[CoachInvitePage] Error joining roster:', err);
            if (isMountedRef.current) {
                setError(err.message || 'Failed to join. Please try again.');
                setIsJoining(false);
            }
        }
    };

    // Loading state
    if (isLoadingCoach || isAuthLoading) {
        return <LoadingSpinner message="Loading..." fullScreen theme="auto" />;
    }

    // Error state
    if (error && !coachInfo) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line p-8 text-center">
                    <h2 className="text-lg font-serif text-theme-text mb-4">Invalid Invite Link</h2>
                    <p className="text-sm text-theme-text-secondary mb-6">{error}</p>
                    <Link to="/login" className="text-sm font-mono text-theme-accent hover:underline">
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    // Success state
    if (success) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line p-8 text-center">
                    <div className="w-12 h-12 bg-theme-accent/20 border border-theme-accent/30 flex items-center justify-center mx-auto mb-4">
                        <FontAwesomeIcon icon={faShieldHalved} className="w-6 h-6 text-theme-accent" />
                    </div>
                    <h2 className="text-lg font-serif text-theme-text mb-2">You're Connected!</h2>
                    <p className="text-sm text-theme-text-secondary mb-2">
                        {coachInfo?.displayName} can now view your training progress.
                    </p>
                    <p className="text-xs text-theme-text-muted">
                        Redirecting to your dashboard...
                    </p>
                </div>
            </div>
        );
    }

    // Already has a coach
    if (authUser && coachId) {
        return (
            <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line p-8 text-center">
                    <h2 className="text-lg font-serif text-theme-text mb-4">Already Connected</h2>
                    <p className="text-sm text-theme-text-secondary mb-6">
                        You're already connected to a coach. To join a different coach,
                        please revoke access from your current coach first in Settings.
                    </p>
                    <Link to="/settings" className="text-sm font-mono text-theme-accent hover:underline">
                        Go to Settings
                    </Link>
                </div>
            </div>
        );
    }

    const practiceLabel = PRACTICE_TYPE_LABELS[coachInfo?.practiceType] || 'Coach';

    return (
        <div className="min-h-screen bg-theme-bg flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-theme-bg-secondary border border-theme-line">
                {/* Header */}
                <div className="border-b border-theme-line px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-2 h-2 bg-theme-accent rounded-full"></div>
                        </div>
                        <span className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted">
                            Coach Invitation
                        </span>
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 py-6">
                    <h2 className="text-xl font-serif text-theme-text mb-1">
                        {coachInfo?.displayName}
                    </h2>
                    <p className="text-sm font-mono text-theme-text-muted mb-6">
                        {practiceLabel}
                    </p>

                    {/* Consent block */}
                    <div className="bg-theme-bg border border-theme-line p-4 mb-6">
                        <p className="text-sm text-theme-text-secondary mb-4">
                            <strong className="text-theme-text">{coachInfo?.displayName}</strong> wants to view your training progress. They'll see:
                        </p>
                        <ul className="space-y-2">
                            {[
                                { icon: faChartLine, text: 'Your session history and scores' },
                                { icon: faBullseye, text: 'D-prime (performance accuracy) over time' },
                                { icon: faArrowRight, text: 'Your N-back level and progression' },
                                { icon: faCalendarCheck, text: 'How often you train' },
                            ].map(({ icon, text }) => (
                                <li key={text} className="flex items-center gap-3 text-sm text-theme-text-secondary">
                                    <FontAwesomeIcon icon={icon} className="w-4 h-4 text-theme-text-muted flex-shrink-0" />
                                    {text}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4 pt-3 border-t border-theme-line">
                            <p className="text-xs text-theme-text-muted flex items-center gap-2">
                                <FontAwesomeIcon icon={faShieldHalved} className="w-3 h-3" />
                                You can revoke access at any time from Settings.
                            </p>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                            {error}
                        </div>
                    )}

                    {/* Action */}
                    {authUser ? (
                        <button
                            onClick={handleJoin}
                            disabled={isJoining}
                            className="w-full px-5 py-3 text-sm font-mono uppercase tracking-wider
                                     text-theme-bg bg-theme-accent hover:bg-amber-highlight
                                     transition-all duration-200
                                     flex items-center justify-center gap-2
                                     disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isJoining ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-charcoal/30 border-t-charcoal rounded-full animate-spin"></div>
                                    Joining...
                                </>
                            ) : (
                                `Join as ${userId ? 'your account' : 'yourself'}`
                            )}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            <Link
                                to={`/signup?redirect=/join/coach/${inviteCode}`}
                                className="block w-full px-5 py-3 text-sm font-mono uppercase tracking-wider text-center
                                         text-theme-bg bg-theme-accent hover:bg-amber-highlight transition-all duration-200"
                            >
                                Sign Up to Join
                            </Link>
                            <Link
                                to={`/login?redirect=/join/coach/${inviteCode}`}
                                className="block w-full px-5 py-3 text-sm font-mono uppercase tracking-wider text-center
                                         text-theme-text-secondary border border-theme-line hover:border-warm-muted
                                         bg-theme-bg-elevated hover:bg-theme-bg-surface transition-all duration-200"
                            >
                                Log In to Join
                            </Link>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-theme-line px-6 py-3">
                    <p className="text-xs font-mono text-theme-text-muted text-center">
                        Consent version {/* v1.0 */}1.0
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CoachInvitePage;
