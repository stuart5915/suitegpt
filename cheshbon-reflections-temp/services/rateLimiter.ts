/**
 * Simple rate limiter with debounce utility
 * Prevents accidental double-taps on AI functions
 */

const lastCalls: Record<string, number> = {};
const DEBOUNCE_MS = 2000;

/**
 * Check if a function can be called now (debounce)
 * Returns true if enough time has passed since last call
 */
export function canCallNow(fnName: string): boolean {
    const now = Date.now();
    const lastCall = lastCalls[fnName] || 0;

    if (now - lastCall < DEBOUNCE_MS) {
        console.log(`⏳ Rate limited: ${fnName} (wait ${DEBOUNCE_MS - (now - lastCall)}ms)`);
        return false;
    }

    lastCalls[fnName] = now;
    return true;
}

/**
 * Reset debounce for a specific function (for testing)
 */
export function resetDebounce(fnName: string): void {
    delete lastCalls[fnName];
}

/**
 * Reset all debounce timers
 */
export function resetAllDebounce(): void {
    Object.keys(lastCalls).forEach(key => delete lastCalls[key]);
}
