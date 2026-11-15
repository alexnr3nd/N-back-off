/* src/contexts/user/userActionsCST.js */
/* Updated for flattened user structure */
import { useCallback } from 'react';
import { doc, updateDoc, serverTimestamp, arrayUnion, increment } from 'firebase/firestore';
import { db as firestoreDb } from '../../firebaseConfig';

/**
 * Hook creator for Add CST Result action.
 * Updated for flattened user structure - updates user doc directly.
 */
export const useCreateAddCstResultAction = (
    authUserRef,
    setError
) => {
    // profileId is kept for backward compatibility but ignored - we update user doc directly
    return useCallback(async (profileId, resultData) => {
        const currentUserId = authUserRef.current?.uid;
        if (!currentUserId || !resultData) {
            setError("Missing data for CST result.");
            return false;
        }
        setError(null);
        const db = firestoreDb;
        // Update user doc directly (flattened structure)
        const userRef = doc(db, 'users', currentUserId);
        try {
            const payload = {
                ...resultData,
                timestamp: serverTimestamp(),
            };
            await updateDoc(userRef, {
                cstHistory: arrayUnion(payload),
                ...(resultData.familiarizationSession
                    ? { cstFamiliarizationCount: increment(1) }
                    : { lastCstAssessmentTimestamp: serverTimestamp() }
                ),
                updatedAt: serverTimestamp()
            });
            // User data listener will update cstHistory in local state
            return true;
        } catch (err) {
            console.error("Error adding CST result:", err);
            setError("Failed to save CST result.");
            return false;
        }
    }, [authUserRef, setError]);
};