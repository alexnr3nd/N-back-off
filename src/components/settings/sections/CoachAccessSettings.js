/* src/components/settings/sections/CoachAccessSettings.js */
import React, { useState, useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserTie, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { functions, httpsCallable } from '../../../firebaseConfig';

const revokeCoachAccessFn = httpsCallable(functions, 'revokeCoachAccess');

const CoachAccessSettings = ({ coachId, coachGrantedPremium, onRevoked }) => {
    const [isRevoking, setIsRevoking] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    if (!coachId) return null;

    const handleRevoke = async () => {
        setIsRevoking(true);
        setError(null);
        try {
            await revokeCoachAccessFn();
            if (isMountedRef.current) {
                setSuccess(true);
                setShowConfirm(false);
                if (onRevoked) onRevoked();
            }
        } catch (err) {
            console.error('[CoachAccessSettings] Revoke error:', err);
            if (isMountedRef.current) {
                setError(err.message || 'Failed to revoke access.');
            }
        } finally {
            if (isMountedRef.current) setIsRevoking(false);
        }
    };

    if (success) {
        return (
            <div>
                <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted mb-3 flex items-center gap-2">
                    <FontAwesomeIcon icon={faUserTie} className="w-3.5 h-3.5" />
                    Coach Access
                </h3>
                <div className="bg-neural-dendrite/10 border border-neural-dendrite/30 p-4">
                    <p className="text-sm font-mono text-neural-dendrite">
                        Coach access has been revoked.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted mb-3 flex items-center gap-2">
                <FontAwesomeIcon icon={faUserTie} className="w-3.5 h-3.5" />
                Coach Access
            </h3>

            <div className="bg-theme-bg border border-theme-line p-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-theme-text mb-1">
                            Connected to a coach
                        </p>
                        <p className="text-xs text-theme-text-muted mb-2">
                            Your coach can view your training progress, session history, and performance metrics.
                        </p>
                        {coachGrantedPremium && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-theme-accent/20 text-theme-accent text-xs font-mono border border-theme-accent/30">
                                <FontAwesomeIcon icon={faShieldHalved} className="w-3 h-3" />
                                Premium via Coach
                            </span>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="mt-3 p-2 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                        {error}
                    </div>
                )}

                {showConfirm ? (
                    <div className="mt-4 bg-neural-synapse/5 border border-neural-synapse/20 p-3">
                        <p className="text-xs text-theme-text-secondary mb-3">
                            This will remove your coach's access to your data.
                            {coachGrantedPremium && ' You will also lose your coach-provided premium access.'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleRevoke}
                                disabled={isRevoking}
                                className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-neural-synapse/20 text-neural-synapse border border-neural-synapse/50 hover:bg-neural-synapse/30 transition-colors disabled:opacity-50"
                            >
                                {isRevoking ? 'Revoking...' : 'Confirm Revoke'}
                            </button>
                            <button
                                onClick={() => setShowConfirm(false)}
                                disabled={isRevoking}
                                className="px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-theme-text-muted border border-theme-line hover:border-warm-muted transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowConfirm(true)}
                        className="mt-4 px-4 py-2 text-xs font-mono uppercase tracking-wider text-neural-synapse border border-neural-synapse/30 hover:bg-neural-synapse/10 transition-colors"
                    >
                        Revoke Access
                    </button>
                )}
            </div>
        </div>
    );
};

export default CoachAccessSettings;
