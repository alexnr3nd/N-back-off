/* src/components/admin/feedback/FeedbackDetailModal.js */
import React from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faChevronDown,
    faChevronUp,
    faCheckCircle,
    faExclamationCircle,
    faCopy,
    faCode,
    faUser,
    faUserShield,
    faReply,
    faPaperPlane,
} from '@fortawesome/free-solid-svg-icons';
import AdminModal from '../ui/AdminModal';
import AdminButton from '../ui/AdminButton';
import AdminBadge from '../ui/AdminBadge';
import AdminAlert from '../ui/AdminAlert';
import LoadingSpinner from '../../ui/LoadingSpinner';
import { EYEBROW, DL_TERM, DL_VALUE, TEXTAREA } from '../ui/adminStyles';

/**
 * Presentational detail modal for a single feedback item.
 * All state and handlers live in FeedbackListPage — this component only renders.
 */
const FeedbackDetailModal = ({
    feedback,
    statusBadge,
    formatDate,
    onClose,
    replies,
    loadingReplies,
    replyMessage,
    onReplyMessageChange,
    replyLoading,
    replySuccess,
    replyError,
    onSendReply,
    logsExpanded,
    onToggleLogs,
    logsCopied,
    onCopyLogs,
    actionLoading,
    onUpdateStatus,
}) => (
    <AdminModal
        size="lg"
        title="Feedback Details"
        badge={statusBadge}
        onClose={onClose}
        footer={<AdminButton variant="ghost" onClick={onClose}>Close</AdminButton>}
    >
        <div className="space-y-4">
            {/* Meta Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="min-w-0">
                    <p className={DL_TERM}>From</p>
                    {feedback.userName && <p className={DL_VALUE}>{feedback.userName}</p>}
                    <p
                        className={
                            feedback.userName
                                ? 'text-[0.6875rem] font-mono text-theme-text-muted break-all mt-0.5'
                                : `${DL_VALUE} break-all`
                        }
                    >
                        {feedback.userEmail || 'Anonymous'}
                    </p>
                </div>
                <div className="min-w-0">
                    <p className={DL_TERM}>Type</p>
                    <p className={DL_VALUE}>{feedback.type || 'General'}</p>
                </div>
                <div className="min-w-0">
                    <p className={DL_TERM}>Submitted</p>
                    <p className={DL_VALUE}>{formatDate(feedback.createdAt)}</p>
                </div>
                {feedback.resolvedAt && (
                    <div className="min-w-0">
                        <p className={DL_TERM}>Resolved</p>
                        <p className={DL_VALUE}>{formatDate(feedback.resolvedAt)}</p>
                    </div>
                )}
            </div>

            {/* Message */}
            <div>
                <p className={DL_TERM}>Message</p>
                <div className="mt-2 p-4 bg-theme-bg-elevated border border-theme-line rounded-lab">
                    <p className="text-sm text-theme-text whitespace-pre-wrap">
                        {feedback.message || 'No message provided'}
                    </p>
                </div>
            </div>

            {/* Technical Logs */}
            {feedback.consoleLogs && (
                <div>
                    <button
                        onClick={onToggleLogs}
                        className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-theme-text-secondary hover:text-theme-text transition-colors"
                    >
                        <FontAwesomeIcon icon={faCode} className="h-3.5 w-3.5" />
                        <span>Technical Logs</span>
                        <span className="text-theme-text-muted normal-case tracking-normal">
                            ({(feedback.consoleLogs.length / 1024).toFixed(1)} KB)
                        </span>
                        <FontAwesomeIcon
                            icon={logsExpanded ? faChevronUp : faChevronDown}
                            className="h-3 w-3 ml-1"
                        />
                    </button>
                    {logsExpanded && (
                        <div className="mt-2">
                            <div className="flex justify-end mb-2">
                                <AdminButton
                                    variant={logsCopied ? 'primary' : 'secondary'}
                                    size="sm"
                                    icon={logsCopied ? faCheckCircle : faCopy}
                                    onClick={() => onCopyLogs(feedback.consoleLogs)}
                                >
                                    {logsCopied ? 'Copied' : 'Copy to Clipboard'}
                                </AdminButton>
                            </div>
                            <pre className="p-3 bg-theme-bg border border-theme-line text-theme-text-secondary rounded-lab text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono custom-scrollbar">
                                {feedback.consoleLogs}
                            </pre>
                        </div>
                    )}
                </div>
            )}

            {/* Context Info */}
            {(feedback.pageUrl || feedback.userAgent || feedback.appVersion) && (
                <div className="text-[0.6875rem] font-mono text-theme-text-muted space-y-1 break-all">
                    {feedback.pageUrl && (
                        <p><span className="uppercase tracking-wider">Page:</span> {feedback.pageUrl}</p>
                    )}
                    {feedback.userAgent && (
                        <p><span className="uppercase tracking-wider">Browser:</span> {feedback.userAgent}</p>
                    )}
                    {feedback.appVersion && (
                        <p><span className="uppercase tracking-wider">App:</span> {feedback.appVersion}</p>
                    )}
                </div>
            )}

            {/* Conversation Thread */}
            {feedback.userEmail && (
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faReply} className="h-3.5 w-3.5 text-theme-text-muted" />
                        <span className={EYEBROW}>Conversation</span>
                    </div>
                    {loadingReplies ? (
                        <div className="flex items-center justify-center py-4">
                            <LoadingSpinner small theme="auto" />
                        </div>
                    ) : replies.length === 0 ? (
                        <p className="text-sm font-serif italic text-theme-text-muted">No replies yet</p>
                    ) : (
                        <div className="space-y-3">
                            {replies.map((reply) => {
                                const isUserReply = reply.type === 'user';

                                return (
                                    <div
                                        key={reply.id}
                                        className={`p-3 rounded-lab border-l-4 ${
                                            isUserReply
                                                ? 'bg-theme-accent/10 border-theme-accent'
                                                : 'bg-theme-neural-blue/10 border-theme-neural-blue'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FontAwesomeIcon
                                                    icon={isUserReply ? faUser : faUserShield}
                                                    className={`h-3 w-3 flex-shrink-0 ${isUserReply ? 'text-theme-accent' : 'text-theme-neural-blue'}`}
                                                />
                                                <span
                                                    className={`text-[0.6875rem] font-mono truncate ${isUserReply ? 'text-theme-accent' : 'text-theme-neural-blue'}`}
                                                >
                                                    {isUserReply
                                                        ? (reply.fromEmail || 'User')
                                                        : (reply.sentByEmail || 'Admin')}
                                                </span>
                                                {isUserReply && (
                                                    <AdminBadge tone="accent">Customer</AdminBadge>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {!isUserReply && (
                                                    reply.emailSent ? (
                                                        <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-theme-neural-green flex items-center">
                                                            <FontAwesomeIcon icon={faCheckCircle} className="h-3 w-3 mr-1" />
                                                            Sent
                                                        </span>
                                                    ) : (
                                                        <span
                                                            className="text-[0.6875rem] font-mono uppercase tracking-wider text-neural-synapse flex items-center"
                                                            title={reply.emailError}
                                                        >
                                                            <FontAwesomeIcon icon={faExclamationCircle} className="h-3 w-3 mr-1" />
                                                            Failed
                                                        </span>
                                                    )
                                                )}
                                                <span className="text-[0.6875rem] font-mono text-theme-text-muted">
                                                    {formatDate(reply.timestamp || reply.sentAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-theme-text whitespace-pre-wrap">{reply.message}</p>
                                        {/* Display image attachments */}
                                        {reply.attachments && reply.attachments.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {reply.attachments.map((attachment, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={attachment.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="block"
                                                    >
                                                        <img
                                                            src={attachment.url}
                                                            alt={attachment.filename || 'Attachment'}
                                                            className="max-w-xs max-h-48 rounded-lab border border-theme-line hover:border-theme-accent transition-colors cursor-pointer"
                                                        />
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Reply Form */}
            {feedback.userEmail ? (
                <div className="border-t border-theme-line pt-4 mt-4 bg-theme-bg-elevated -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                        <FontAwesomeIcon icon={faPaperPlane} className="h-3.5 w-3.5 text-theme-accent" />
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text">Send Reply</span>
                        <span className="text-[0.6875rem] font-mono text-theme-text-muted break-all">
                            to {feedback.userEmail}
                        </span>
                    </div>
                    <textarea
                        value={replyMessage}
                        onChange={(e) => onReplyMessageChange(e.target.value)}
                        placeholder="Type your reply..."
                        rows={4}
                        disabled={replyLoading}
                        className={`${TEXTAREA} disabled:opacity-50 disabled:cursor-not-allowed`}
                    />
                    {replyError && (
                        <AdminAlert tone="error" className="mt-2">{replyError}</AdminAlert>
                    )}
                    {replySuccess && (
                        <AdminAlert tone="success" className="mt-2">Reply sent successfully</AdminAlert>
                    )}
                    <div className="mt-2 flex justify-end">
                        <AdminButton
                            variant="primary"
                            icon={faPaperPlane}
                            loading={replyLoading}
                            disabled={!replyMessage.trim()}
                            onClick={onSendReply}
                        >
                            {replyLoading ? 'Sending' : 'Send Reply'}
                        </AdminButton>
                    </div>
                </div>
            ) : (
                <div className="border-t border-theme-line pt-4">
                    <AdminAlert tone="warning">
                        No email address provided. Cannot send a reply.
                    </AdminAlert>
                </div>
            )}

            {/* Status Actions */}
            <div className="border-t border-theme-line pt-4">
                <p className={`${EYEBROW} mb-2`}>Update Status</p>
                <div className="flex gap-2 flex-wrap">
                    {feedback.status !== 'new' && (
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => onUpdateStatus(feedback.id, 'new')}
                        >
                            Mark as New
                        </AdminButton>
                    )}
                    {feedback.status !== 'reviewed' && (
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => onUpdateStatus(feedback.id, 'reviewed')}
                        >
                            Mark as Reviewed
                        </AdminButton>
                    )}
                    {feedback.status !== 'resolved' && (
                        <AdminButton
                            variant="secondary"
                            size="sm"
                            disabled={actionLoading}
                            onClick={() => onUpdateStatus(feedback.id, 'resolved')}
                        >
                            Mark as Resolved
                        </AdminButton>
                    )}
                </div>
            </div>
        </div>
    </AdminModal>
);

FeedbackDetailModal.propTypes = {
    feedback: PropTypes.object.isRequired,
    statusBadge: PropTypes.node,
    formatDate: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    replies: PropTypes.array,
    loadingReplies: PropTypes.bool,
    replyMessage: PropTypes.string,
    onReplyMessageChange: PropTypes.func.isRequired,
    replyLoading: PropTypes.bool,
    replySuccess: PropTypes.bool,
    replyError: PropTypes.string,
    onSendReply: PropTypes.func.isRequired,
    logsExpanded: PropTypes.bool,
    onToggleLogs: PropTypes.func.isRequired,
    logsCopied: PropTypes.bool,
    onCopyLogs: PropTypes.func.isRequired,
    actionLoading: PropTypes.bool,
    onUpdateStatus: PropTypes.func.isRequired,
};

export default FeedbackDetailModal;
