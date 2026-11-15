/* src/components/coach/CoachSettings.js */
import React, { useState, useEffect, useCallback } from 'react';
import { useCoach } from '../../contexts/CoachContext';
import LoadingSpinner from '../ui/LoadingSpinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLink, faCopy, faCheck, faRotate, faCreditCard, faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { isNative } from '../../utils/platform';

const MINIMUM_SEATS = 3;
const PRICE_PER_SEAT = 12;

const CoachSettings = () => {
    const { coachData, isLoading, regenerateInviteCode, startCheckout, updateCoachSeats, fetchDashboard } = useCoach();
    const [copied, setCopied] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regenError, setRegenError] = useState(null);

    // Billing state
    const [seatCount, setSeatCount] = useState(MINIMUM_SEATS);
    const [isProcessing, setIsProcessing] = useState(false);
    const [billingError, setBillingError] = useState(null);
    const [checkoutBanner, setCheckoutBanner] = useState(null); // { type: 'success' | 'canceled', message }

    // Seat management state (for active subscriptions)
    const [newSeatCount, setNewSeatCount] = useState(null);
    const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
    const [seatUpdateMessage, setSeatUpdateMessage] = useState(null);

    // Initialize newSeatCount from coachData
    useEffect(() => {
        if (coachData?.seatsPurchased) {
            setNewSeatCount(coachData.seatsPurchased);
        }
    }, [coachData?.seatsPurchased]);

    // Post-checkout URL param handling
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const checkoutStatus = params.get('checkout');
        if (checkoutStatus === 'success') {
            setCheckoutBanner({ type: 'success', message: 'Subscription activated! Your coach plan is now active.' });
            fetchDashboard();
            window.history.replaceState({}, '', '/coach/settings');
        } else if (checkoutStatus === 'canceled') {
            setCheckoutBanner({ type: 'canceled', message: 'Checkout canceled. No charges were made.' });
            window.history.replaceState({}, '', '/coach/settings');
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-dismiss banners
    useEffect(() => {
        if (!checkoutBanner) return;
        const timer = setTimeout(() => setCheckoutBanner(null), 8000);
        return () => clearTimeout(timer);
    }, [checkoutBanner]);

    const handleStartCheckout = useCallback(async () => {
        if (isNative() || isProcessing) return;
        setIsProcessing(true);
        setBillingError(null);
        try {
            const result = await startCheckout(seatCount);
            if (result?.checkoutUrl) {
                window.location.href = result.checkoutUrl;
            } else {
                throw new Error('Could not create checkout session.');
            }
        } catch (err) {
            setBillingError(err.message || 'Failed to start checkout.');
            setIsProcessing(false);
        }
    }, [isProcessing, seatCount, startCheckout]);

    const handleUpdateSeats = useCallback(async () => {
        if (isUpdatingSeats || newSeatCount === coachData?.seatsPurchased) return;
        setIsUpdatingSeats(true);
        setSeatUpdateMessage(null);
        setBillingError(null);
        try {
            await updateCoachSeats(newSeatCount);
            setSeatUpdateMessage({ type: 'success', text: `Seats updated to ${newSeatCount}.` });
            setTimeout(() => setSeatUpdateMessage(null), 5000);
        } catch (err) {
            setBillingError(err.message || 'Failed to update seats.');
        } finally {
            setIsUpdatingSeats(false);
        }
    }, [isUpdatingSeats, newSeatCount, coachData?.seatsPurchased, updateCoachSeats]);

    if (isLoading && !coachData) {
        return <LoadingSpinner message="Loading settings..." />;
    }

    const inviteUrl = coachData?.inviteCode
        ? `${window.location.origin}/join/coach/${coachData.inviteCode}`
        : null;

    const handleCopy = async () => {
        if (!inviteUrl) return;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            const input = document.createElement('input');
            input.value = inviteUrl;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleRegenerate = async () => {
        if (isRegenerating) return;
        if (!confirm('Generate a new invite link? The old link will stop working.')) return;
        setIsRegenerating(true);
        setRegenError(null);
        try {
            await regenerateInviteCode();
        } catch (err) {
            setRegenError(err.message || 'Failed to regenerate.');
        } finally {
            setIsRegenerating(false);
        }
    };

    const hasSubscription = !!coachData?.stripeCoachSubscriptionId;
    const seatsUsed = coachData?.seatsUsed || 0;
    const seatsPurchased = coachData?.seatsPurchased || 0;
    const seatMinForUpdate = Math.max(MINIMUM_SEATS, seatsUsed);

    return (
        <div className="max-w-2xl mx-auto">
            {/* Checkout banner */}
            {checkoutBanner && (
                <div className={`mb-6 p-3 border text-sm font-mono flex items-center justify-between ${
                    checkoutBanner.type === 'success'
                        ? 'bg-neural-dendrite/10 border-neural-dendrite/30 text-neural-dendrite'
                        : 'bg-theme-accent/10 border-theme-accent/30 text-theme-accent'
                }`}>
                    <span>{checkoutBanner.message}</span>
                    <button
                        onClick={() => setCheckoutBanner(null)}
                        className="ml-4 opacity-60 hover:opacity-100 transition-opacity"
                    >
                        &times;
                    </button>
                </div>
            )}

            {/* Header */}
            <div className="mb-8">
                <p className="text-xs font-mono uppercase tracking-[0.2em] text-theme-text-muted mb-1">
                    Coach Portal
                </p>
                <h1 className="text-2xl font-serif italic text-theme-text">
                    Settings
                </h1>
            </div>

            {/* Invite Link Section */}
            <div className="bg-theme-bg-secondary border border-theme-line mb-6">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted flex items-center gap-2">
                        <FontAwesomeIcon icon={faLink} className="w-3.5 h-3.5" />
                        Invite Link
                    </h2>
                </div>
                <div className="p-4">
                    <p className="text-sm text-theme-text-secondary mb-4">
                        Share this link with your clients. They'll see a consent page before joining.
                    </p>

                    {inviteUrl ? (
                        <>
                            <div className="flex items-stretch gap-2 mb-3">
                                <div className="flex-1 bg-theme-bg border border-theme-line px-3 py-2 font-mono text-xs text-theme-text overflow-hidden text-ellipsis whitespace-nowrap">
                                    {inviteUrl}
                                </div>
                                <button
                                    onClick={handleCopy}
                                    className={`px-4 py-2 text-xs font-mono uppercase tracking-wider border transition-all duration-200 flex items-center gap-2 ${
                                        copied
                                            ? 'bg-neural-dendrite/20 text-neural-dendrite border-neural-dendrite/30'
                                            : 'bg-theme-bg-elevated text-theme-text-secondary border-theme-line hover:border-warm-muted'
                                    }`}
                                >
                                    <FontAwesomeIcon icon={copied ? faCheck : faCopy} className="w-3.5 h-3.5" />
                                    {copied ? 'Copied' : 'Copy'}
                                </button>
                            </div>

                            <button
                                onClick={handleRegenerate}
                                disabled={isRegenerating}
                                className="text-xs font-mono text-theme-text-muted hover:text-theme-accent transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <FontAwesomeIcon icon={faRotate} className={`w-3 h-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                                {isRegenerating ? 'Generating...' : 'Generate new link'}
                            </button>

                            {regenError && (
                                <div className="mt-2 p-2 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                                    {regenError}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-theme-text-muted font-mono">
                            No invite code available. Please contact support.
                        </p>
                    )}
                </div>
            </div>

            {/* Account Info */}
            <div className="bg-theme-bg-secondary border border-theme-line mb-6">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted">
                        Account
                    </h2>
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Name</span>
                        <span className="text-sm font-mono text-theme-text">{coachData?.displayName || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Email</span>
                        <span className="text-sm font-mono text-theme-text">{coachData?.email || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Status</span>
                        <span className={`px-2 py-0.5 text-xs font-mono border ${
                            coachData?.status === 'active'
                                ? 'bg-neural-dendrite/20 text-neural-dendrite border-neural-dendrite/30'
                                : 'bg-theme-accent/20 text-theme-accent border-theme-accent/30'
                        }`}>
                            {coachData?.status || 'unknown'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Seats</span>
                        <span className="text-sm font-mono text-theme-text">
                            {seatsUsed} / {seatsPurchased}
                        </span>
                    </div>
                </div>
            </div>

            {/* Billing */}
            {(!isNative() || hasSubscription) && <div className="bg-theme-bg-secondary border border-theme-line">
                <div className="border-b border-theme-line px-4 py-3">
                    <h2 className="text-sm font-mono uppercase tracking-wider text-theme-text-muted flex items-center gap-2">
                        <FontAwesomeIcon icon={faCreditCard} className="w-3.5 h-3.5" />
                        Billing
                    </h2>
                </div>
                <div className="p-4">
                    {!hasSubscription ? (
                        /* State A: No subscription — checkout flow */
                        <div>
                            <p className="text-sm text-theme-text-secondary mb-4">
                                Subscribe to activate your coach portal. Choose how many client seats you need.
                            </p>

                            {/* Seat selector */}
                            <div className="mb-4">
                                <label className="text-xs font-mono uppercase tracking-wider text-theme-text-muted block mb-2">
                                    Client Seats
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setSeatCount(s => Math.max(MINIMUM_SEATS, s - 1))}
                                        disabled={seatCount <= MINIMUM_SEATS}
                                        className="w-8 h-8 flex items-center justify-center border border-theme-line text-theme-text-secondary hover:border-warm-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <FontAwesomeIcon icon={faMinus} className="w-3 h-3" />
                                    </button>
                                    <input
                                        type="number"
                                        value={seatCount}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) setSeatCount(Math.max(MINIMUM_SEATS, val));
                                        }}
                                        min={MINIMUM_SEATS}
                                        className="w-16 text-center bg-theme-bg border border-theme-line px-2 py-1.5 font-mono text-sm text-theme-text focus:outline-none focus:border-warm-muted"
                                    />
                                    <button
                                        onClick={() => setSeatCount(s => s + 1)}
                                        className="w-8 h-8 flex items-center justify-center border border-theme-line text-theme-text-secondary hover:border-warm-muted transition-all duration-200"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>

                            {/* Price display */}
                            <div className="bg-theme-bg border border-theme-line p-3 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono text-theme-text-muted">
                                        {seatCount} seats &times; ${PRICE_PER_SEAT}/mo
                                    </span>
                                    <span className="text-lg font-mono text-theme-text">
                                        ${seatCount * PRICE_PER_SEAT}/mo
                                    </span>
                                </div>
                                <p className="text-xs font-mono text-theme-text-muted mt-1">
                                    Minimum {MINIMUM_SEATS} seats. Add more anytime.
                                </p>
                            </div>

                            {/* Subscribe button */}
                            <button
                                onClick={handleStartCheckout}
                                disabled={isProcessing}
                                className="w-full px-4 py-2.5 text-xs font-mono uppercase tracking-wider border border-theme-accent text-theme-accent hover:bg-theme-accent/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                        Creating checkout...
                                    </>
                                ) : (
                                    'Subscribe'
                                )}
                            </button>
                        </div>
                    ) : (
                        /* State B: Active subscription — seat management */
                        <div>
                            {/* Current plan info */}
                            <div className="space-y-3 mb-5">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Plan Status</span>
                                    <span className="px-2 py-0.5 text-xs font-mono border bg-neural-dendrite/20 text-neural-dendrite border-neural-dendrite/30">
                                        active
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Current Seats</span>
                                    <span className="text-sm font-mono text-theme-text">{seatsPurchased}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Seats Used</span>
                                    <span className="text-sm font-mono text-theme-text">{seatsUsed} / {seatsPurchased}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-mono uppercase tracking-wider text-theme-text-muted">Monthly Cost</span>
                                    <span className="text-sm font-mono text-theme-text">${seatsPurchased * PRICE_PER_SEAT}/mo</span>
                                </div>
                            </div>

                            {/* Seat adjustment */}
                            <div className="border-t border-theme-line pt-4">
                                <label className="text-xs font-mono uppercase tracking-wider text-theme-text-muted block mb-2">
                                    Adjust Seats
                                </label>
                                <div className="flex items-center gap-3 mb-3">
                                    <button
                                        onClick={() => setNewSeatCount(s => Math.max(seatMinForUpdate, (s || seatsPurchased) - 1))}
                                        disabled={isUpdatingSeats || (newSeatCount || seatsPurchased) <= seatMinForUpdate}
                                        className="w-8 h-8 flex items-center justify-center border border-theme-line text-theme-text-secondary hover:border-warm-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <FontAwesomeIcon icon={faMinus} className="w-3 h-3" />
                                    </button>
                                    <input
                                        type="number"
                                        value={newSeatCount || seatsPurchased}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (!isNaN(val)) setNewSeatCount(Math.max(seatMinForUpdate, val));
                                        }}
                                        min={seatMinForUpdate}
                                        disabled={isUpdatingSeats}
                                        className="w-16 text-center bg-theme-bg border border-theme-line px-2 py-1.5 font-mono text-sm text-theme-text focus:outline-none focus:border-warm-muted disabled:opacity-50"
                                    />
                                    <button
                                        onClick={() => setNewSeatCount(s => (s || seatsPurchased) + 1)}
                                        disabled={isUpdatingSeats}
                                        className="w-8 h-8 flex items-center justify-center border border-theme-line text-theme-text-secondary hover:border-warm-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="w-3 h-3" />
                                    </button>

                                    {newSeatCount !== seatsPurchased && (
                                        <span className="text-xs font-mono text-theme-text-muted">
                                            &rarr; ${(newSeatCount || seatsPurchased) * PRICE_PER_SEAT}/mo
                                        </span>
                                    )}
                                </div>

                                {seatsUsed > MINIMUM_SEATS && (
                                    <p className="text-xs font-mono text-theme-text-muted mb-3">
                                        Minimum {seatsUsed} seats (you have {seatsUsed} active clients).
                                    </p>
                                )}

                                <button
                                    onClick={handleUpdateSeats}
                                    disabled={isUpdatingSeats || newSeatCount === seatsPurchased}
                                    className="px-4 py-2 text-xs font-mono uppercase tracking-wider border border-theme-line text-theme-text-secondary hover:border-warm-muted transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isUpdatingSeats ? (
                                        <>
                                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin inline-block" />
                                            Updating...
                                        </>
                                    ) : (
                                        'Update Seats'
                                    )}
                                </button>

                                {seatUpdateMessage && (
                                    <div className="mt-3 p-2 bg-neural-dendrite/10 border border-neural-dendrite/30 text-xs font-mono text-neural-dendrite">
                                        {seatUpdateMessage.text}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Billing error */}
                    {billingError && (
                        <div className="mt-3 p-2 bg-neural-synapse/10 border border-neural-synapse/30 text-xs font-mono text-neural-synapse">
                            {billingError}
                        </div>
                    )}
                </div>
            </div>}
        </div>
    );
};

export default CoachSettings;
