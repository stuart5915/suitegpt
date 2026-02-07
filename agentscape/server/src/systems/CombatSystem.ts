// ============================================================
// AgentScape — Server-Authoritative Combat System
// Ported from apps/runescape-game.html lines 1498-1620
// ============================================================

import { PlayerSchema, InventoryItem } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { GameState, LootPile } from '../schema/GameState';
import { COMBAT_TICK, SPEC_DAMAGE_MULT, SPEC_ENERGY_COST, RESPAWN_TIME, ITEMS, BUILDINGS } from '../config';
import { InventorySystem } from './InventorySystem';
import { QuestSystem } from './QuestSystem';

export interface HitsplatEvent {
    targetType: 'player' | 'npc' | 'monster';
    targetId: string;
    damage: number;
    isMiss: boolean;
    isSpec: boolean;
    x: number;
    z: number;
}

export interface DeathEvent {
    entityType: 'player' | 'npc';
    entityId: string;
    killerType: 'player' | 'npc';
    killerId: string;
}

export class CombatSystem {
    private inventorySystem: InventorySystem;
    private questSystem: QuestSystem;

    constructor(inventorySystem: InventorySystem, questSystem: QuestSystem) {
        this.inventorySystem = inventorySystem;
        this.questSystem = questSystem;
    }

    startCombat(player: PlayerSchema, npc: NPCSchema): boolean {
        if (npc.isDead || npc.inCombat || player.isDead) return false;

        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileZ - npc.tileZ);
        if (dist > 2) return false;

        player.combatTargetNpcId = npc.id;
        player.combatTimer = 0;
        player.state = 'combat';
        npc.inCombat = true;
        npc.combatPlayerId = player.sessionId;
        npc.state = 'IDLE';
        npc.path = [];

        // Face each other
        const angle = Math.atan2(npc.x - player.x, npc.z - player.z);
        player.rotation = angle;
        npc.rotation = angle + Math.PI;

