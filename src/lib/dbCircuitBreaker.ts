// Circuit breaker state
// Default to TRUE so Vercel serverless containers and production environments actively use the database!
let isDbOnline = true;
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 30000; // Retry remote DB after 30s if tripped

/**
 * Synchronous check of the current circuit-breaker state without blocking.
 * Returns true by default to ensure all database operations are attempted.
 * Only returns false if a database error was caught within the last 30 seconds.
 */
export function isDbActiveSync(): boolean {
  if (!isDbOnline && Date.now() - lastCheckTime < CHECK_COOLDOWN_MS) {
    return false;
  }
  return true;
}

/**
 * Manually trips the circuit breaker to offline mode when a database query catches an error.
 */
export function markDbOffline(): void {
  isDbOnline = false;
  lastCheckTime = Date.now();
}

/**
 * Marks database as online after a successful operation.
 */
export function markDbOnline(): void {
  isDbOnline = true;
}
