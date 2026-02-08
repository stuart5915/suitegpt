// ============================================================
// AgentScape — Supabase Persistence Adapter
// Shares the same Supabase instance as suitegpt.app
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PlayerSchema, InventoryItem } from '../schema/PlayerSchema';
import { ITEMS } from '../config';

export class SupabaseAdapter {
    private supabase: SupabaseClient;

    constructor() {
        const url = process.env.SUPABASE_URL || 'https://rdsmdywbdiskxknluiym.supabase.co';
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
        this.supabase = createClient(url, key);
    }

    async fetchAgents(limit: number = 50): Promise<any[]> {
        const { data, error } = await this.supabase
            .from('factory_users')
            .select('id, agent_name, display_name, agent_role, agent_type, telos_objective, agent_api_key')
            .eq('is_agent', true)
            .limit(limit);

        if (error) {
            console.error('Failed to fetch agents:', error);
            return [];
        }
        return data || [];
    }

    async authenticateAgent(apiKey: string): Promise<any | null> {
        const { data, error } = await this.supabase
            .from('factory_users')
            .select('id, agent_name, display_name, agent_role, agent_type')
            .eq('agent_api_key', apiKey)
            .eq('is_agent', true)
            .single();

        if (error || !data) return null;
        return data;
    }

    async verifyToken(token: string): Promise<any | null> {
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        if (error || !user) return null;
        return user;
    }

    async loadPlayerByUserId(userId: string): Promise<any | null> {
        const { data, error } = await this.supabase
            .from('agentscape_players')
            .select('*')
            .eq('supabase_user_id', userId)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data;
    }

    restorePlayer(player: PlayerSchema, saved: any): void {
        player.hp = saved.hp ?? player.hp;
        player.maxHp = saved.max_hp ?? player.maxHp;
        player.energy = saved.energy ?? player.energy;
        player.attack = saved.attack ?? player.attack;
        player.strength = saved.strength ?? player.strength;
        player.defence = saved.defence ?? player.defence;
        player.hitpoints = saved.hitpoints ?? player.hitpoints;
        player.attackXP = saved.attack_xp ?? player.attackXP;
        player.strengthXP = saved.strength_xp ?? player.strengthXP;
        player.defenceXP = saved.defence_xp ?? player.defenceXP;
        player.hitpointsXP = saved.hitpoints_xp ?? player.hitpointsXP;
        player.combatLevel = saved.combat_level ?? player.combatLevel;
        player.coins = saved.coins ?? player.coins;
        player.prayer = saved.prayer ?? player.prayer;
        player.prayerXP = saved.prayer_xp ?? player.prayerXP;
        player.thieving = saved.thieving ?? player.thieving;
        player.thievingXP = saved.thieving_xp ?? player.thievingXP;

        // Restore equipment from item IDs (new format)
        if (saved.equipped_weapon && typeof saved.equipped_weapon === 'string') {
            this.restoreEquipItem(player.equippedWeapon, saved.equipped_weapon);
        }
        if (saved.equipped_helm && typeof saved.equipped_helm === 'string') {
            this.restoreEquipItem(player.equippedHelm, saved.equipped_helm);
        }
        if (saved.equipped_shield && typeof saved.equipped_shield === 'string') {
            this.restoreEquipItem(player.equippedShield, saved.equipped_shield);
        }
        // Gracefully ignore old integer format (equipped_weapon_slot etc.)
    }

    private restoreEquipItem(slot: InventoryItem, itemId: string): void {
        const def = ITEMS[itemId];
        if (!def) return;
        slot.id = def.id;
        slot.name = def.name;
        slot.icon = def.icon;
        slot.quantity = 1;
        slot.type = def.type;
        slot.stackable = def.stackable;
        slot.attackStat = def.stats?.attack || 0;
        slot.strengthStat = def.stats?.strength || 0;
        slot.defenceStat = def.stats?.defence || 0;
        slot.healAmount = def.healAmount || 0;
    }

    async savePlayer(player: PlayerSchema, extraData?: string): Promise<boolean> {
        // Skip saving guests (no supabaseUserId)
        if (!player.supabaseUserId) return true;
        const inventoryData = [];
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item.id) {
                inventoryData.push({
                    slot: i,
                    id: item.id,
                    quantity: item.quantity,
                });
            }
        }

        const questsData: Record<string, any> = {};
        player.quests.forEach((pq, qid) => {
            questsData[qid] = {
                status: pq.status,
                objectiveData: pq.objectiveData,
            };
        });

        const row = {
            session_id: player.sessionId,
            supabase_user_id: player.supabaseUserId,
            name: player.name,
            color: player.color,
            tile_x: player.tileX,
            tile_z: player.tileZ,
            hp: player.hp,
            max_hp: player.maxHp,
            energy: player.energy,
            attack: player.attack,
            strength: player.strength,
            defence: player.defence,
            hitpoints: player.hitpoints,
            attack_xp: player.attackXP,
            strength_xp: player.strengthXP,
            defence_xp: player.defenceXP,
            hitpoints_xp: player.hitpointsXP,
            combat_level: player.combatLevel,
            prayer: player.prayer,
            prayer_xp: player.prayerXP,
            thieving: player.thieving,
            thieving_xp: player.thievingXP,
            equipped_weapon: player.equippedWeapon.id || null,
            equipped_helm: player.equippedHelm.id || null,
            equipped_shield: player.equippedShield.id || null,
            inventory: JSON.stringify(inventoryData),
            quests: JSON.stringify(questsData),
            extra_data: extraData || null,
            updated_at: new Date().toISOString(),
        };

        // Upsert by supabase_user_id for authenticated players so we don't
        // create a new row every session. The unique partial index on
        // supabase_user_id (migration 006) makes this work.
        const { error } = await this.supabase
            .from('agentscape_players')
            .upsert(row, { onConflict: 'supabase_user_id' });

        if (error) {
            console.error('Failed to save player:', error);
            return false;
        }
        return true;
    }

    async loadPlayer(sessionId: string): Promise<any | null> {
        const { data, error } = await this.supabase
            .from('agentscape_players')
            .select('*')
            .eq('session_id', sessionId)
            .single();

        if (error || !data) return null;
        return data;
    }

    async logTransaction(event: {
        player_id: string;
        event_type: string;
        item_id?: string;
        quantity?: number;
        coins_delta?: number;
        details?: string;
    }): Promise<void> {
        await this.supabase.from('agentscape_transactions').insert({
            ...event,
            created_at: new Date().toISOString(),
        });
    }
}
