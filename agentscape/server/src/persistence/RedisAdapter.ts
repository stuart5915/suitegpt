// ============================================================
// AgentScape — Redis Adapter (tick state, session cache, rate limits)
// ============================================================

import Redis from 'ioredis';

export class RedisAdapter {
    private redis: Redis | null = null;
    private enabled: boolean = false;

    constructor() {
        const redisUrl = process.env.REDIS_URL;
        if (redisUrl) {
            try {
                this.redis = new Redis(redisUrl);
                this.enabled = true;
                console.log('[Redis] Connected');

                this.redis.on('error', (err) => {
                    console.error('[Redis] Error:', err.message);
                });
            } catch (e) {
                console.warn('[Redis] Not available, running without cache');
            }
        } else {
            console.log('[Redis] No REDIS_URL, running without cache');
        }
    }

    async setSession(sessionId: string, data: any, ttl: number = 3600): Promise<void> {
        if (!this.redis) return;
        await this.redis.setex(`session:${sessionId}`, ttl, JSON.stringify(data));
    }

    async getSession(sessionId: string): Promise<any | null> {
        if (!this.redis) return null;
        const data = await this.redis.get(`session:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        if (!this.redis) return;
        await this.redis.del(`session:${sessionId}`);
    }

    async setTickState(roomId: string, tick: number, state: any): Promise<void> {
        if (!this.redis) return;
        await this.redis.setex(`tick:${roomId}`, 60, JSON.stringify({ tick, state }));
    }

    async close(): Promise<void> {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}
