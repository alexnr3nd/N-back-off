/* src/components/coach/CoachGuard.js */
import React, { useState, useEffect } from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useLoading } from '../../contexts/LoadingContext';
import LoadingSpinner from '../ui/LoadingSpinner';

const CoachGuard = () => {
    const location = useLocation();
    const { authUser, isAuthLoading } = useUser();
    const { showLoading, hideLoading } = useLoading();
    const [coachStatus, setCoachStatus] = useState('loading'); // 'loading', 'coach', 'not_coach'

    useEffect(() => {
        let isMounted = true;

        const checkCoachClaim = async () => {
            if (!authUser) {
                if (isMounted) setCoachStatus('not_coach');
                return;
            }

            try {
                const idTokenResult = await authUser.getIdTokenResult(true);
                const isCoach = idTokenResult.claims.role === 'coach';

                if (isMounted) {
                    setCoachStatus(isCoach ? 'coach' : 'not_coach');
                }
            } catch (error) {
                console.error("[CoachGuard] Error checking coach claim:", error);
                if (isMounted) {
                    setCoachStatus('not_coach');
                }
            }
        };

        if (!isAuthLoading && authUser) {
            checkCoachClaim();
        } else if (!isAuthLoading && !authUser) {
            setCoachStatus('not_coach');
        } else {
            setCoachStatus('loading');
        }

        return () => {
            isMounted = false;
            hideLoading();
        };
    }, [authUser, isAuthLoading, hideLoading]);

    if (isAuthLoading || coachStatus === 'loading') {
        return <LoadingSpinner message="Verifying coach access..." fullScreen theme="auto" />;
    }

    if (coachStatus === 'not_coach') {
        return <Navigate to="/dashboard" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default CoachGuard;
