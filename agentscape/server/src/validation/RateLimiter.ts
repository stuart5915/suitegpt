// ============================================================
// AgentScape — Rate Limiter (max 10 actions/sec per connection)
// ============================================================

export class RateLimiter {
    private limits = new Map<string, { count: number; resetAt: number }>();
    private maxPerSecond: number;

    constructor(maxPerSecond: number = 10) {
        this.maxPerSecond = maxPerSecond;
    }

    check(sessionId: string): boolean {
        const now = Date.now();
        let entry = this.limits.get(sessionId);

        if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + 1000 };
            this.limits.set(sessionId, entry);
        }

        entry.count++;
        return entry.count <= this.maxPerSecond;
    }

    remove(sessionId: string): void {
        this.limits.delete(sessionId);
    }

    cleanup(): void {
        const now = Date.now();
        this.limits.forEach((entry, key) => {
            if (now >= entry.resetAt + 5000) this.limits.delete(key);
        });
    }
}
