/* File: src/contexts/game/gameCloudFunctions.js */
import { functions, auth, appCheck, isEmulatorEnv, ensureAppCheckToken, fetchAppCheckToken } from '../../firebaseConfig'; // Firebase app instance + auth + App Check token helpers
import { httpsCallable } from 'firebase/functions';
import { withDeadline, isDeadlineError } from '../../utils/promiseDeadline';
import { markAppCheckStuck, clearAppCheckStuck, isAppCheckStuck } from '../../utils/appCheckHealth';
import { trackEvent } from '../../utils/analyticsTracker';

/** Thrown by the callable wrappers when App Check attestation failed and the backend then rejected the call. */
export const APPCHECK_ATTESTATION_CODE = 'appcheck-attestation';

/**
 * App Check attestation failed (403 / throttled / reCAPTCHA / bad debug token) and the
 * backend rejected the call. NOT network-class (the network answered) and NOT auth-class
 * (the ID token was fresh): callers queue the payload but the drain retries it a
 * bounded number of times so a persistent misconfiguration cannot pile up silently.
 */
export const isAppCheckAttestationError = (error) => error?.code === APPCHECK_ATTESTATION_CODE;

/**
 * @firebase/functions maps a fetch-level failure (offline, DNS, blocked, missing CORS
 * header) to {status: 0} → FunctionsError('internal', 'internal'). That exact signature
 * — code 'internal' AND the bare lowercase message 'internal' — is the SDK's "no HTTP
 * response" case. A backend crash arrives as 'INTERNAL' and a real HttpsError('internal', …)
 * carries prose, so neither matches. (The same signature also covers a 500 with a
 * non-JSON body — rare; a poisoned entry of that shape pauses the drain like offline
 * does, and the banner's Clear is the way out. Counting retries on it was tried and
 * reverted: DNS-down / captive-portal networks report navigator.onLine === true and
 * fail fetch fast, which marked legitimate sessions failed after five foregrounds.)
 */
