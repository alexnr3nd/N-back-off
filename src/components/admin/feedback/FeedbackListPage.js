/* src/components/admin/feedback/FeedbackListPage.js */
import React, { useState, useEffect, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebaseConfig';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCommentDots,
    faChevronLeft,
    faChevronRight,
    faFilter,
    faCheck,
    faEye,
    faEnvelope,
    faCode,
    faCircle
} from '@fortawesome/free-solid-svg-icons';
import AdminPage from '../ui/AdminPage';
import AdminCard from '../ui/AdminCard';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import AdminEmptyState from '../ui/AdminEmptyState';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { SELECT } from '../ui/adminStyles';
import FeedbackDetailModal from './FeedbackDetailModal';

const STATUS_TONES = {
    new: 'info',
    reviewed: 'accent',
    resolved: 'success',
};

const FeedbackListPage = () => {
    const [feedback, setFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filter state
    const [statusFilter, setStatusFilter] = useState('all');

    // Pagination state
    const [hasMore, setHasMore] = useState(false);
    const [lastDocId, setLastDocId] = useState(null);
    const [pageHistory, setPageHistory] = useState([]);

    // Modal state
    const [selectedFeedback, setSelectedFeedback] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Reply state
    const [replyMessage, setReplyMessage] = useState('');
    const [replyLoading, setReplyLoading] = useState(false);
    const [replySuccess, setReplySuccess] = useState(false);
    const [replyError, setReplyError] = useState(null);
    const [replies, setReplies] = useState([]);
    const [loadingReplies, setLoadingReplies] = useState(false);

    // Technical logs state
    const [logsExpanded, setLogsExpanded] = useState(false);
    const [logsCopied, setLogsCopied] = useState(false);

    const fetchFeedback = useCallback(async (startAfterDocId = null, isNewSearch = false, silent = false) => {
        if (!silent) {
            setLoading(true);
            setError(null);
        }

        try {
            const adminGetFeedback = httpsCallable(functions, 'adminGetFeedback');
            const result = await adminGetFeedback({
                status: statusFilter,
                pageSize: 25,
                startAfterDocId,
            });

            if (result.data.success) {
                setFeedback(result.data.feedback);
                setHasMore(result.data.hasMore);
                setLastDocId(result.data.lastDocId);

                if (isNewSearch) {
                    setPageHistory([]);
                }
            }
        } catch (err) {
            console.error('[FeedbackListPage] Error fetching feedback:', err);
            if (!silent) {
                setError(err.message || 'Failed to fetch feedback');
            }
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [statusFilter]);

    // Initial fetch and mark as viewed
    useEffect(() => {
        fetchFeedback(null, true);
        // Store the current time as "last viewed" for the new feedback indicator
        localStorage.setItem('admin_feedback_last_viewed', new Date().toISOString());
    }, []);

    // Auto-refresh polling every 30 seconds (silent background refresh)
    useEffect(() => {
        const pollInterval = setInterval(() => {
            // Only poll if no modal is open and not in the middle of a reply
            if (!selectedFeedback && !replyLoading) {
                fetchFeedback(null, false, true); // silent = true
            }
        }, 30000);

        return () => clearInterval(pollInterval);
    }, [fetchFeedback, selectedFeedback, replyLoading]);

    // Handle filter change
    const handleApplyFilter = () => {
        fetchFeedback(null, true);
    };

    // Pagination handlers
    const handleNextPage = () => {
        if (hasMore && lastDocId) {
            setPageHistory(prev => [...prev, feedback[0]?.id || null]);
            fetchFeedback(lastDocId);
        }
    };

    const handlePrevPage = () => {
        if (pageHistory.length > 0) {
            const newHistory = [...pageHistory];
            newHistory.pop();
            setPageHistory(newHistory);
            fetchFeedback(newHistory.length > 0 ? newHistory[newHistory.length - 1] : null);
        }
    };

    // Update feedback status
    const updateFeedbackStatus = async (feedbackId, newStatus) => {
        setActionLoading(true);

        try {
            const adminUpdateFeedbackStatus = httpsCallable(functions, 'adminUpdateFeedbackStatus');
            await adminUpdateFeedbackStatus({ feedbackId, status: newStatus });

            // Update local state
            setFeedback(prev => prev.map(f =>
                f.id === feedbackId ? { ...f, status: newStatus } : f
            ));

            if (selectedFeedback?.id === feedbackId) {
                setSelectedFeedback(prev => ({ ...prev, status: newStatus }));
            }
        } catch (err) {
            console.error('[FeedbackListPage] Error updating status:', err);
            alert('Failed to update status: ' + err.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Fetch replies for a feedback item
    const fetchReplies = async (feedbackId, shouldMarkAsRead = true) => {
        setLoadingReplies(true);
        setReplies([]);

        try {
            const adminGetFeedbackReplies = httpsCallable(functions, 'adminGetFeedbackReplies');
            const result = await adminGetFeedbackReplies({
                feedbackId,
                markAsRead: shouldMarkAsRead
            });

            if (result.data.success) {
                setReplies(result.data.replies || []);

                // Update local state to clear the unread indicator
                if (shouldMarkAsRead) {
                    setFeedback(prev => prev.map(f =>
                        f.id === feedbackId ? { ...f, hasUnreadUserReply: false } : f
                    ));
                }
            }
        } catch (err) {
            console.error('[FeedbackListPage] Error fetching replies:', err);
        } finally {
            setLoadingReplies(false);
        }
    };

    // Send a reply
    const sendReply = async () => {
        if (!selectedFeedback || !replyMessage.trim()) return;

        setReplyLoading(true);
        setReplyError(null);
        setReplySuccess(false);

        try {
            const adminReplyToFeedback = httpsCallable(functions, 'adminReplyToFeedback');
            const result = await adminReplyToFeedback({
                feedbackId: selectedFeedback.id,
                message: replyMessage.trim(),
            });

            if (result.data.success) {
                setReplySuccess(true);
                setReplyMessage('');
                // Refresh replies
                fetchReplies(selectedFeedback.id);
                // Update local feedback status
                setFeedback(prev => prev.map(f =>
                    f.id === selectedFeedback.id ? { ...f, status: 'resolved' } : f
                ));
                setSelectedFeedback(prev => ({ ...prev, status: 'resolved' }));
            } else {
                setReplyError(result.data.error || 'Failed to send reply');
            }
        } catch (err) {
            console.error('[FeedbackListPage] Error sending reply:', err);
            setReplyError(err.message || 'Failed to send reply');
        } finally {
            setReplyLoading(false);
        }
    };

    // Handle opening feedback modal
    const handleOpenFeedback = (item) => {
        setSelectedFeedback(item);
        setReplyMessage('');
        setReplySuccess(false);
        setReplyError(null);
        setReplies([]);
        // Fetch replies if feedback has an email (might have been replied to)
        if (item.userEmail) {
            fetchReplies(item.id);
        }
    };

    // Handle closing feedback modal
    const handleCloseFeedback = () => {
        setSelectedFeedback(null);
        setReplyMessage('');
        setReplySuccess(false);
        setReplyError(null);
        setReplies([]);
        setLogsExpanded(false);
        setLogsCopied(false);
    };

    // Copy logs to clipboard
    const copyLogsToClipboard = async (logs) => {
        try {
            await navigator.clipboard.writeText(logs);
            setLogsCopied(true);
            setTimeout(() => setLogsCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy logs:', err);
        }
    };

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            });
        } catch {
            return 'N/A';
        }
    };

    // Get status badge
    const getStatusBadge = (status) => (
        <AdminBadge tone={STATUS_TONES[status] || STATUS_TONES.new}>
            {status || 'new'}
        </AdminBadge>
    );

    // Truncate text
    const truncateText = (text, maxLength = 100) => {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    };

    return (
        <AdminPage
            eyebrow="Support"
            title="Feedback"
            actions={<span className="text-xs font-mono text-theme-text-muted">{feedback.length} items</span>}
        >
            {/* Filter */}
            <AdminCard variant="panel">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className={SELECT}
                        >
                            <option value="all">All Status</option>
                            <option value="new">New</option>
                            <option value="reviewed">Reviewed</option>
                            <option value="resolved">Resolved</option>
                        </select>
                    </div>
                    <AdminButton
                        variant="primary"
                        icon={faFilter}
                        disabled={loading}
                        onClick={handleApplyFilter}
                    >
                        Apply Filter
                    </AdminButton>
                </div>
            </AdminCard>

            {/* Error State */}
            {error && <AdminAlert tone="error">{error}</AdminAlert>}

            {/* Feedback List */}
            <AdminCard variant="panel" flush>
                {loading ? (
                    <div className="py-16">
                        <LoadingSpinner theme="auto" message="Loading feedback" />
                    </div>
                ) : feedback.length === 0 ? (
                    <AdminEmptyState icon={faCommentDots} title="No feedback found" />
                ) : (
                    <div className="divide-y divide-theme-line/50">
                        {feedback.map((item) => (
                            <div
                                key={item.id}
                                className="p-4 hover:bg-theme-bg-elevated cursor-pointer transition-colors"
                                onClick={() => handleOpenFeedback(item)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center flex-wrap gap-2 mb-1">
                                            {getStatusBadge(item.status)}
                                            <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-text-muted">
                                                {item.type || 'general'}
                                            </span>
                                            {item.hasUnreadUserReply && (
                                                <AdminBadge tone="accent" icon={faCircle}>
                                                    New Reply
                                                </AdminBadge>
                                            )}
                                            {item.consoleLogs && (
                                                <AdminBadge tone="neutral" icon={faCode}>
                                                    Logs
                                                </AdminBadge>
                                            )}
                                        </div>
                                        <p className="text-sm text-theme-text mb-1">
                                            {truncateText(item.message, 150)}
                                        </p>
                                        <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] font-mono text-theme-text-muted">
                                            <span className="flex items-center">
                                                <FontAwesomeIcon icon={faEnvelope} className="h-3 w-3 mr-1.5" />
                                                {item.userName || item.userEmail || 'Anonymous'}
                                            </span>
                                            <span>{formatDate(item.createdAt)}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        {item.status !== 'reviewed' && (
                                            <AdminButton
                                                variant="ghost"
                                                size="sm"
                                                icon={faEye}
                                                title="Mark as Reviewed"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateFeedbackStatus(item.id, 'reviewed');
                                                }}
                                            />
                                        )}
                                        {item.status !== 'resolved' && (
                                            <AdminButton
                                                variant="ghost"
                                                size="sm"
                                                icon={faCheck}
                                                title="Mark as Resolved"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    updateFeedbackStatus(item.id, 'resolved');
                                                }}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {!loading && feedback.length > 0 && (
                    <div className="bg-theme-bg-elevated px-4 py-3 flex items-center justify-between border-t border-theme-line">
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            icon={faChevronLeft}
                            disabled={pageHistory.length === 0}
                            onClick={handlePrevPage}
                        >
                            Previous
                        </AdminButton>
                        <span className="text-xs font-mono text-theme-text-muted">
                            Page {pageHistory.length + 1}
                        </span>
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            iconRight={faChevronRight}
                            disabled={!hasMore}
                            onClick={handleNextPage}
                        >
                            Next
                        </AdminButton>
                    </div>
                )}
            </AdminCard>

            {/* Feedback Detail Modal */}
            {selectedFeedback && (
                <FeedbackDetailModal
                    feedback={selectedFeedback}
                    statusBadge={getStatusBadge(selectedFeedback.status)}
                    formatDate={formatDate}
                    onClose={handleCloseFeedback}
                    replies={replies}
                    loadingReplies={loadingReplies}
                    replyMessage={replyMessage}
                    onReplyMessageChange={setReplyMessage}
                    replyLoading={replyLoading}
                    replySuccess={replySuccess}
                    replyError={replyError}
                    onSendReply={sendReply}
                    logsExpanded={logsExpanded}
                    onToggleLogs={() => setLogsExpanded(prev => !prev)}
                    logsCopied={logsCopied}
                    onCopyLogs={copyLogsToClipboard}
                    actionLoading={actionLoading}
                    onUpdateStatus={updateFeedbackStatus}
                />
            )}
        </AdminPage>
    );
};

export default FeedbackListPage;
