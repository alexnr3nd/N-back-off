/* src/RouteWrappers.js */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { useUser } from './contexts/UserContext';

// Import required components
import ReplayViewer from './components/replay/ReplayViewer';
import LoadingSpinner from './components/ui/LoadingSpinner';
import { resolvePaletteForSession } from './components/replay/utils/replayUtils';

// --- Wrapper for PRIVATE Replays (/replay/:sessionId) ---
// Updated to support flattened user structure with legacy fallback
export const ReplayViewerWrapper = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const {
        authUser,
        userData, // For getting displayName
        legacyProfileId, // For legacy session path fallback
        isLoading: isLoadingContext
    } = useUser();

    // Initialize state with userId field
    const [sessionDetails, setSessionDetails] = useState({ replayData: null, username: 'Player', isPublic: false, profileId: null, userId: null });
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Wait for context loading (includes auth check)
        if (isLoadingContext) {
            if (!isLoadingData) setIsLoadingData(true);
            return;
        }

        // Explicitly check for authUser *after* loading is complete
        if (!authUser) {
            setError("Authentication required to view this replay.");
            setIsLoadingData(false);
            return;
        }

        if (!sessionId) {
            setError("Session ID missing.");
            setIsLoadingData(false);
            return;
        }

        const fetchReplay = async () => {
            setIsLoadingData(true);
            setError(null);
            let found = null;
            let fetchErr = null;
            const userUid = authUser.uid;
            const username = userData?.displayName || 'Your';

            // Helper to process session data
            const processSessionData = (d, sourceDesc) => {
                if (d.replayData?.settings && Array.isArray(d.replayData.events) && d.replayData.startTime !== undefined) {
                    const startTime = d.replayData.startTime instanceof Timestamp
                        ? d.replayData.startTime.toMillis()
                        : (typeof d.replayData.startTime === 'number' ? d.replayData.startTime : Date.parse(d.replayData.startTime));

                    if (typeof startTime === 'number' && !isNaN(startTime)) {
                        const replayDataWithUser = {
                            ...d.replayData,
                            startTime,
                            userId: userUid,
                            // Include sequence from session document if not in replayData.settings
                            sequence: d.sequence || d.replayData?.settings?.generatedSequence || [],
                            // Snapshot palette (color customization) — pre-feature sessions
                            // fall back to the legacy colorToHex map.
                            palette: resolvePaletteForSession(d),
                            // Inject gameMode into settings for backward compatibility with existing sessions
                            settings: {
                                ...d.replayData?.settings,
                                gameMode: d.replayData?.settings?.gameMode || d.gameMode || 'dual'
                            }
                        };
                        return {
                            replayData: replayDataWithUser,
                            username: d.username || username,
                            isPublic: d.isPublic || false,
                            profileId: legacyProfileId || userUid, // Use legacyProfileId if available
                            userId: userUid
                        };
                    } else {
                        console.warn(`[ReplayWrapper] Invalid startTime in session ${sessionId} at ${sourceDesc}`);
                    }
                } else {
                    console.warn(`[ReplayWrapper] Invalid replayData structure in session ${sessionId} at ${sourceDesc}`);
                }
                return null;
            };

            // 1. First try the new flattened path: users/{uid}/sessions/{sessionId}
            try {
                const newPathRef = doc(db, 'users', userUid, 'sessions', sessionId);
                const newPathSnap = await getDoc(newPathRef);

                if (newPathSnap.exists()) {
                    found = processSessionData(newPathSnap.data(), 'new flattened path');
                }
            } catch (e) {
                // Permission denied or other error on new path - this is expected for legacy users
                // New path not accessible - expected for legacy data
            }

            // 2. If not found, try legacy path with legacyProfileId
            if (!found && legacyProfileId) {
                try {
                    const legacyRef = doc(db, 'users', userUid, 'profiles', legacyProfileId, 'sessions', sessionId);
                    const legacySnap = await getDoc(legacyRef);

                    if (legacySnap.exists()) {
                        found = processSessionData(legacySnap.data(), 'legacy profile path');
                    }
                } catch (e) {
                    fetchErr = "Error fetching replay data.";
                    console.error(`[ReplayWrapper] Error fetching from legacy path:`, e);
                }
            }

            if (found) {
                setSessionDetails(found);
            } else {
                setError(fetchErr || "Replay not found or access denied.");
            }
            setIsLoadingData(false);
        };

        // Only fetch if we haven't already found an error (like missing auth)
        // Also skip re-fetching if we already have valid replay data for this session
        if (!error && !sessionDetails.replayData) {
            fetchReplay();
        }

    }, [sessionId, authUser, userData, legacyProfileId, isLoadingContext, navigate, error]); // eslint-disable-line react-hooks/exhaustive-deps

    // Combined loading state check
    if (isLoadingContext || isLoadingData) {
        return <LoadingSpinner message="Loading replay..." fullScreen theme="auto" />;
    }

    // Error handling after loading
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0D0B09' }}>
                <div className="text-center p-6 rounded-lg" style={{ backgroundColor: '#151311', border: '1px solid #3A352F' }}>
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={() => navigate('/dashboard')} className='text-amber-accent underline font-mono'>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    // Handle case where data loading finished but replayData is still null (not found)
    if (!sessionDetails.replayData) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0D0B09' }}>
                <div className="text-center p-6 rounded-lg" style={{ backgroundColor: '#151311', border: '1px solid #3A352F' }}>
                    <p style={{ color: '#A39E96' }} className="mb-4">Could not load replay data. It might not exist or belong to this profile.</p>
                    <button onClick={() => navigate('/dashboard')} className='text-amber-accent underline font-mono'>Back to Dashboard</button>
                </div>
            </div>
        );
    }

    // Render ReplayViewer only when data is ready and no error
    // Pass authUser explicitly, ensures ReplayViewer gets the correct user state
    return (
        <ReplayViewer
            replayData={sessionDetails.replayData} // Now includes userId
            username={sessionDetails.username}
            sessionId={sessionId}
            profileId={sessionDetails.profileId}
            initialIsPublic={sessionDetails.isPublic} // Pass the fetched public status
            // --- Pass isPublicView={false} as this is the private route wrapper ---
            isPublicView={false}
            isLocalReplay={false}
            onExit={() => navigate('/dashboard')}
            authUser={authUser} // Pass the confirmed authUser object
        />
    );
};

