/* src/contexts/CoachContext.js */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useUser } from './UserContext';
import { functions, httpsCallable } from '../firebaseConfig';

// Cloud function references
const getCoachDashboardFn = httpsCallable(functions, 'getCoachDashboard');
const getCoachClientDetailFn = httpsCallable(functions, 'getCoachClientDetail');
const generateInviteCodeFn = httpsCallable(functions, 'generateInviteCode');
const dismissClientFn = httpsCallable(functions, 'dismissClient');
const updateCoachSeatsFn = httpsCallable(functions, 'updateCoachSeats');
const createCoachCheckoutSessionFn = httpsCallable(functions, 'createCoachCheckoutSession');

const CoachContext = createContext(null);

export const useCoach = () => {
    const ctx = useContext(CoachContext);
    if (!ctx) throw new Error('useCoach must be used within CoachProvider');
    return ctx;
};

export const CoachProvider = ({ children }) => {
    const { authUser, userId } = useUser();

    const [isCoach, setIsCoach] = useState(false);
    const [coachData, setCoachData] = useState(null);
    const [clients, setClients] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, pageSize: 20, hasMore: false });

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Check coach claim from JWT
    useEffect(() => {
        const checkClaim = async () => {
            if (!authUser) {
                setIsCoach(false);
                setCoachData(null);
                setClients([]);
                setIsLoading(false);
                return;
            }
            try {
                const result = await authUser.getIdTokenResult();
                const hasCoachRole = result.claims.role === 'coach';
                if (isMountedRef.current) {
                    setIsCoach(hasCoachRole);
                    if (!hasCoachRole) setIsLoading(false);
                }
            } catch (err) {
                console.error('[CoachContext] Error checking coach claim:', err);
                if (isMountedRef.current) {
                    setIsCoach(false);
                    setIsLoading(false);
                }
            }
        };
        checkClaim();
    }, [authUser]);

    // Fetch dashboard data when coach is confirmed
    const fetchDashboard = useCallback(async (page = 1, pageSize = 20) => {
        if (!isCoach) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await getCoachDashboardFn({ page, pageSize });
            if (isMountedRef.current && result.data?.success) {
                setCoachData(result.data.coach);
                setClients(result.data.clients || []);
                setPagination({
                    page: result.data.page || page,
                    pageSize: result.data.pageSize || pageSize,
                    hasMore: result.data.hasMore || false,
                    totalClients: result.data.totalClients || 0,
                });
            }
        } catch (err) {
            console.error('[CoachContext] Error fetching dashboard:', err);
            if (isMountedRef.current) setError(err.message);
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    }, [isCoach]);

    // Auto-fetch when coach status confirmed
    useEffect(() => {
        if (isCoach) fetchDashboard();
    }, [isCoach, fetchDashboard]);

    // Fetch single client detail
    const fetchClientDetail = useCallback(async (clientUid) => {
        try {
            const result = await getCoachClientDetailFn({ clientUid });
            if (result.data?.success) return result.data;
            throw new Error(result.data?.message || 'Failed to fetch client detail');
        } catch (err) {
            console.error('[CoachContext] Error fetching client detail:', err);
            throw err;
        }
    }, []);

    // Regenerate invite code
    const regenerateInviteCode = useCallback(async () => {
        try {
            const result = await generateInviteCodeFn();
            if (result.data?.success) {
                setCoachData(prev => prev ? { ...prev, inviteCode: result.data.inviteCode } : prev);
                return result.data.inviteCode;
            }
            throw new Error(result.data?.message || 'Failed to generate invite code');
        } catch (err) {
            console.error('[CoachContext] Error generating invite code:', err);
            throw err;
        }
    }, []);

    // Dismiss a client
    const dismissClientAction = useCallback(async (clientUid) => {
        try {
            const result = await dismissClientFn({ clientUid });
            if (result.data?.success) {
                // Update local state — mark client as removed
                setClients(prev => prev.map(c =>
                    c.uid === clientUid ? { ...c, status: 'removed' } : c
                ));
                return true;
            }
            throw new Error(result.data?.message || 'Failed to dismiss client');
        } catch (err) {
            console.error('[CoachContext] Error dismissing client:', err);
            throw err;
        }
    }, []);

    // Start coach checkout session
    const startCheckout = useCallback(async (seatCount) => {
        try {
            const result = await createCoachCheckoutSessionFn({ seatCount });
            if (result.data?.success) return result.data;
            throw new Error(result.data?.message || 'Failed to create checkout session');
        } catch (err) {
            console.error('[CoachContext] Error creating checkout session:', err);
            throw err;
        }
    }, []);

    // Update coach seat count
    const updateCoachSeats = useCallback(async (newQuantity) => {
        try {
            const result = await updateCoachSeatsFn({ newQuantity });
            if (result.data?.success) {
                setCoachData(prev => prev ? { ...prev, seatsPurchased: result.data.newQuantity } : prev);
                return result.data;
            }
            throw new Error(result.data?.message || 'Failed to update seats');
        } catch (err) {
            console.error('[CoachContext] Error updating seats:', err);
            throw err;
        }
    }, []);

    const value = useMemo(() => ({
        isCoach,
        coachData,
        clients,
        isLoading,
        error,
        pagination,
        fetchDashboard,
        fetchClientDetail,
        regenerateInviteCode,
        dismissClient: dismissClientAction,
        startCheckout,
        updateCoachSeats,
    }), [isCoach, coachData, clients, isLoading, error, pagination,
         fetchDashboard, fetchClientDetail, regenerateInviteCode, dismissClientAction,
         startCheckout, updateCoachSeats]);

    return (
        <CoachContext.Provider value={value}>
            {children}
        </CoachContext.Provider>
    );
};
