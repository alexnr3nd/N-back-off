/* File: src/components/changelog/ChangelogPage.js */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft, faRocket, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { collection, query, where, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebaseConfig';
import ChangelogEntry from './ChangelogEntry';

// localStorage key for tracking last viewed changelog
const CHANGELOG_LAST_VIEWED_KEY = 'changelog_last_viewed';

const PAGE_SIZE = 10;

// Convert Firestore doc to changelog object (mirrors functions/changelog.js:28-36)
const docToChangelog = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        title: data.title || '',
        content: data.content || '',
        category: data.category || 'announcement',
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || null,
        version: data.version || null,
    };
};

const ChangelogPage = () => {
    const [changelogs, setChangelogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState(null);
    const lastDocRef = useRef(null);

    // Fetch initial page of changelogs and mark as viewed
    const fetchChangelogs = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const changelogsQuery = query(
                collection(db, 'changelogs'),
                where('isPublished', '==', true),
                orderBy('publishedAt', 'desc'),
                limit(PAGE_SIZE)
            );

            const snapshot = await getDocs(changelogsQuery);
            const entries = snapshot.docs.map(docToChangelog);

            setChangelogs(entries);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
            lastDocRef.current = snapshot.docs.length > 0
                ? snapshot.docs[snapshot.docs.length - 1]
                : null;

            // Mark as viewed (fire and forget)
            const markViewedFn = httpsCallable(functions, 'markChangelogViewed');
            markViewedFn({}).catch(viewErr => {
                console.error('[ChangelogPage] Error marking changelog viewed:', viewErr);
            });
            localStorage.setItem(CHANGELOG_LAST_VIEWED_KEY, new Date().toISOString());
            window.dispatchEvent(new CustomEvent('changelog-viewed'));
        } catch (err) {
            console.error('[ChangelogPage] Error fetching changelogs:', err);
            setError('Failed to load changelogs. Please try again later.');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load next page of changelogs
    const loadMore = useCallback(async () => {
        if (!lastDocRef.current || loadingMore) return;

        try {
            setLoadingMore(true);

            const moreQuery = query(
                collection(db, 'changelogs'),
                where('isPublished', '==', true),
                orderBy('publishedAt', 'desc'),
                startAfter(lastDocRef.current),
                limit(PAGE_SIZE)
            );

            const snapshot = await getDocs(moreQuery);
            const entries = snapshot.docs.map(docToChangelog);

            setChangelogs(prev => [...prev, ...entries]);
            setHasMore(snapshot.docs.length === PAGE_SIZE);
            lastDocRef.current = snapshot.docs.length > 0
                ? snapshot.docs[snapshot.docs.length - 1]
                : null;
        } catch (err) {
            console.error('[ChangelogPage] Error loading more changelogs:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [loadingMore]);

    useEffect(() => {
        fetchChangelogs();
    }, [fetchChangelogs]);

    return (
        <div className="min-h-screen bg-theme-bg lab-grid">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
                {/* Header */}
                <header className="mb-8">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center text-theme-text-muted hover:text-theme-text text-sm font-mono transition-colors mb-4"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-3 w-3" />
                        Back to Dashboard
                    </Link>
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={faRocket} className="text-theme-accent mr-3 h-6 w-6" />
                        <h1 className="text-2xl font-serif text-theme-text">What's New</h1>
                    </div>
                    <p className="text-theme-text-secondary text-sm mt-2 font-mono">
                        Updates, features, and improvements to Dual N-Back
                    </p>
                </header>

                {/* Content */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-theme-accent h-6 w-6 mr-3" />
                        <span className="text-theme-text-secondary font-mono">Loading updates...</span>
                    </div>
                ) : error ? (
                    <div className="specimen-card rounded-lab p-6 border border-red-500/30 bg-red-500/10">
                        <p className="text-red-400 text-sm font-mono">{error}</p>
                        <button
                            onClick={fetchChangelogs}
                            className="mt-4 text-theme-accent hover:text-amber-highlight text-sm font-mono underline"
                        >
                            Try again
                        </button>
                    </div>
                ) : changelogs.length === 0 ? (
                    <div className="specimen-card rounded-lab p-8 border border-charcoal-line bg-theme-bg-surface text-center">
                        <FontAwesomeIcon icon={faRocket} className="text-theme-text-muted h-8 w-8 mb-4" />
                        <p className="text-theme-text-secondary font-mono">No updates yet. Check back soon!</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {changelogs.map(entry => (
                            <ChangelogEntry key={entry.id} entry={entry} />
                        ))}

                        {hasMore && (
                            <div className="flex justify-center pt-4 pb-2">
                                <button
                                    onClick={loadMore}
                                    disabled={loadingMore}
                                    className="px-6 py-3 text-sm font-mono uppercase tracking-wider text-theme-text-secondary border border-theme-line hover:border-theme-accent hover:text-theme-accent transition-colors rounded-lab disabled:opacity-50"
                                >
                                    {loadingMore ? (
                                        <>
                                            <FontAwesomeIcon icon={faSpinner} spin className="mr-2" />
                                            Loading...
                                        </>
                                    ) : (
                                        'Load More'
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChangelogPage;
