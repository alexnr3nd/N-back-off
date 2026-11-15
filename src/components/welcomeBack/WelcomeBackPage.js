import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowLeft, faBrain, faCheck,
    faLightbulb, faQuestionCircle, faCommentDots
} from '@fortawesome/free-solid-svg-icons';
import { useUser } from '../../contexts/UserContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const submitFeedbackFn = httpsCallable(functions, 'submitFeedback');

const REASON_CONTENT = {
    'too-hard': {
        icon: faBrain,
        title: 'Yeah — it feels impossible at first',
        body: (
            <>
                <p>Most people find 2-back nearly impossible on day 1. That's expected — n-back is training your working memory to track two streams without rehearsing them in your head.</p>
                <p>The fix is short, frequent sessions. Five minutes a few times a week beats one long grind.</p>
            </>
        ),
        cta: 'Try a 2-back session',
    },
    'confusing': {
        icon: faQuestionCircle,
        title: "Here's how it actually works",
        body: (
            <>
                <p>Two streams run in parallel: a position (the highlighted tile) and a letter (the audio).</p>
                <p>The button gets pressed when the current one matches what came N steps ago. N starts at 2 by default.</p>
                <p>That's the whole game. The rhythm clicks after a couple of short sessions.</p>
            </>
        ),
        cta: 'Try a session',
    },
    'busy': {
        icon: faLightbulb,
        title: 'A 5-minute session is enough',
        body: (
            <>
                <p>Showing up is the whole game. Most of the research benefit comes from short, consistent sessions — not from long grinds.</p>
                <p>Five minutes today is more useful than thirty minutes next month.</p>
            </>
        ),
        cta: 'Start a 5-minute session',
    },
    'not-expected': {
        icon: faCommentDots,
        title: "Sorry it wasn't what you expected",
        body: (
            <>
                <p>That feedback is genuinely useful. What were you hoping for? Drop a note below and it'll go straight to Allen.</p>
            </>
        ),
        cta: null,
    },
};

const VALID_REASONS = Object.keys(REASON_CONTENT);

const WelcomeBackPage = () => {
    const [searchParams] = useSearchParams();
    const { authUser, userId } = useUser();
    const rawReason = searchParams.get('reason');
    const reason = VALID_REASONS.includes(rawReason) ? rawReason : 'too-hard';
    const content = REASON_CONTENT[reason];

    const [moreText, setMoreText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const trimmed = moreText.trim();
        if (!trimmed) return;
        setSubmitting(true);
        setError('');
        try {
            await submitFeedbackFn({
                feedbackType: 'Onboarding Abandonment',
                message: `[${reason} followup] ${trimmed}`,
                userId: userId || null,
                email: authUser?.email || null,
                pageUrl: window.location.href,
                userAgent: navigator.userAgent,
            });
            setSubmitted(true);
            setMoreText('');
        } catch (err) {
            setError('Could not send. Try again?');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-theme-bg lab-grid">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
                <header className="mb-6">
                    <a
                        href="https://dualnback.com"
                        className="inline-flex items-center text-theme-text-muted hover:text-theme-text text-sm font-mono transition-colors mb-4"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="mr-2 h-3 w-3" />
                        dualnback.com
                    </a>
                    <div className="flex items-center">
                        <FontAwesomeIcon icon={content.icon} className="text-theme-accent mr-3 h-6 w-6" />
                        <h1 className="text-2xl font-serif text-theme-text">{content.title}</h1>
                    </div>
                </header>

                <div className="text-theme-text text-base leading-relaxed space-y-4 mb-8">
                    {content.body}
                </div>

                {content.cta && (
                    <div className="mb-8">
                        {authUser ? (
                            <Link
                                to="/game"
                                className="inline-block px-6 py-3 bg-theme-accent text-theme-bg font-mono uppercase text-sm tracking-wider rounded hover:bg-amber-highlight transition-colors"
                            >
                                {content.cta}
                            </Link>
                        ) : (
                            <Link
                                to="/login"
                                className="inline-block px-6 py-3 bg-theme-accent text-theme-bg font-mono uppercase text-sm tracking-wider rounded hover:bg-amber-highlight transition-colors"
                            >
                                Log in to play
                            </Link>
                        )}
                    </div>
                )}

                <div className="border-t border-theme-line pt-6">
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="welcome-back-more" className="block text-sm font-mono text-theme-text-muted mb-2">
                            More context (optional)
                        </label>
                        <textarea
                            id="welcome-back-more"
                            value={moreText}
                            onChange={(e) => setMoreText(e.target.value)}
                            placeholder="What got in the way? What was missing? Anything worth flagging — it goes straight to Allen."
                            rows={4}
                            maxLength={2000}
                            disabled={submitting || submitted}
                            className="w-full px-3 py-2 bg-theme-bg-elevated border border-theme-line rounded text-theme-text text-sm font-mono placeholder-theme-text-muted focus:border-theme-accent focus:outline-none transition-colors"
                        />
                        {error && (
                            <p className="mt-2 text-xs font-mono text-neural-synapse">{error}</p>
                        )}
                        {submitted ? (
                            <p className="mt-3 text-sm font-mono text-theme-accent inline-flex items-center">
                                <FontAwesomeIcon icon={faCheck} className="mr-2 h-3 w-3" />
                                Got it — thanks for the note.
                            </p>
                        ) : (
                            <button
                                type="submit"
                                disabled={submitting || !moreText.trim()}
                                className="mt-3 inline-flex items-center px-4 py-2 bg-theme-bg-elevated border border-theme-line text-theme-text text-sm font-mono rounded hover:border-theme-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {submitting ? 'Sending…' : 'Send'}
                            </button>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default WelcomeBackPage;
