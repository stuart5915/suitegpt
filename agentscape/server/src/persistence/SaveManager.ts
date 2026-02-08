// ============================================================
// AgentScape — Save Manager (batch saves every 30s)
// ============================================================

import { MapSchema } from '@colyseus/schema';
import { PlayerSchema } from '../schema/PlayerSchema';
import { SupabaseAdapter } from './SupabaseAdapter';
import { SAVE_INTERVAL } from '../config';

export class SaveManager {
    private supabase: SupabaseAdapter;
    private timer: NodeJS.Timer | null = null;
    private extraDataSerializer: ((player: PlayerSchema) => string) | null = null;

    constructor(supabase: SupabaseAdapter) {
        this.supabase = supabase;
    }

    /** Register a callback that returns extra_data JSON for a player */
    setExtraDataSerializer(fn: (player: PlayerSchema) => string): void {
        this.extraDataSerializer = fn;
    }

    startPeriodicSave(players: MapSchema<PlayerSchema>): void {
        this.timer = setInterval(async () => {
            await this.saveDirtyPlayers(players);
        }, SAVE_INTERVAL);
    }

    stopPeriodicSave(): void {
        if (this.timer) {
            clearInterval(this.timer as any);
            this.timer = null;
        }
    }

    async saveDirtyPlayers(players: MapSchema<PlayerSchema>): Promise<void> {
        const promises: Promise<boolean>[] = [];

        players.forEach((player) => {
            if (player.dirty) {
                player.dirty = false;
                player.lastSaveTime = Date.now();
                const extraData = this.extraDataSerializer ? this.extraDataSerializer(player) : undefined;
                promises.push(this.supabase.savePlayer(player, extraData));
            }
        });

        if (promises.length > 0) {
            const results = await Promise.allSettled(promises);
            const saved = results.filter(r => r.status === 'fulfilled' && r.value).length;
            if (saved > 0) console.log(`[SaveManager] Saved ${saved} players`);
        }
    }

    async savePlayer(player: PlayerSchema): Promise<void> {
        player.dirty = false;
        const extraData = this.extraDataSerializer ? this.extraDataSerializer(player) : undefined;
        await this.supabase.savePlayer(player, extraData);
    }
}
