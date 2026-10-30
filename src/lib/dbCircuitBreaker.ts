// Circuit breaker state
// In production on Vercel, the database is strictly mandatory.
// We NEVER disable the database on production because ephemeral in-memory storage causes data loss on serverless cold starts.
const isProduction =
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV);

let isDbOnline = true;
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 30000; // Retry remote DB after 30s if tripped in local dev

/**
 * Synchronous check of the current circuit-breaker state without blocking.
 * Returns true by default to ensure all database operations are attempted.
 * On Vercel / Production, ALWAYS returns true.
 */
export function isDbActiveSync(): boolean {
  if (isProduction) {
    return true;
  }
  if (!isDbOnline && Date.now() - lastCheckTime < CHECK_COOLDOWN_MS) {
    return false;
  }
  return true;
}

/**
 * Manually trips the circuit breaker to offline mode when a database query catches an error.
 * No-op in production on Vercel so serverless containers always attempt DB calls.
 */
export function markDbOffline(): void {
  if (isProduction) return;
  isDbOnline = false;
  lastCheckTime = Date.now();
}

/**
 * Marks database as online after a successful operation.
 */
export function markDbOnline(): void {
  isDbOnline = true;
}
