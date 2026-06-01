/** Unique per JS bundle load — used to invalidate stale Login routes after reload/rebuild. */
export const APP_LAUNCH_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
