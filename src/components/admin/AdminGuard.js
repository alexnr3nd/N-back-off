/* src/components/admin/AdminGuard.js */
import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useLoading } from '../../contexts/LoadingContext'; // For visual feedback
import LoadingSpinner from '../ui/LoadingSpinner'; // Use your existing spinner

const AdminGuard = () => {
    const { authUser, isAuthLoading } = useUser(); // Get user and auth loading status
    const { showLoading, hideLoading } = useLoading();
    const [isAdminStatus, setIsAdminStatus] = useState('loading'); // 'loading', 'admin', 'not_admin'
    const [checkingClaims, setCheckingClaims] = useState(false); // Track claim check specifically

    useEffect(() => {
        let isMounted = true; // Prevent state updates on unmounted component

        const checkAdminClaim = async () => {
            if (!authUser) {
                if (isMounted) setIsAdminStatus('not_admin');
                return;
            }

            if (isMounted) setCheckingClaims(true); // Start claim check loading indicator

            try {
                // Force refresh is important here if claims might have just been set
                // Or if login just happened. If user is already logged in, may not need `true`.
                // For robustness, let's force refresh.
                const idTokenResult = await authUser.getIdTokenResult(true);
                const isAdmin = idTokenResult.claims.isAdmin === true;

                if (isMounted) {
                    setIsAdminStatus(isAdmin ? 'admin' : 'not_admin');
                }
            } catch (error) {
                console.error("[AdminGuard] Error getting ID token or claims:", error);
                if (isMounted) {
                    setIsAdminStatus('not_admin'); // Treat error as not admin
                }
            } finally {
                if (isMounted) {
                    setCheckingClaims(false); // End claim check loading indicator
                }
            }
        };

        // Only check claims *after* initial auth state is resolved and we have a user
        if (!isAuthLoading && authUser) {
            checkAdminClaim();
        } else if (!isAuthLoading && !authUser) {
            // Auth resolved, but no user logged in
            setIsAdminStatus('not_admin');
            setCheckingClaims(false);
        } else {
             // Still waiting for initial auth check
             setIsAdminStatus('loading');
        }

        // Show/hide global loading spinner based on overall loading state
        const isLoadingOverall = isAuthLoading || checkingClaims;
        if (isLoadingOverall) {
            showLoading("Verifying admin access...");
        } else {
            hideLoading();
        }

        // Cleanup function
        return () => {
            isMounted = false;
            hideLoading(); // Ensure loading indicator is hidden on unmount
        };

    }, [authUser, isAuthLoading, showLoading, hideLoading]); // Re-run if auth state changes


    // Render based on state
    if (isAuthLoading || isAdminStatus === 'loading') {
        // Show a spinner while checking auth or claims
        return <LoadingSpinner message="Verifying admin access..." fullScreen theme="auto" />;
    }

    if (isAdminStatus === 'not_admin') {
        // User is not authenticated or not an admin — send them to the public root.
        // There is no admin login page; admin access is granted only via custom claim.
        return <Navigate to="/" replace />;
    }

    // User is authenticated and has the isAdmin claim
    // Render the nested admin route
    return <Outlet />;
};

export default AdminGuard;