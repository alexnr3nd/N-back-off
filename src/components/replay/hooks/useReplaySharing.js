/* src/components/replay/hooks/useReplaySharing.js */
import { useState, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Initialize Firebase Functions outside the hook
let makeReplayPublicCallable;
let makeReplayPrivateCallable;
try {
    const functionsInstance = getFunctions();
    makeReplayPublicCallable = httpsCallable(functionsInstance, 'makeReplayPublic');
    makeReplayPrivateCallable = httpsCallable(functionsInstance, 'makeReplayPrivate');
} catch (e) {
    console.error("ReplaySharing Hook: Firebase Functions could not be initialized:", e);
    makeReplayPublicCallable = null;
    makeReplayPrivateCallable = null;
}

/**
 * Hook to manage the state and logic for sharing a replay.
 * @param {string | null} sessionId - The ID of the session being replayed.
 * @param {string | null} profileId - The ID of the profile owning the session.
 * @param {boolean} initialIsPublic - Whether the replay is initially public.
 * @param {boolean} isPublicView - True if viewing a public share link (disables sharing actions).
 * @param {boolean} isLocalReplay - True if viewing a locally generated replay (disables sharing).
 */
export const useReplaySharing = (sessionId, profileId, initialIsPublic, isPublicView, isLocalReplay) => {
    const [isSharing, setIsSharing] = useState(false);
    const [isMakingPrivate, setIsMakingPrivate] = useState(false);
    const [shareError, setShareError] = useState(null);
    const [showShareLinkModal, setShowShareLinkModal] = useState(false);
    const [shareLink, setShareLink] = useState('');
    const [isNowPublic, setIsNowPublic] = useState(initialIsPublic);
    const [isCopied, setIsCopied] = useState(false);

    // Sync public status if the initial prop changes after mount
    useEffect(() => {
        setIsNowPublic(initialIsPublic);
    }, [initialIsPublic]);

    // Determine if sharing actions are allowed
    const canShare = !isPublicView && !isLocalReplay && !!sessionId && !!profileId && !!makeReplayPublicCallable;
    const canMakePrivate = !isPublicView && !isLocalReplay && !!sessionId && !!profileId && !!makeReplayPrivateCallable && isNowPublic;

    // Generate link function (used internally and by copy)
    const generateLink = useCallback(() => {
        if (sessionId) {
             return `${window.location.origin}/share/replay/${sessionId}`;
        }
        return '';
    }, [sessionId]);

    // Copy link handler for inline copy button (when already public)
    const handleCopyLink = useCallback(() => {
        const linkToCopy = shareLink || generateLink();
        if (linkToCopy) {
            setShareLink(linkToCopy);
            navigator.clipboard.writeText(linkToCopy).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 3000);
            }).catch(err => {
                console.error('Clipboard copy error:', err);
                setShareError('Copy failed. Please select and copy manually.');
            });
        } else {
            setShareError("Failed to generate the share link.");
        }
    }, [shareLink, generateLink]);

    // Manual copy from modal (when clicking copy button in modal)
    const handleManualCopy = useCallback(() => {
        if (shareLink) {
            navigator.clipboard.writeText(shareLink).then(() => {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 3000);
            }).catch(err => {
                console.error('Clipboard copy error:', err);
                setShareError('Copy failed. Please select and copy manually.');
            });
        }
    }, [shareLink]);

    // Main share action handler - calls cloud function and shows modal on success
    const handleSharePublicly = useCallback(async () => {
        // If already public, this shouldn't be called (use handleCopyLink instead)
        if (isNowPublic) {
            handleCopyLink();
            return;
        }

        // If cannot share or already sharing, do nothing
        if (!canShare || isSharing) {
            setShareError("Cannot share this replay at the moment.");
            return;
        }

        setIsSharing(true);
        setShareError(null);
        setIsCopied(false);

        try {
            // Call the Firebase Function
            const result = await makeReplayPublicCallable({ profileId: profileId, sessionId: sessionId });

            if (result?.data?.success) {
                setIsNowPublic(true); // Update state to public
                const link = generateLink();
                setShareLink(link); // Store the generated link
                setShowShareLinkModal(true); // Show the modal with the link
                // Auto-copy the link
                navigator.clipboard.writeText(link).then(() => {
                    setIsCopied(true);
                    setTimeout(() => setIsCopied(false), 3000);
                }).catch(err => {
                    console.error('Auto-copy failed:', err);
                });
            } else {
                throw new Error(result?.data?.message || 'Backend failed to make replay public.');
            }
        } catch (error) {
            const errMsg = error.message || 'An unknown error occurred during sharing.';
            setShareError(errMsg);
            console.error('Share error:', error);
            setShowShareLinkModal(false);
        } finally {
            setIsSharing(false);
        }
    }, [profileId, sessionId, isSharing, isNowPublic, canShare, handleCopyLink, generateLink]);

    // Make replay private handler
    const handleMakePrivate = useCallback(async () => {
        if (!canMakePrivate || isMakingPrivate) {
            return;
        }

        setIsMakingPrivate(true);
        setShareError(null);

        try {
            const result = await makeReplayPrivateCallable({ profileId: profileId, sessionId: sessionId });

            if (result?.data?.success) {
                setIsNowPublic(false);
                setShareLink('');
                setShowShareLinkModal(false);
            } else {
                throw new Error(result?.data?.message || 'Backend failed to make replay private.');
            }
        } catch (error) {
            const errMsg = error.message || 'An unknown error occurred.';
            setShareError(errMsg);
            console.error('Make private error:', error);
        } finally {
            setIsMakingPrivate(false);
        }
    }, [profileId, sessionId, canMakePrivate, isMakingPrivate]);

    const closeShareModal = useCallback(() => {
        setShowShareLinkModal(false);
    }, []);

    // Generate the share link on mount if already public
    useEffect(() => {
        if (isNowPublic && !shareLink && sessionId) {
            setShareLink(generateLink());
        }
    }, [isNowPublic, shareLink, sessionId, generateLink]);

    return {
        isSharing,
        isMakingPrivate,
        shareError,
        showShareLinkModal,
        shareLink,
        isNowPublic,
        isCopied,
        canShare,
        canMakePrivate,
        handleSharePublicly,
        handleCopyLink,
        handleManualCopy,
        handleMakePrivate,
        closeShareModal,
    };
};
