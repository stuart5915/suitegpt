// ============================================================
// AgentScape — Server-Authoritative Skilling System
// Ported from apps/runescape-game.html lines 1757-1825
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { ITEMS, BUILDINGS } from '../config';
import { InventorySystem } from './InventorySystem';

export interface SkillingEvent {
    type: 'harvest_complete' | 'train_complete' | 'started' | 'cooldown';
    playerId: string;
    message: string;
    xpGains?: { skill: string; amount: number }[];
}

export class SkillingSystem {
    private inventorySystem: InventorySystem;

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    startHarvest(player: PlayerSchema): SkillingEvent | null {
        if (player.isDead) return null;
        if (player.skillingAction || player.skillingCooldown > 0) {
            return { type: 'cooldown', playerId: player.sessionId, message: 'Please wait...' };
        }

        // Check if near farm
        const farm = BUILDINGS.find(b => b.id === 'farm');
        if (farm) {
            const dist = Math.abs(player.tileX - farm.x) + Math.abs(player.tileZ - farm.z);
            if (dist > 5) return { type: 'cooldown', playerId: player.sessionId, message: 'You need to be at the Farm!' };
        }

        player.skillingAction = { type: 'harvest', timer: 0, maxTime: 3 };
        player.state = 'skilling';
        return { type: 'started', playerId: player.sessionId, message: 'Harvesting...' };
    }

    startTraining(player: PlayerSchema): SkillingEvent | null {
        if (player.isDead) return null;
        if (player.skillingAction || player.skillingCooldown > 0) {
            return { type: 'cooldown', playerId: player.sessionId, message: 'Please wait...' };
        }

        // Check if near arena
        const arena = BUILDINGS.find(b => b.id === 'arena');
        if (arena) {
            const dist = Math.abs(player.tileX - arena.x) + Math.abs(player.tileZ - arena.z);
            if (dist > 5) return { type: 'cooldown', playerId: player.sessionId, message: 'You need to be at the Arena!' };
        }

        player.skillingAction = { type: 'train', timer: 0, maxTime: 5 };
        player.state = 'skilling';
        return { type: 'started', playerId: player.sessionId, message: 'Training on the dummy...' };
    }

    updateSkilling(player: PlayerSchema, dt: number): SkillingEvent | null {
        if (player.skillingCooldown > 0) player.skillingCooldown -= dt;

        if (!player.skillingAction) return null;

        player.skillingAction.timer += dt;

        if (player.skillingAction.timer >= player.skillingAction.maxTime) {
            const action = player.skillingAction;
            player.skillingAction = null;
            player.state = 'idle';

            if (action.type === 'harvest') {
                const foods = ['bread', 'raw_fish'];
                const item = foods[Math.floor(Math.random() * foods.length)];
                this.inventorySystem.addToInventory(player, item, 1);
                player.skillingCooldown = 10;
                return {
                    type: 'harvest_complete',
                    playerId: player.sessionId,
                    message: `You harvest some ${ITEMS[item].name}. ${ITEMS[item].icon}`,
                };
            }

            if (action.type === 'train') {
                const xpGains = [
                    { skill: 'attack', amount: 5 },
                    { skill: 'strength', amount: 5 },
                    { skill: 'defence', amount: 5 },
                ];
                xpGains.forEach(g => this.inventorySystem.gainXP(player, g.skill, g.amount));
                player.skillingCooldown = 5;
                return {
                    type: 'train_complete',
                    playerId: player.sessionId,
                    message: 'You hit the training dummy. +5 XP to combat skills.',
                    xpGains,
                };
            }
        }

        return null;
    }
}
