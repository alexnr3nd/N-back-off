/* src/components/program/CohortChat.js */

/**
 * Cohort group chat — real-time messaging with reactions and moderation.
 * Design: Clean, compact — like a research team's communication channel.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faPaperPlane, faFlag, faChevronUp, faFlask, faTrophy, faLock, faPen
} from '@fortawesome/free-solid-svg-icons';
import { faFaceSmile } from '@fortawesome/free-regular-svg-icons';
import { useCohort } from '../../contexts/CohortContext';
import { useUser } from '../../contexts/UserContext';
import AdminBadge from './AdminBadge';

const REACTION_EMOJIS = ['👍', '🔥', '💪', '🧠', '👏', '✅'];

const CohortChat = () => {
    const {
        messages, isLoadingMessages, hasOlderMessages,
        sendMessage, reactToMessage, reportMessage, editMessage,
        loadOlderMessages, isChatOpen, activeCohort,
        cohortMembers
    } = useCohort();
    const { userId } = useUser();

    const [newMessage, setNewMessage] = useState('');
    const [error, setError] = useState(null);
    const [activeReactionMessageId, setActiveReactionMessageId] = useState(null);
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editText, setEditText] = useState('');
    const textareaRef = useRef(null);

    const autoResize = useCallback(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, []);
    const [reportingMessageId, setReportingMessageId] = useState(null);

    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const wasAtBottomRef = useRef(true);

    // Auto-scroll to bottom when new messages arrive (if user was at bottom)
    useEffect(() => {
        if (wasAtBottomRef.current && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages.length]);

    // Track scroll position
    const handleScroll = useCallback(() => {
        const el = chatContainerRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        wasAtBottomRef.current = distanceFromBottom < 50;
    }, []);

    const handleSend = useCallback(() => {
        const text = newMessage.trim();
        if (!text) return;

        setError(null);
        setNewMessage('');
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.focus();
        }

        sendMessage(text).catch(err => {
            const msg = err?.message || 'Failed to send message.';
            setError(msg.includes('HttpsError') ? msg.split(': ').pop() : msg);
        });
    }, [newMessage, sendMessage]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    const handleReaction = useCallback(async (messageId, emoji) => {
        setActiveReactionMessageId(null);
        try {
            await reactToMessage(messageId, emoji);
        } catch (err) {
            console.error('Error reacting:', err);
        }
    }, [reactToMessage]);

    const handleReport = useCallback(async (messageId) => {
        try {
            await reportMessage(messageId, 'Inappropriate content');
            setReportingMessageId(null);
        } catch (err) {
            console.error('Error reporting:', err);
        }
    }, [reportMessage]);

    const handleEditSave = useCallback(async (messageId) => {
        const trimmed = editText.trim();
        if (!trimmed || trimmed === messages.find(m => m.id === messageId)?.text) {
            setEditingMessageId(null);
            return;
        }
        try {
            await editMessage(messageId, trimmed);
        } catch (err) {
            console.error('Error editing message:', err);
        }
        setEditingMessageId(null);
    }, [editText, editMessage, messages]);

    const formatTime = useMemo(() => {
        return (timestamp) => {
            if (!timestamp) return '';
            const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const isYesterday = d.toDateString() === yesterday.toDateString();

            const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

            if (isToday) return time;
            if (isYesterday) return `Yesterday ${time}`;
            return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
        };
    }, []);

    const isReadOnly = !isChatOpen;

    return (
        <div className="flex flex-col" style={{ height: 'min(500px, 60vh)' }}>
            {/* Load older messages */}
            {hasOlderMessages && (
                <button
                    onClick={loadOlderMessages}
                    className="text-xs text-theme-text-muted hover:text-theme-accent py-2 transition-colors inline-flex items-center justify-center gap-1"
                >
                    <FontAwesomeIcon icon={faChevronUp} className="h-2.5 w-2.5" />
                    Load older messages
                </button>
            )}

            {/* Messages area */}
            <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto space-y-0.5 py-2 custom-scrollbar"
            >
                {isLoadingMessages && (
                    <div className="text-center py-4">
                        <span className="text-xs text-theme-text-muted">Loading messages...</span>
                    </div>
                )}

                {!isLoadingMessages && messages.length === 0 && (
                    <div className="text-center py-8">
                        <FontAwesomeIcon icon={faFlask} className="h-6 w-6 text-theme-text-muted/30 mb-2" />
                        <p className="text-sm text-theme-text-muted">No messages yet. Say hello to your cohort!</p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isSystem = msg.type === 'system' || msg.type === 'milestone';
                    const isOwn = msg.authorId === userId;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showAuthor = !isSystem && (!prevMsg || prevMsg.authorId !== msg.authorId || prevMsg.type === 'system' || prevMsg.type === 'milestone');

                    if (isSystem) {
                        return (
                            <div key={msg.id} className="flex items-center justify-center gap-2 py-3 px-4">
                                {msg.type === 'milestone' && (
                                    <FontAwesomeIcon icon={faTrophy} className="h-3 w-3 text-amber-400/70" />
                                )}
                                <p className="text-xs text-theme-text-muted text-center italic">
                                    {msg.text}
                                </p>
                            </div>
                        );
                    }

                    const canEdit = isOwn && !msg._optimistic && msg.timestamp && (() => {
                        const msgTime = msg.timestamp.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
                        return (Date.now() - msgTime.getTime()) < 5 * 60 * 1000;
                    })();

                    return (
                        <div
                            key={msg.id}
                            className={`group relative px-3 py-1 hover:bg-theme-bg-hover/50 rounded transition-colors ${showAuthor ? 'mt-3' : ''}`}
                        >
                            {showAuthor && (
                                <div className="flex items-baseline gap-2 mb-0.5">
                                    <span className={`text-xs font-medium ${isOwn ? 'text-theme-accent' : 'text-theme-text'}`}>
                                        {msg.authorName}
                                    </span>
                                    {cohortMembers.find(m => m.odivId === msg.authorId)?.isAdmin && <AdminBadge />}
                                    <span className="text-[0.625rem] text-theme-text-muted/50">
                                        {formatTime(msg.timestamp)}
                                    </span>
                                </div>
                            )}

                            <div className="flex items-start gap-2">
                                {editingMessageId === msg.id ? (
                                    <div className="flex-1">
                                        <textarea
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(msg.id); }
                                                if (e.key === 'Escape') setEditingMessageId(null);
                                            }}
                                            className="w-full text-sm bg-theme-bg-elevated border border-theme-line rounded px-2 py-1 text-theme-text-secondary resize-none focus:outline-none focus:border-theme-accent"
                                            maxLength={500}
                                            autoFocus
                                        />
                                        <div className="text-[0.625rem] text-theme-text-muted mt-0.5">
                                            Escape to cancel · Enter to save
                                        </div>
                                    </div>
                                ) : (
                                    <p className={`text-sm flex-1 break-words whitespace-pre-wrap ${msg._optimistic ? 'text-theme-text-secondary/60' : 'text-theme-text-secondary'}`}>
                                        {msg.text}
                                        {msg.editedAt && <span className="text-[0.625rem] text-theme-text-muted/50 ml-1">(edited)</span>}
                                    </p>
                                )}

                                {/* Actions (visible on hover) */}
                                {editingMessageId !== msg.id && (
                                    <div className="relative opacity-0 group-hover:opacity-100 select-none flex items-center gap-1 flex-shrink-0 transition-opacity">
                                        {canEdit && (
                                            <button
                                                onClick={() => { setEditingMessageId(msg.id); setEditText(msg.text); }}
                                                className="text-theme-text-muted/50 hover:text-theme-text-muted text-xs p-1 transition-colors"
                                                title="Edit"
                                            >
                                                <FontAwesomeIcon icon={faPen} className="h-2.5 w-2.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setActiveReactionMessageId(
                                                activeReactionMessageId === msg.id ? null : msg.id
                                            )}
                                            className="text-theme-text-muted/50 hover:text-theme-text-muted text-xs p-1 transition-colors"
                                            title="React"
                                        >
                                            <FontAwesomeIcon icon={faFaceSmile} className="h-3 w-3" />
                                        </button>
                                        {!isOwn && (
                                            <button
                                                onClick={() => setReportingMessageId(msg.id)}
                                                className="text-theme-text-muted/30 hover:text-red-400 p-1 transition-colors"
                                                title="Report"
                                            >
                                                <FontAwesomeIcon icon={faFlag} className="h-2.5 w-2.5" />
                                            </button>
                                        )}

                                        {/* Reaction picker (overlay) */}
                                        {activeReactionMessageId === msg.id && (
                                            <div className="absolute right-0 -top-1 -translate-y-full z-10 flex items-center gap-1 bg-theme-bg-elevated border border-theme-line rounded-full px-2 py-1 shadow-lg">
                                                {REACTION_EMOJIS.map(emoji => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => handleReaction(msg.id, emoji)}
                                                        className="hover:scale-125 transition-transform text-sm p-0.5"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Existing reactions */}
                            {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                    {Object.entries(msg.reactions)
                                        .filter(([, users]) => Array.isArray(users) && users.length > 0)
                                        .map(([emoji, users]) => (
                                            <button
                                                key={emoji}
                                                onClick={() => handleReaction(msg.id, emoji)}
                                                className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full border transition-colors ${
                                                    users.includes(userId)
                                                        ? 'border-theme-accent/30 bg-theme-accent/10 text-theme-accent'
                                                        : 'border-theme-line bg-theme-bg-elevated text-theme-text-muted hover:border-theme-accent/20'
                                                }`}
                                            >
                                                <span>{emoji}</span>
                                                <span className="font-mono text-[0.625rem]">{users.length}</span>
                                            </button>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Report confirmation */}
            {reportingMessageId && (
                <div className="px-3 py-2 bg-red-500/5 border border-red-500/20 rounded mb-2 flex items-center justify-between">
                    <p className="text-xs text-red-400">Report this message as inappropriate?</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setReportingMessageId(null)}
                            className="text-xs text-theme-text-muted hover:text-theme-text px-2 py-1"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleReport(reportingMessageId)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                        >
                            Report
                        </button>
                    </div>
                </div>
            )}

            {/* Input area */}
            {isReadOnly ? (
                <div className="flex items-center justify-center gap-2 py-3 px-4 border-t border-theme-line">
                    <FontAwesomeIcon icon={faLock} className="h-3 w-3 text-theme-text-muted" />
                    <p className="text-xs text-theme-text-muted">
                        {activeCohort?.status === 'archived' ? 'Chat is archived.' : 'Chat is read-only.'}
                    </p>
                </div>
            ) : (
                <div className="border-t border-theme-line pt-3">
                    {error && (
                        <p className="text-xs text-red-400 mb-2 px-1">{error}</p>
                    )}
                    <div className="flex items-end gap-2">
                        <textarea
                            ref={textareaRef}
                            value={newMessage}
                            onChange={(e) => { setNewMessage(e.target.value); setError(null); autoResize(); }}
                            onKeyDown={handleKeyDown}
                            placeholder="Message your cohort..."
                            maxLength={500}
                            rows={1}
                            className="flex-1 px-3 py-2 text-sm border border-theme-line rounded bg-theme-bg-elevated text-theme-text placeholder-theme-text-muted focus:outline-none focus:ring-1 focus:ring-theme-accent focus:border-theme-accent resize-none max-h-32 overflow-y-auto custom-scrollbar"
                        />
                        <button
                            onClick={handleSend}
                            disabled={!newMessage.trim()}
                            className="p-2.5 text-theme-accent hover:bg-theme-accent/10 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent flex-shrink-0"
                        >
                            <FontAwesomeIcon icon={faPaperPlane} className="h-4 w-4" />
                        </button>
                    </div>
                    <p className="text-[0.625rem] text-theme-text-muted/50 mt-1 text-right">
                        {newMessage.length}/500
                    </p>
                </div>
            )}
        </div>
    );
};

export default CohortChat;