export const isSdkFetchFailure = (error) => {
    const rawCode = (error?.code || '').replace(/^functions\//, '');
    return rawCode === 'internal' && error?.message === 'internal';
};

/**
 * Checks if an error is an auth-related error that requires re-login.
 * Used to detect stale auth tokens after long idle periods.
 *
 * @param {Error} error - The error to check
 * @returns {boolean} True if this is an auth error requiring re-login
 */
export const isAuthError = (error) => {
    const authErrorCodes = [
        'auth/user-token-expired',
        'auth/user-disabled',
        'auth/invalid-user-token',
        'auth/requires-recent-login',
        'permission-denied',
        'unauthenticated',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    const errorCode = error?.code?.toLowerCase() || '';

    return (
        authErrorCodes.some(code => errorCode.includes(code) || errorMessage.includes(code)) ||
        errorMessage.includes('unauthenticated') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('not authenticated')
        // NOTE: deliberately NOT matching a bare 'token' substring. It caught
        // transient/ambiguous errors (e.g. "App Check token is invalid", network
        // "token" timeouts) that are not session expiry, and wrongly forced a
        // sign-out at game start. Genuine expiry still carries an explicit code
        // ('auth/user-token-expired' / 'unauthenticated') matched above.
    );
};

/**
 * Checks if an error is a network or timeout error.
 * Used to detect connectivity issues when calling Cloud Functions.
 *
 * @param {Error} error - The error to check
 * @returns {boolean} True if this is a network/timeout error
 */
export const isNetworkOrTimeoutError = (error) => {
    const networkErrorCodes = [
        'deadline-exceeded',      // Firebase timeout
        'unavailable',            // Service unavailable
        'cancelled',              // Request cancelled
        'network-request-failed', // Network failure
    ];

    const errorCode = error?.code?.toLowerCase() || '';
    const errorMessage = error?.message?.toLowerCase() || '';

    // App-imposed deadlines (src/utils/promiseDeadline.js) and a preflight that refused
    // to fire a callable are network-class: the caller should queue for offline retry.
    if (isDeadlineError(error) || error?.code === 'appcheck-unavailable') return true;

    // The SDK's "no HTTP response" signature (see isSdkFetchFailure). Without this the
    // offline-enqueue branches never fired for the callable.
    if (isSdkFetchFailure(error)) return true;

    return (
        networkErrorCodes.some(code => errorCode.includes(code) || errorMessage.includes(code)) ||
        errorMessage.includes('network') ||
        errorMessage.includes('timeout') ||
        errorMessage.includes('timed out') ||
        errorMessage.includes('deadline')
    );
};

// --- Define the callable function references ---
let generateSequenceCallable;
try {
    // 30 second timeout to handle network issues (QUIC protocol timeouts, etc.)
    generateSequenceCallable = httpsCallable(functions, 'generateSequence', { timeout: 30000 });
} catch (error) {
    console.error("[gameCloudFunctions] Failed to get 'generateSequence' callable function.", error);
}

// New App-Check-enforced game save endpoint. Replaces the legacy calculateAndSaveResultsHttp
// raw-fetch path. The Firebase SDK attaches the App Check token automatically.
let calculateAndSaveResultsCallable;
try {
    calculateAndSaveResultsCallable = httpsCallable(functions, 'calculateAndSaveResults', { timeout: 60000 });
} catch (error) {
    console.error("[gameCloudFunctions] Failed to get 'calculateAndSaveResults' callable function.", error);
}

// --- Deadlines (frontend-only; NOT in gameConstants.js, which is sync-disciplined with functions/) ---
// httpsCallable's { timeout } only wraps the HTTP POST. Token acquisition (App Check +
// Auth) runs BEFORE it, inside the SDK's getContext(), with no timeout at all — and
// @firebase/app-check shares ONE un-timed exchange promise across every consumer. A
// silent network black-hole (2026-09-04: always-on VPN dropping packets with no RST)
// left that promise pending for over an hour and hung every save/start forever, with
// no catch running and no offline enqueue. The preflight below bounds the token step;
// the backstops bound the callables themselves. Recovery: src/utils/appCheckHealth.js.
const PREFLIGHT_BUDGET_MS = 20000;     // normal exchange 1–3s; slow-but-alive 2G ≈ 13s
const STUCK_PROBE_MS = 3000;           // while stuck: a recovered SDK answers from cache in <50ms
const SAVE_BACKSTOP_MS = 90000;        // 60s SDK POST timeout + 30s slack
const GENERATE_BACKSTOP_MS = 60000;    // 30s SDK POST timeout + slack
const TOKEN_REFRESH_DEADLINE_MS = 10000;

const networkClassError = (message, code) => {
    const err = new Error(message);
    err.code = code;
    return err;
};

const APPCHECK_NETWORK_SDK_CODE = 'appCheck/fetch-network-error';

const createAttestationError = ({ sdkCode, sdkMessage = '', source, cause = null }) => {
    // No SDK message in the Error message: the classifiers scan messages, and the SDK's
    // wording ("network", "timed out") must not re-route this as offline.
    const err = new Error(`App Check attestation failed (${sdkCode}); the backend rejects calls without a valid token`);
    err.code = APPCHECK_ATTESTATION_CODE;
    err.appCheckCode = sdkCode;
    err.appCheckMessage = sdkMessage;
    if (cause) err.cause = cause;
    console.warn(`[preflight:${source}] App Check attestation failed (${sdkCode}): ${sdkMessage}`);
    try {
        trackEvent('appcheck_attestation_failed', { source, sdk_code: sdkCode });
    } catch (_) { /* telemetry must never affect the save flow */ }
    return err;
};

/**
 * Bounded token acquisition BEFORE a callable fires.
 *
 * - App Check via getToken(false): mirrors what the SDK does inside the callable —
 *   the cached token if valid, otherwise the shared exchange promise, which is exactly
 *   the step that can wedge. Missing the deadline marks the SDK stuck (arms the
 *   recovery reload); while stuck we re-probe with a short deadline and clear on success.
 * - An SDK error is classified, not swallowed:
 *     `appCheck/fetch-network-error` → throw 'appcheck-unavailable' (network-class; the
 *       callable's POST would fail the same way). Callers enqueue.
 *     anything else (403 attestation failure, throttled backoff, reCAPTCHA, revoked or
 *       blank debug token) → the SDK answered, so it is NOT stuck and NOT offline. An
 *       unforced getToken returns a valid cached token BEFORE it ever reaches the
 *       exchange, so an error here means no valid token exists: the callable would fire
 *       with no X-Firebase-AppCheck header and get a guaranteed 401. Throw
 *       'appcheck-attestation' instead of spending the invocation (neither network nor
 *       auth: callers queue it, the drain retries a bounded number of times). In the
 *       emulator (App Check not enforced) the callable still fires and a 401, if any,
 *       is translated the same way (translateAppCheckRejection).
 * - Auth via getIdToken(false): cached unless expired; a refresh is SDK-bounded but
 *   waits on App Check first, so it only gets the remaining budget.
 *
 * @param {{ source?: string }} [opts] caller tag for telemetry ('save', 'generate', ...)
 * @returns {Promise<{ appCheckFailure: null | { code: string, message: string } }>}
 * @throws DeadlineError (code appcheck-deadline | appcheck-stuck-probe | idtoken-deadline),
 *   Error with code 'appcheck-unavailable' or 'appcheck-attestation', or the underlying
 *   Auth error (e.g. auth/user-token-expired) unchanged.
 */
export const preflightBackendTokens = async ({ source = 'unknown' } = {}) => {
    const outcome = { appCheckFailure: null };
    if (!appCheck) return outcome; // App Check never initialized: nothing can wedge; keep today's behavior
    const stuck = isAppCheckStuck();
    const budget = stuck ? STUCK_PROBE_MS : PREFLIGHT_BUDGET_MS;
    const started = Date.now();
    let token;
    let sdkError;
    try {
        ({ token, error: sdkError } = await withDeadline(fetchAppCheckToken(false), budget, {
            label: 'App Check token',
            code: stuck ? 'appcheck-stuck-probe' : 'appcheck-deadline',
        }));
    } catch (error) {
        if (isDeadlineError(error)) {
            console.warn(`[preflight:${source}] App Check token exceeded ${budget}ms; the SDK exchange promise is wedged.`);
            markAppCheckStuck(source);
        }
        throw error;
    }
    // The SDK answered (with a token or an error): it is not wedged.
    clearAppCheckStuck();
    if (sdkError) {
        const sdkCode = sdkError?.code || 'unknown';
        if (sdkCode === APPCHECK_NETWORK_SDK_CODE) {
            throw networkClassError(`App Check token unavailable (network): ${sdkError.message}`, 'appcheck-unavailable');
        }
        if (!isEmulatorEnv) {
            throw createAttestationError({ sdkCode, sdkMessage: sdkError?.message || '', source });
        }
        // Emulator: functions there do not enforce App Check, so the call usually succeeds.
        console.warn(`[preflight:${source}] App Check error (${sdkCode}) in the emulator; firing the callable anyway.`);
        outcome.appCheckFailure = { code: sdkCode, message: sdkError?.message || '' };
    } else if (token === null && !isEmulatorEnv) {
        throw networkClassError('App Check token unavailable (no token and no error from the SDK)', 'appcheck-unavailable');
    }
    const user = auth.currentUser;
    if (user) {
        const remaining = Math.max(1000, budget - (Date.now() - started));
        await withDeadline(user.getIdToken(false), remaining, { label: 'Auth ID token', code: 'idtoken-deadline' });
    }
    return outcome;
};

/**
 * Fallback for the case where a preflight recorded an App Check error but let the
 * callable fire (emulator): the SDK sent the request with NO X-Firebase-AppCheck header,
 * so a 401 ('unauthenticated') is App Check's doing, not session expiry — the ID token
 * was just verified fresh. Translate it; any other rejection passes through unchanged.
 */
const translateAppCheckRejection = (error, preflight, source) => {
    const failure = preflight?.appCheckFailure;
    if (!failure) return error;
    const rawCode = (error?.code || '').replace(/^functions\//, '');
    if (rawCode !== 'unauthenticated') return error;
    return createAttestationError({ sdkCode: failure.code, sdkMessage: failure.message, source, cause: error });
};

/**
 * Frontend wrapper for the 'calculateAndSaveResults' callable.
 * Accepts the same payload shape as the legacy calculateAndSaveResultsHttp.
 * Returns the plain results object (the Firebase SDK unwraps `{ data: ... }` automatically).
 *
 * Bounded end to end: token preflight (see preflightBackendTokens) then a hard backstop
 * around the callable. Every consumer (gameEnd, chain block saves, the offline drain)
 * inherits both. A backstop rejection may leave the POST in flight; if it lands, the
 * queued retry is answered idempotently by the backend's clientSessionId check.
 */
export const calculateAndSaveResultsCall = async (payload) => {
    if (!calculateAndSaveResultsCallable) {
        throw new Error("calculateAndSaveResults callable is not available.");
    }
    const preflight = await preflightBackendTokens({ source: 'save' });
    try {
        const result = await withDeadline(calculateAndSaveResultsCallable(payload), SAVE_BACKSTOP_MS, {
            label: 'calculateAndSaveResults',
            code: 'save-deadline',
        });
        return result.data;
    } catch (error) {
        throw translateAppCheckRejection(error, preflight, 'save');
    }
};

/**
 * Frontend wrapper function to call the backend 'generateSequence' Cloud Function.
 * @param {object} data - The data payload to send to the backend function.
 * @param {number} data.nBack - The n-back level.
 * @param {number} data.difficulty - The difficulty level (0.0-0.95 or 0.0-1.0 depending on backend).
 * @param {boolean} data.isPlayground - True if it's a playground session.
 * @param {string|null} data.profileId - The user's profile ID (can be null for playground).
 * @param {object|null} [data.playgroundParams] - Specific parameters for playground mode.
 * @returns {Promise<object>} A promise that resolves with the backend response object
 *                            (containing sequence, parameters, matches, etc.).
 * @throws {Error} Throws an error if the backend call fails or the callable wasn't initialized.
 */
export const generateSequenceHttp = async (data) => {
    if (!generateSequenceCallable) {
        console.error("[generateSequenceHttp] Cannot call backend: callable function reference is not available.");
        throw new Error("Sequence generation service unavailable.");
    }

    let preflight = null;
    try {
        // Bounded token step + backstop (see preflightBackendTokens / the deadline constants).
        preflight = await preflightBackendTokens({ source: 'generate' });
        const result = await withDeadline(generateSequenceCallable(data), GENERATE_BACKSTOP_MS, {
            label: 'generateSequence',
            code: 'generate-deadline',
        });
        // The callable function result has the data nested under a 'data' property
        return result.data;
    } catch (rawError) {
        // An attestation-failure 401 must not look like session expiry (auth retry → sign-out).
        const error = translateAppCheckRejection(rawError, preflight, 'generate');
        console.error("[generateSequenceHttp] Backend function call failed:", error);

        // Check if this is an auth error (stale token after long idle)
        if (isAuthError(error)) {
            const authError = new Error('Your session has expired. Please log in again.');
            authError.isAuthError = true;
            authError.originalError = error;
            throw authError;
        }

        // Rethrow with context. The message keeps the original text (so 'timed out' /
        // 'network' still classify), and the code survives for callers and telemetry.
        const wrapped = new Error(`Failed to generate sequence: ${error.message}`);
        wrapped.code = error?.code;
        if (error?.appCheckCode) wrapped.appCheckCode = error.appCheckCode;
        wrapped.cause = error;
        throw wrapped;
    }
};

/**
 * Calls generateSequenceHttp, and if it fails with an auth-classified error,
 * makes ONE silent recovery attempt — force-refresh the Firebase ID token and
 * the App Check token, then retry once — before letting the error propagate.
 *
 * This prevents a single transient auth/App-Check hiccup (common on flaky/VPN
 * networks) from being treated as a hard session expiry and signing the user out
 * at game start. `generateSequence` is a pure, idempotent sequence generator
 * (no writes), so calling it twice is safe. If the retry also fails with an auth
 * error, it propagates to the caller's existing sign-out path (genuine expiry).
 *
 * @param {object} data - Same payload as generateSequenceHttp.
 * @returns {Promise<object>} The backend response object.
 */
export const generateSequenceWithAuthRetry = async (data) => {
    try {
        return await generateSequenceHttp(data);
    } catch (error) {
        // Only attempt recovery for auth-classified failures; rethrow everything else unchanged.
        if (!(error?.isAuthError || isAuthError(error))) {
            throw error;
        }
        console.warn('[generateSequenceWithAuthRetry] Auth error on first attempt — refreshing tokens and retrying once.');
        // Best-effort token refresh; ignore failures here and let the retry surface them.
        // Both are bounded: a forced refresh waits on App Check, which can be wedged.
        try {
            await withDeadline(Promise.resolve(auth.currentUser?.getIdToken(true)), TOKEN_REFRESH_DEADLINE_MS, {
                label: 'ID token refresh',
                code: 'auth-refresh-deadline',
            });
        } catch (refreshError) {
            console.warn('[generateSequenceWithAuthRetry] ID token refresh failed:', refreshError?.message);
        }
        // Skip the forced App Check refresh while the SDK is wedged — it would only queue
        // behind the same stuck exchange promise. Forced refreshes never mark stuck.
        if (!isAppCheckStuck()) {
            try {
                await withDeadline(ensureAppCheckToken(true), TOKEN_REFRESH_DEADLINE_MS, {
                    label: 'App Check refresh',
                    code: 'appcheck-refresh-deadline',
                });
            } catch (appCheckError) {
                console.warn('[generateSequenceWithAuthRetry] App Check token refresh failed:', appCheckError?.message);
            }
        }
        // Retry once. If this also throws an auth error, it propagates to the caller
        // (gameSetup), which signs the user out — the genuine-expiry path.
        return await generateSequenceHttp(data);
    }
};

/**
 * Checks if an error is a network error from a raw fetch() call.
 * Raw fetch throws TypeError when offline, which is different from Firebase callable errors.
 *
 * @param {Error} error - The error to check
 * @returns {boolean} True if this is a fetch network error
 */
export const isFetchNetworkError = (error) => {
    // Raw fetch() throws TypeError: Failed to fetch when offline
    if (error instanceof TypeError && error.message === 'Failed to fetch') return true;
    // Also check the Firebase callable error patterns for completeness
    return isNetworkOrTimeoutError(error);
};

// getCalculateResultsUrl (legacy raw-fetch calculateAndSaveResultsHttp URL builder) removed —
// every save goes through the App-Check-enforced callable above and nothing imported it.

// checkDailySessionLimit removed - free tier now has unlimited sessions
// The backend function is kept deployed (returns canPlay: true) for old client backward compatibility