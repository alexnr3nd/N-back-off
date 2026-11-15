/* src/utils/promiseDeadline.js */
/**
 * Wall-clock deadline for any promise.
 *
 * Why this exists: the Firebase SDKs have gaps with no timeout at all. The one
 * that bit us (2026-09-04): `@firebase/app-check` shares a single token-exchange
 * promise across every consumer and never times it out, so after a silent
 * network black-hole `httpsCallable` waits on it forever — the callable's own
 * `{ timeout }` option only wraps the HTTP POST, which runs after token
 * acquisition. See src/utils/appCheckHealth.js for the recovery side.
 *
 * Design notes:
 *  - A plain Error + factory, deliberately NOT `class extends Error`: .babelrc
 *    targets ES5, where subclassing built-ins breaks `instanceof`. Detect with
 *    `isDeadlineError()` (checks `name`) or `error.code`.
 *  - The message always contains "timed out" so `isNetworkOrTimeoutError()` in
 *    gameCloudFunctions.js classifies a deadline as a network-class failure even
 *    when an intermediate wrapper re-throws with a fresh message.
 *  - Never put "unauthenticated", "permission denied" or "not authenticated" in a
 *    label — those substrings would make `isAuthError()` misroute it.
 *  - `Promise.race` keeps handlers attached to the losing promise, so a late
 *    settlement of the underlying operation never becomes an unhandled rejection.
 */

export const DEADLINE_ERROR_NAME = 'DeadlineError';

/**
 * Build the error a deadline rejects with.
 * @param {{ label: string, ms: number, code: string }} opts
 * @returns {Error} plain Error with name 'DeadlineError', `code`, `deadlineMs`
 */
export const createDeadlineError = ({ label, ms, code }) => {
    const err = new Error(`${label} timed out after ${ms}ms`);
    err.name = DEADLINE_ERROR_NAME;
    err.code = code;
    err.deadlineMs = ms;
    return err;
};

/**
 * @param {unknown} error
 * @returns {boolean} true only for errors produced by createDeadlineError
 */
export const isDeadlineError = (error) => Boolean(error) && error.name === DEADLINE_ERROR_NAME;

/**
 * Race `promise` against a timer. Resolves/rejects with the underlying result if
 * it settles first; otherwise rejects with a DeadlineError. The timer is always
 * cleared once either side settles.
 *
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms deadline in milliseconds
 * @param {{ label?: string, code?: string }} [opts] label for the message, code for classifiers/telemetry
 * @returns {Promise<T>}
 */
export const withDeadline = (promise, ms, { label = 'operation', code = 'deadline' } = {}) => {
    let timer = null;
    const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(createDeadlineError({ label, ms, code })), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (timer !== null) clearTimeout(timer);
    });
};
