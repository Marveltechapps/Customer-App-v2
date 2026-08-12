/**
 * Session flags for cold-start splash / login routing.
 * Splash is shown once per JS runtime (cold start). Login must not bounce
 * back through Splash after that — that caused the continuous splash loop.
 */

/** Unique per JS bundle load (debug / optional analytics only). */
export const APP_LAUNCH_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

let splashCompletedThisSession = false;

/** Call when Splash has run (or when we intentionally skip re-showing it). */
export function markSplashCompleted(): void {
  splashCompletedThisSession = true;
}

export function hasSplashCompletedThisSession(): boolean {
  return splashCompletedThisSession;
}
