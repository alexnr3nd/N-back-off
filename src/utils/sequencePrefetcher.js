// Sequence prefetching is disabled in the offline build. The local sequence generator
// runs synchronously when a session starts, so no remote cache warm-up is required.
export const prefetchSequence = async () => undefined;
export const prefetchForCurrentState = async () => undefined;
