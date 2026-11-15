/* src/contexts/user/userActionsSessions.js */
import { useCallback } from 'react';

/**
 * Hook creator for Fetch Paginated Sessions action.
 */
export const useCreateFetchPaginatedSessionsAction = (
    authUserRef,
    fetchUserSessionsFn // Cloud function ref
) => {
    return useCallback(async (profileId, options = {}) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            console.warn("[fetchPaginatedSessions Action] Auth missing.");
            return { success: false, error: "Authentication required.", sessions: [], totalFilteredSessions: 0, lastVisibleDocId: null };
        }
        if (!fetchUserSessionsFn) {
            console.error("[fetchPaginatedSessions Action] Cloud function reference not available.");
            return { success: false, error: "Session fetching service unavailable.", sessions: [], totalFilteredSessions: 0, lastVisibleDocId: null };
        }

        const { pageSize = 25, startDate = null, endDate = null, lastVisibleDocId = null } = options;
        const payload = { pageSize, startDate, endDate, lastVisibleDocId };

        try {
            const result = await fetchUserSessionsFn(payload);

            if (result?.data?.success) {
                return {
                    success: true,
                    sessions: result.data.sessions || [],
                    totalFilteredSessions: result.data.totalFilteredSessions ?? 0,
                    lastVisibleDocId: result.data.lastVisibleDocId || null,
                };
            } else {
                const errorMessage = result?.data?.message || "Failed to fetch sessions.";
                console.error(`[fetchPaginatedSessions Action] Backend function failed: ${errorMessage}`, result?.data);
                return { success: false, error: errorMessage, sessions: [], totalFilteredSessions: 0, lastVisibleDocId: null };
            }
        } catch (err) {
            console.error("[fetchPaginatedSessions Action] Error calling cloud function:", err);
            const message = err.message || "An unexpected error occurred fetching sessions.";
            return { success: false, error: message, sessions: [], totalFilteredSessions: 0, lastVisibleDocId: null };
        }
    }, [authUserRef, fetchUserSessionsFn]);
};

/**
 * Hook creator for Fetch All Sessions for Export action.
 */
export const useCreateFetchAllSessionsForExportAction = (
    authUserRef,
    exportUserSessionsFn // Cloud function ref
) => {
    return useCallback(async (profileId, startDateObj = null, endDateObj = null) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            console.warn("[fetchAllSessionsForExport Action] Auth missing.");
            return { success: false, error: "Authentication required.", csv: '', count: 0, sessions: [] };
        }
        if (!exportUserSessionsFn) {
            console.error("[fetchAllSessionsForExport Action] Cloud function reference not available.");
            return { success: false, error: "Session export service unavailable.", csv: '', count: 0, sessions: [] };
        }

        let startDateISO = null;
        if (startDateObj instanceof Date && !isNaN(startDateObj)) {
            startDateISO = startDateObj.toISOString();
        }
        let endDateISO = null;
        if (endDateObj instanceof Date && !isNaN(endDateObj)) {
            const endOfDayDate = new Date(endDateObj);
            endOfDayDate.setHours(23, 59, 59, 999);
            endDateISO = endOfDayDate.toISOString();
        }

        // Request CSV directly from the backend. Server builds the CSV string
        // and returns it alongside a count. Old backend (unlikely, rollback scenario)
        // would return { sessions: [...] } instead — we pass that through so the
        // component can fall back to client-side conversion if needed.
        const payload = { startDate: startDateISO, endDate: endDateISO, format: 'csv' };

        try {
            const result = await exportUserSessionsFn(payload);

            if (result?.data?.success) {
                return {
                    success: true,
                    csv: result.data.csv || '',
                    count: result.data.count ?? (Array.isArray(result.data.sessions) ? result.data.sessions.length : 0),
                    sessions: result.data.sessions || [],
                };
            } else {
                const errorMessage = result?.data?.message || "Failed to fetch sessions for export.";
                console.error(`[fetchAllSessionsForExport Action] Backend function failed: ${errorMessage}`, result?.data);
                return { success: false, error: errorMessage, csv: '', count: 0, sessions: [] };
            }
        } catch (err) {
            console.error("[fetchAllSessionsForExport Action] Error calling cloud function:", err);
            const message = err.message || "An unexpected error occurred fetching sessions for export.";
            return { success: false, error: message, csv: '', count: 0, sessions: [] };
        }
    }, [authUserRef, exportUserSessionsFn]);
};

/**
 * Hook creator for Fetch Sessions Lightweight action (excludes replayData/sequence).
 */
export const useCreateFetchSessionsLightweightAction = (
    authUserRef,
    fetchSessionsLightweightFn
) => {
    return useCallback(async () => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            console.warn("[fetchSessionsLightweight Action] Auth missing.");
            return { success: false, error: "Authentication required.", sessions: [] };
        }
        if (!fetchSessionsLightweightFn) {
            console.error("[fetchSessionsLightweight Action] Cloud function reference not available.");
            return { success: false, error: "Service unavailable.", sessions: [] };
        }

        try {
            const result = await fetchSessionsLightweightFn({});

            if (result?.data?.success) {
                return { success: true, sessions: result.data.sessions || [] };
            } else {
                const errorMessage = result?.data?.message || "Failed to fetch sessions.";
                console.error(`[fetchSessionsLightweight Action] Backend failed: ${errorMessage}`);
                return { success: false, error: errorMessage, sessions: [] };
            }
        } catch (err) {
            console.error("[fetchSessionsLightweight Action] Error:", err);
            return { success: false, error: err.message || "Unexpected error.", sessions: [] };
        }
    }, [authUserRef, fetchSessionsLightweightFn]);
};

/**
 * Hook creator for Update Session Note action.
 */
export const useCreateUpdateSessionNoteAction = (
    authUserRef,
    updateSessionNoteFn
) => {
    return useCallback(async (sessionId, note) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId) {
            return { success: false, error: "Authentication required." };
        }
        if (!updateSessionNoteFn) {
            return { success: false, error: "Note service unavailable." };
        }

        try {
            const result = await updateSessionNoteFn({ sessionId, note });
            if (result?.data?.success) {
                return { success: true, note: result.data.note };
            } else {
                return { success: false, error: result?.data?.message || "Failed to save note." };
            }
        } catch (err) {
            console.error("[updateSessionNote Action] Error:", err);
            return { success: false, error: err.message || "Unexpected error saving note." };
        }
    }, [authUserRef, updateSessionNoteFn]);
};
