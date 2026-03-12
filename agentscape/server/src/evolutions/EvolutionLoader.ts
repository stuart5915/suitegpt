// ============================================================
// AgentScape — Evolution Loader
// Fetches daily evolutions from Supabase and provides game data
// ============================================================

import { createClient } from '@supabase/supabase-js';
import { MONSTERS, ZONES } from '../config';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export interface EvolutionMonster {
    id: string;
    name: string;
    icon: string;
    zone: string;
    level: number;
    hp: number;
    attack: number;
    strength: number;
    defence: number;
    xpReward: { attack: number; strength: number; hitpoints: number };
    drops: { id: string; weight: number; minQty: number; maxQty: number }[];
    coinDrop: { min: number; max: number };
    aggressive: boolean;
    respawnTime: number;
    spawnCount: number;
    color: string;
    description: string;
}

export interface BalanceTweak {
    target_id: string;
    stat: string;
    multiplier: number;
    direction: string;
    pct: number;
}

export interface WorldEvent {
    event_type: string; // xp_boost, spawn_surge, rare_drops, boss_enrage
    zone: string;
    multiplier: number;
    duration_hours: number;
}

export interface Evolution {
    id: string;
    day_number: number;
    type: 'new_monster' | 'balance_tweak' | 'world_event';
    title: string;
    description: string;
    data: any;
    active: boolean;
    created_at: string;
}

export interface LoadedEvolutions {
    monsters: EvolutionMonster[];
    balanceTweaks: BalanceTweak[];
    worldEvents: WorldEvent[];
    all: Evolution[];
}

export async function loadEvolutions(): Promise<LoadedEvolutions> {
    const result: LoadedEvolutions = { monsters: [], balanceTweaks: [], worldEvents: [], all: [] };

    if (!supabaseUrl || !supabaseKey) {
        console.log('[Evolution] No Supabase credentials, skipping evolution load');
        return result;
    }

    try {
        const sb = createClient(supabaseUrl, supabaseKey);
        const { data, error } = await sb
            .from('agentscape_evolutions')
            .select('*')
            .eq('active', true)
            .order('day_number', { ascending: true });

        if (error) {
            console.log('[Evolution] Failed to load:', error.message);
            return result;
        }

        if (!data || data.length === 0) {
            console.log('[Evolution] No active evolutions');
            return result;
        }

        result.all = data;

        for (const evo of data) {
            switch (evo.type) {
                case 'new_monster':
                    if (evo.data?.monster) result.monsters.push(evo.data.monster);
                    break;
                case 'balance_tweak':
                    if (evo.data?.target_id) result.balanceTweaks.push(evo.data);
                    break;
                case 'world_event':
                    if (evo.data?.event_type) result.worldEvents.push(evo.data);
                    break;
            }
        }

        console.log(`[Evolution] Loaded ${result.monsters.length} monsters, ${result.balanceTweaks.length} tweaks, ${result.worldEvents.length} events`);
        return result;
    } catch (err: any) {
        console.log('[Evolution] Error loading evolutions:', err.message);
        return result;
    }
}

// Generate spawn points for an evolution monster within its zone
export function generateEvoSpawns(monster: EvolutionMonster): { x: number; z: number }[] {
    const zone = ZONES[monster.zone];
    if (!zone) return [];

    const spawns: { x: number; z: number }[] = [];
    const bounds = zone.bounds;
    const margin = 3;

    for (let i = 0; i < monster.spawnCount; i++) {
        const x = Math.floor(bounds.x1 + margin + Math.random() * (bounds.x2 - bounds.x1 - margin * 2));
        const z = Math.floor(bounds.z1 + margin + Math.random() * (bounds.z2 - bounds.z1 - margin * 2));
        spawns.push({ x, z });
    }

    return spawns;
}

// Apply balance tweaks to the base MONSTERS config (mutates in place)
export function applyBalanceTweaks(tweaks: BalanceTweak[]): void {
    for (const tweak of tweaks) {
        const monster = MONSTERS[tweak.target_id];
        if (!monster) continue;

        const stat = tweak.stat as keyof typeof monster;
        if (stat === 'hp' || stat === 'attack' || stat === 'strength' || stat === 'defence') {
            const original = monster[stat] as number;
            (monster as any)[stat] = Math.round(original * tweak.multiplier);
            console.log(`[Evolution] ${monster.name}: ${stat} ${original} → ${(monster as any)[stat]}`);
        }
    }
}
