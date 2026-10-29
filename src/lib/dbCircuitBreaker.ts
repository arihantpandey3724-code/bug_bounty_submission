import prisma from "./prisma";

// Circuit breaker state
let isDbOnline = false;
let lastCheckTime = 0;
const CHECK_COOLDOWN_MS = 60000; // Only retry remote DB once per minute if failing
let hasCheckedInitial = false;

/**
 * Checks whether the PostgreSQL database is reachable.
 * Protects against 5-second TCP connection hangs when the database is offline or blocked.
 */
export async function isDbReachable(): Promise<boolean> {
  const now = Date.now();

  // If currently offline and cooldown hasn't expired, return false immediately (0ms)
  if (hasCheckedInitial && !isDbOnline && now - lastCheckTime < CHECK_COOLDOWN_MS) {
    return false;
  }

  // Attempt lightweight query with a strict 400ms timeout race
  try {
    const probePromise = prisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DB probe timeout")), 400)
    );

    await Promise.race([probePromise, timeoutPromise]);
    isDbOnline = true;
    lastCheckTime = now;
    hasCheckedInitial = true;
    return true;
  } catch {
    isDbOnline = false;
    lastCheckTime = now;
    hasCheckedInitial = true;
    return false;
  }
}

/**
 * Synchronous check of the current circuit-breaker state without blocking.
 */
export function isDbActiveSync(): boolean {
  if (!hasCheckedInitial) return false;
  if (!isDbOnline && Date.now() - lastCheckTime < CHECK_COOLDOWN_MS) {
    return false;
  }
  return isDbOnline;
}

/**
 * Manually trips the circuit breaker to offline mode when a query catches an error.
 */
export function markDbOffline(): void {
  isDbOnline = false;
  lastCheckTime = Date.now();
  hasCheckedInitial = true;
}