        return true;
    }

    processCombatTick(
        player: PlayerSchema,
        npc: NPCSchema,
        dt: number,
        state: GameState,
    ): { hitsplats: HitsplatEvent[]; deaths: DeathEvent[]; xpGains: { skill: string; amount: number }[] } {
        const hitsplats: HitsplatEvent[] = [];
        const deaths: DeathEvent[] = [];
        const xpGains: { skill: string; amount: number }[] = [];

        if (!player.combatTargetNpcId || player.isDead || npc.isDead) return { hitsplats, deaths, xpGains };

        // Check distance
        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileZ - npc.tileZ);
        if (dist > 2) {
            this.disengageCombat(player, npc);
            return { hitsplats, deaths, xpGains };
        }

        player.combatTimer += dt;
        if (player.combatTimer < COMBAT_TICK) return { hitsplats, deaths, xpGains };
        player.combatTimer -= COMBAT_TICK;

        // === Player attacks NPC ===
        const weaponSlot = player.equippedWeaponSlot >= 0 ? player.inventory[player.equippedWeaponSlot] : null;
        const pAtk = player.attack + (weaponSlot ? weaponSlot.attackStat : 0);
        const pStr = player.strength + (weaponSlot ? weaponSlot.strengthStat : 0);
        const nDef = npc.combatStats.defence;

        const isSpec = player.specActive;
        player.specActive = false;

        if (isSpec || Math.random() * (pAtk + 1) > Math.random() * (nDef + 1)) {
            let dmg: number;
            if (isSpec) {
                dmg = Math.max(1, Math.floor((pStr + 1) * SPEC_DAMAGE_MULT));
                player.energy = Math.min(player.maxEnergy, player.energy + 5);
            } else {
                dmg = Math.max(1, Math.floor(Math.random() * (pStr + 1)));
            }
            npc.hp -= dmg;
            hitsplats.push({ targetType: 'npc', targetId: npc.id, damage: dmg, isMiss: false, isSpec, x: npc.x, z: npc.z });
        } else {
            hitsplats.push({ targetType: 'npc', targetId: npc.id, damage: 0, isMiss: true, isSpec: false, x: npc.x, z: npc.z });
        }

        // === NPC attacks Player ===
        const nAtk = npc.combatStats.attack;
        const nStr = npc.combatStats.strength;
        const helmSlot = player.equippedHelmSlot >= 0 ? player.inventory[player.equippedHelmSlot] : null;
        const shieldSlot = player.equippedShieldSlot >= 0 ? player.inventory[player.equippedShieldSlot] : null;
        const pDef = player.defence + (helmSlot ? helmSlot.defenceStat : 0) + (shieldSlot ? shieldSlot.defenceStat : 0);

        if (Math.random() * (nAtk + 1) > Math.random() * (pDef + 1)) {
            const dmg = Math.max(1, Math.floor(Math.random() * (nStr + 1)));
            player.hp -= dmg;
            hitsplats.push({ targetType: 'player', targetId: player.sessionId, damage: dmg, isMiss: false, isSpec: false, x: player.x, z: player.z });
        } else {
            hitsplats.push({ targetType: 'player', targetId: player.sessionId, damage: 0, isMiss: true, isSpec: false, x: player.x, z: player.z });
        }

        // === Check deaths ===
        if (npc.hp <= 0) {
            deaths.push({ entityType: 'npc', entityId: npc.id, killerType: 'player', killerId: player.sessionId });
            this.onNPCDeath(player, npc, state, xpGains);
        }

        if (player.hp <= 0) {
            deaths.push({ entityType: 'player', entityId: player.sessionId, killerType: 'npc', killerId: npc.id });
            this.onPlayerDeath(player, npc);
        }

        // === XP gain (while both alive) ===
        if (!npc.isDead && !player.isDead) {
            const cs = npc.combatStats;
            const enemyLvl = Math.floor((cs.attack + cs.strength + cs.defence) / 3) + 1;
            const xpGain = enemyLvl * 2;
            xpGains.push({ skill: 'attack', amount: xpGain });
            xpGains.push({ skill: 'strength', amount: xpGain });
            xpGains.push({ skill: 'hitpoints', amount: Math.ceil(xpGain * 0.7) });
        }

        return { hitsplats, deaths, xpGains };
    }

    private onNPCDeath(player: PlayerSchema, npc: NPCSchema, state: GameState, xpGains: { skill: string; amount: number }[]): void {
        npc.inCombat = false;
        npc.isDead = true;
        npc.respawnTimer = RESPAWN_TIME;
        npc.combatPlayerId = null;
        player.combatTargetNpcId = null;
        player.state = 'idle';

        // XP reward
        const cs = npc.combatStats;
        const enemyLvl = Math.floor((cs.attack + cs.strength + cs.defence) / 3) + 1;
        const xpReward = enemyLvl * 2;
        xpGains.push({ skill: 'attack', amount: xpReward });
        xpGains.push({ skill: 'strength', amount: xpReward });
        xpGains.push({ skill: 'hitpoints', amount: Math.ceil(xpReward * 0.7) });

        // Create loot pile
        const drops = npc.combatStats.drops || [];
        const lootItems: { id: string; qty: number }[] = [];
        drops.forEach(itemId => {
            const qty = itemId === 'coins' ? 5 + Math.floor(Math.random() * 20) : 1;
            lootItems.push({ id: itemId, qty });
        });

        if (lootItems.length > 0) {
            const lootId = `loot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const pile = new LootPile();
            pile.id = lootId;
            pile.x = npc.x;
            pile.z = npc.z;
            pile.timer = 60;
            pile.itemsJson = JSON.stringify(lootItems);
            state.lootPiles.set(lootId, pile);
        }

        // Quest progress
        this.questSystem.checkKill(player, npc.role, npc.x, npc.z);
    }

    private onPlayerDeath(player: PlayerSchema, npc: NPCSchema): void {
        player.isDead = true;
        player.state = 'dead';
        player.respawnTimer = 3;
        player.combatTargetNpcId = null;
        npc.inCombat = false;
        npc.combatPlayerId = null;

        // Lose food
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.type === 'food') {
                this.inventorySystem.clearSlot(player, i);
            }
        }
    }

    disengageCombat(player: PlayerSchema, npc: NPCSchema): void {
        player.combatTargetNpcId = null;
        player.state = 'idle';
        player.combatTimer = 0;
        npc.inCombat = false;
        npc.combatPlayerId = null;
    }

    useSpecialAttack(player: PlayerSchema): boolean {
        if (!player.combatTargetNpcId || player.isDead) return false;
        if (player.energy < SPEC_ENERGY_COST) return false;
        player.specActive = true;
        player.energy -= SPEC_ENERGY_COST;
        return true;
    }

    respawnPlayer(player: PlayerSchema, buildingDoors: Record<string, { x: number; z: number }>): void {
        player.isDead = false;
        player.hp = player.maxHp;
        player.state = 'idle';
        const th = buildingDoors['town_hall'];
        if (th) {
            player.tileX = th.x;
            player.tileZ = th.z;
            player.x = th.x;
            player.z = th.z;
        }
    }

    respawnNPC(npc: NPCSchema): void {
        npc.isDead = false;
        npc.hp = npc.combatStats.hp;
        npc.tileX = npc.spawnX;
        npc.tileZ = npc.spawnZ;
        npc.x = npc.spawnX;
        npc.z = npc.spawnZ;
        npc.state = 'IDLE';
        npc.stateTimer = 5;
        npc.inCombat = false;
        npc.combatPlayerId = null;
    }

    updateEnergyRegen(player: PlayerSchema, dt: number): void {
        player.energyRegenTimer += dt;
        if (player.energyRegenTimer >= COMBAT_TICK) {
            player.energyRegenTimer -= COMBAT_TICK;
            if (player.energy < player.maxEnergy) {
                player.energy = Math.min(player.maxEnergy, player.energy + 1);
            }
        }
    }
}