// --- Wrapper for PUBLIC Replays (/share/replay/:sessionId) ---
export const PublicReplayViewerWrapper = () => {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { authUser } = useUser();
    const [docData, setDocData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isNotFound, setIsNotFound] = useState(false);

    useEffect(() => {
        if (!sessionId) { setError("Invalid replay link."); setIsLoading(false); return; }
        const fetchPublicReplay = async () => {
            setIsLoading(true); setError(null); setIsNotFound(false);
            const ref = doc(db, 'publicReplays', sessionId);
            try {
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const d = snap.data();
                    if (d.replayData?.settings && Array.isArray(d.replayData.events) && d.replayData.startTime !== undefined) {
                        const startTime = d.replayData.startTime instanceof Timestamp ? d.replayData.startTime.toMillis() : (typeof d.replayData.startTime === 'number' ? d.replayData.startTime : Date.parse(d.replayData.startTime));
                        if (typeof startTime === 'number' && !isNaN(startTime)) {
                            setDocData({
                                ...d,
                                replayData: {
                                    ...d.replayData,
                                    startTime,
                                    userId: d.userId,
                                    sequence: d.sequence || d.replayData?.settings?.generatedSequence || [],
                                    // Snapshot palette (color customization) — pre-feature sessions
                                    // fall back to the legacy colorToHex map.
                                    palette: resolvePaletteForSession(d),
                                    // Inject gameMode into settings for backward compatibility
                                    settings: {
                                        ...d.replayData?.settings,
                                        gameMode: d.replayData?.settings?.gameMode || d.modality || 'dual'
                                    }
                                }
                            });
                        } else { throw new Error("Invalid startTime format."); }
                    } else { throw new Error("Invalid public replay structure."); }
                } else {
                    setIsNotFound(true);
                }
            } catch (e) { setError(`Error loading replay: ${e.message}`); }
            finally { setIsLoading(false); }
        };
        fetchPublicReplay();
    }, [sessionId]);

    if (isLoading) return <LoadingSpinner message="Loading replay..." fullScreen theme="auto" />;

    // Show "Replay No Longer Available" for not found (likely made private)
    if (isNotFound) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0D0B09' }}>
            <div className="text-center p-8 rounded-lg max-w-md" style={{ backgroundColor: '#151311', border: '1px solid #3A352F' }}>
                {/* Lock icon */}
                <div className="mb-6 flex justify-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(58, 53, 47, 0.5)', border: '1px solid #3A352F' }}>
                        <i className="fas fa-lock text-2xl" style={{ color: '#A39E96' }}></i>
                    </div>
                </div>
                {/* Title */}
                <h2 className="font-serif text-xl mb-3" style={{ color: '#F0ECE6' }}>
                    Replay No Longer Available
                </h2>
                {/* Description */}
                <p className="font-mono text-sm mb-6" style={{ color: '#A39E96' }}>
                    This replay has been made private by its owner or may have been removed.
                </p>
                {/* CTA */}
                <div className="space-y-3">
                    <a
                        href="https://dualnback.com"
                        rel="noreferrer noopener"
                        className="block w-full px-6 py-3 rounded-lg font-mono text-sm uppercase tracking-wider transition-colors text-center hover:opacity-90"
                        style={{ backgroundColor: '#E4B85C', color: '#0D0B09' }}
                    >
                        Try Dual N-Back
                    </a>
                    <p className="text-xs" style={{ color: '#5C5955' }}>
                        Train your working memory with our cognitive exercise
                    </p>
                </div>
            </div>
        </div>
    );

    if (error) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0D0B09' }}>
            <div className="text-center p-6 rounded-lg" style={{ backgroundColor: '#151311', border: '1px solid #3A352F' }}>
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={() => navigate('/')} className='text-amber-accent underline font-mono'>Home</button>
            </div>
        </div>
    );
    if (!docData?.replayData) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#0D0B09' }}>
            <div className="text-center p-6 rounded-lg" style={{ backgroundColor: '#151311', border: '1px solid #3A352F' }}>
                <p style={{ color: '#A39E96' }} className="mb-4">Invalid replay data loaded.</p>
                <button onClick={() => navigate('/')} className='text-amber-accent underline font-mono'>Home</button>
            </div>
        </div>
    );

    return (
        <ReplayViewer
            replayData={docData.replayData} // Includes userId if present in public doc
            username={docData.username || 'Player'}
            // --- Pass isPublicView={true} as this is the public route wrapper ---
            isPublicView={true}
            isLocalReplay={false}
            sessionId={sessionId}
            profileId={docData.profileId || null}
            initialIsPublic={true}
            authUser={authUser} // Pass viewer's auth state
        />
    );
};