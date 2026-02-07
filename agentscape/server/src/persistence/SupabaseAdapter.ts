// ============================================================
// AgentScape — Supabase Persistence Adapter
// Shares the same Supabase instance as suitegpt.app
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PlayerSchema } from '../schema/PlayerSchema';

export class SupabaseAdapter {
    private supabase: SupabaseClient;

    constructor() {
        const url = process.env.SUPABASE_URL || 'https://kyojtmbjsfkfrdvulbyg.supabase.co';
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

    async savePlayer(player: PlayerSchema): Promise<boolean> {
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
            equipped_weapon_slot: player.equippedWeaponSlot,
            equipped_helm_slot: player.equippedHelmSlot,
            equipped_shield_slot: player.equippedShieldSlot,
            inventory: JSON.stringify(inventoryData),
            quests: JSON.stringify(questsData),
            updated_at: new Date().toISOString(),
        };

        const { error } = await this.supabase
            .from('agentscape_players')
            .upsert(row, { onConflict: 'session_id' });

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
