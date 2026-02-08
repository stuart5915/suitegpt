// ============================================================
// AgentScape — Server-Authoritative Combat System
// Ported from apps/runescape-game.html lines 1498-1620
// ============================================================

import { PlayerSchema, InventoryItem } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { MonsterSchema } from '../schema/MonsterSchema';
import { GameState, LootPile } from '../schema/GameState';
import { COMBAT_TICK, SPEC_DAMAGE_MULT, SPEC_ENERGY_COST, RESPAWN_TIME, LOOT_DECAY_TIME, ITEMS, BUILDINGS, COMBAT_STYLES, CombatStyleDef, MONSTER_SPECIALS, MonsterSpecialDef } from '../config';
import { InventorySystem } from './InventorySystem';
import { QuestSystem } from './QuestSystem';
import type { MonsterBehaviorSystem } from './MonsterBehaviorSystem';

// Potion buff durations (in seconds)
const POTION_DURATION = 120; // 2 minutes

export interface PotionBuff {
    type: 'attack' | 'strength' | 'defence';
    boost: number; // flat stat boost
    remaining: number; // seconds left
}

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
    private monsterBehavior: MonsterBehaviorSystem | null = null;

    // Potion buffs: playerId → active buffs
    private potionBuffs: Map<string, PotionBuff[]> = new Map();

    constructor(inventorySystem: InventorySystem, questSystem: QuestSystem) {
        this.inventorySystem = inventorySystem;
        this.questSystem = questSystem;
    }

    /** Link to MonsterBehaviorSystem for threat tracking. Called once during room setup. */
    setMonsterBehavior(mbs: MonsterBehaviorSystem): void {
        this.monsterBehavior = mbs;
    }

    // --- Potion system ---

    /** Use a potion, applying a timed stat buff. Returns true if consumed. */
    usePotion(player: PlayerSchema, potionId: string): boolean {
        let type: 'attack' | 'strength' | 'defence';
        let boost: number;

        switch (potionId) {
            case 'attack_potion':       type = 'attack';   boost = 5 + Math.floor(player.attack * 0.15); break;
            case 'strength_potion':     type = 'strength';  boost = 5 + Math.floor(player.strength * 0.15); break;
            case 'defence_potion':      type = 'defence';   boost = 5 + Math.floor(player.defence * 0.15); break;
            case 'super_attack_potion': type = 'attack';   boost = 8 + Math.floor(player.attack * 0.25); break;
            case 'super_strength_potion': type = 'strength'; boost = 8 + Math.floor(player.strength * 0.25); break;
            case 'super_defence_potion': type = 'defence';  boost = 8 + Math.floor(player.defence * 0.25); break;
            default: return false;
        }

        if (!this.potionBuffs.has(player.sessionId)) {
            this.potionBuffs.set(player.sessionId, []);
        }
        const buffs = this.potionBuffs.get(player.sessionId)!;

        // Replace existing buff of same type (don't stack)
        const existing = buffs.findIndex(b => b.type === type);
        if (existing >= 0) buffs.splice(existing, 1);

        buffs.push({ type, boost, remaining: POTION_DURATION });
        return true;
    }

    /** Get total potion boost for a stat. */
    getPotionBoost(playerId: string, stat: 'attack' | 'strength' | 'defence'): number {
        const buffs = this.potionBuffs.get(playerId);
        if (!buffs) return 0;
        const buff = buffs.find(b => b.type === stat);
        return buff ? buff.boost : 0;
    }

    /** Tick down potion durations. Call once per second. */
    updatePotionBuffs(dt: number): void {
        this.potionBuffs.forEach((buffs, playerId) => {
            for (let i = buffs.length - 1; i >= 0; i--) {
                buffs[i].remaining -= dt;
                if (buffs[i].remaining <= 0) buffs.splice(i, 1);
            }
            if (buffs.length === 0) this.potionBuffs.delete(playerId);
        });
    }

    /** Clear all buffs for a player (on death). */
    clearBuffs(playerId: string): void {
        this.potionBuffs.delete(playerId);
        this.playerStyles.delete(playerId);
        this.poisonTimers.delete(playerId);
    }

    // --- Combat styles ---

    // Track player combat style: playerId → style ID
    private playerStyles: Map<string, string> = new Map();
    // Track poison: playerId → { damage per tick, ticks remaining }
    private poisonTimers: Map<string, { damage: number; ticks: number }> = new Map();

    /** Set a player's combat style. */
    setCombatStyle(playerId: string, styleId: string): boolean {
        if (!COMBAT_STYLES[styleId]) return false;
        this.playerStyles.set(playerId, styleId);
        return true;
    }

    /** Get a player's current combat style (default: controlled). */
    getPlayerStyle(playerId: string): CombatStyleDef {
        const styleId = this.playerStyles.get(playerId) || 'controlled';
        return COMBAT_STYLES[styleId];
    }

    /** Apply combat style bonuses to XP gains. Replaces flat XP with style-distributed XP. */
    private applyStyleXP(playerId: string, baseXP: number): { skill: string; amount: number }[] {
        const style = this.getPlayerStyle(playerId);
        const dist = style.xpDistribution;
        return [
            { skill: 'attack', amount: Math.ceil(baseXP * dist.attack) },
            { skill: 'strength', amount: Math.ceil(baseXP * dist.strength) },
            { skill: 'defence', amount: Math.ceil(baseXP * dist.defence) },
            { skill: 'hitpoints', amount: Math.ceil(baseXP * dist.hitpoints) },
        ];
    }

    // --- Poison system ---

    /** Apply poison to a player (from monster special). */
    applyPoison(playerId: string, damage: number, ticks: number): void {
        this.poisonTimers.set(playerId, { damage, ticks });
    }

    /** Tick poison for all poisoned players. Call once per combat tick. Returns hitsplats. */
    updatePoison(players: Map<string, PlayerSchema>): HitsplatEvent[] {
        const hitsplats: HitsplatEvent[] = [];
        this.poisonTimers.forEach((poison, playerId) => {
            const player = players.get(playerId);
            if (!player || player.isDead) {
                this.poisonTimers.delete(playerId);
                return;
            }
            player.hp = Math.max(0, player.hp - poison.damage);
            hitsplats.push({
                targetType: 'player', targetId: playerId,
                damage: poison.damage, isMiss: false, isSpec: false,
                x: player.x, z: player.z,
            });
            poison.ticks--;
            if (poison.ticks <= 0) this.poisonTimers.delete(playerId);
            if (player.hp <= 0) player.isDead = true;
        });
        return hitsplats;
    }

    // --- Monster special attacks ---

    /** Roll a monster's special attack. Returns extra hitsplat(s) if triggered. */
    rollMonsterSpecial(
        monster: MonsterSchema,
        player: PlayerSchema,
        baseDamage: number,
    ): HitsplatEvent[] {
        const special = MONSTER_SPECIALS[monster.monsterId];
        if (!special) return [];
        if (Math.random() * 100 >= special.chance) return [];

        const extras: HitsplatEvent[] = [];

        switch (special.type) {
            case 'double_hit': {
                // Second hit at 60-100% of base damage
                const bonusDmg = Math.max(1, Math.floor(baseDamage * (0.6 + Math.random() * 0.4)));
                player.hp = Math.max(0, player.hp - bonusDmg);
                extras.push({
                    targetType: 'player', targetId: player.sessionId,
                    damage: bonusDmg, isMiss: false, isSpec: true,
                    x: player.x, z: player.z,
                });
                break;
            }
            case 'poison': {
                this.applyPoison(player.sessionId, special.damage || 3, special.duration || 4);
                break;
            }
            case 'stun': {
                // Stun by adding to combat timer (skip next attack)
                player.combatTimer = -(special.duration || 1) * COMBAT_TICK;
                break;
            }
        }

        return extras;
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

        // === Player attacks NPC (with potion buffs) ===
        const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
        const pAtk = player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack');
        const pStr = player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength');
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

        // === NPC attacks Player (with potion buffs) ===
        const nAtk = npc.combatStats.attack;
        const nStr = npc.combatStats.strength;
        const helm = player.equippedHelm.id ? player.equippedHelm : null;
        const shield = player.equippedShield.id ? player.equippedShield : null;
        const pDef = player.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0) + this.getPotionBoost(player.sessionId, 'defence');

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

        // XP is only awarded on kill (in onNPCDeath), not per tick

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

        // Clear potion buffs on death
        this.clearBuffs(player.sessionId);
        // Clear all threat tables (player is dead)
        if (this.monsterBehavior) {
            this.monsterBehavior.removePlayerFromAllThreats(player.sessionId);
        }

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
        if ((!player.combatTargetNpcId && !player.combatTargetMonsterId) || player.isDead) return false;
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

    // ============================================================
    // Monster Combat — player vs MonsterSchema (PvM)
    // Can be called from the room as an alternative to inline logic.
    // Supports spec attacks and enrage multipliers.
    // ============================================================

    processMonsterCombatTick(
        player: PlayerSchema,
        monster: MonsterSchema,
        state: GameState,
    ): { hitsplats: HitsplatEvent[]; deaths: DeathEvent[]; xpGains: { skill: string; amount: number }[] } {
        const hitsplats: HitsplatEvent[] = [];
        const deaths: DeathEvent[] = [];
        const xpGains: { skill: string; amount: number }[] = [];

        if (player.isDead || monster.isDead) return { hitsplats, deaths, xpGains };

        // === Player attacks monster (with potion buffs + combat style) ===
        const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
        const style = this.getPlayerStyle(player.sessionId);
        const pAtk = player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack') + style.attackBonus;
        const pStr = player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength') + style.strengthBonus;
        const monDef = monster.combatStats.defence;

        const isSpec = player.specActive;
        player.specActive = false;

        if (isSpec || Math.random() * (pAtk + 5) > Math.random() * (monDef + 5)) {
            let dmg: number;
            const maxHit = Math.floor(pStr * 0.8 + 2);
            if (isSpec) {
                dmg = Math.max(1, Math.floor(maxHit * SPEC_DAMAGE_MULT));
                player.energy = Math.min(player.maxEnergy, player.energy + 5);
            } else {
                dmg = Math.floor(Math.random() * maxHit) + 1;
            }
            monster.hp = Math.max(0, monster.hp - dmg);
            hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: dmg, isMiss: false, isSpec, x: monster.x, z: monster.z });

            // Report threat to MonsterBehaviorSystem (damage = threat)
            if (this.monsterBehavior) {
                this.monsterBehavior.addThreat(monster.id, player.sessionId, dmg);
            }
        } else {
            hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: 0, isMiss: true, isSpec: false, x: monster.x, z: monster.z });
            // Even misses generate some threat (you're still fighting it)
            if (this.monsterBehavior) {
                this.monsterBehavior.addThreat(monster.id, player.sessionId, 1);
            }
        }

        // === Check monster death ===
        if (monster.hp <= 0) {
            deaths.push({ entityType: 'npc', entityId: monster.id, killerType: 'player', killerId: player.sessionId });
            this.onMonsterDeath(player, monster, state, xpGains);
            return { hitsplats, deaths, xpGains };
        }

        // === Monster attacks player (apply enrage multiplier, potion buffs, style) ===
        const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
        const monStr = monster.combatStats.strength * monster.enrageMultiplier;
        const helm = player.equippedHelm.id ? player.equippedHelm : null;
        const shield = player.equippedShield.id ? player.equippedShield : null;
        const pDef = player.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0) + this.getPotionBoost(player.sessionId, 'defence') + style.defenceBonus;

        if (Math.random() * (monAtk + 5) > Math.random() * (pDef + 5)) {
            const maxHit = Math.floor(monStr * 0.8 + 2);
            const dmg = Math.floor(Math.random() * maxHit) + 1;
            player.hp = Math.max(0, player.hp - dmg);
            hitsplats.push({ targetType: 'player', targetId: player.sessionId, damage: dmg, isMiss: false, isSpec: false, x: player.x, z: player.z });

            // Roll monster special attack (non-boss only, bosses use abilities)
            if (!monster.isBoss) {
                const specials = this.rollMonsterSpecial(monster, player, dmg);
                hitsplats.push(...specials);
            }
        } else {
            hitsplats.push({ targetType: 'player', targetId: player.sessionId, damage: 0, isMiss: true, isSpec: false, x: player.x, z: player.z });
        }

        // === Check player death ===
        if (player.hp <= 0) {
            deaths.push({ entityType: 'player', entityId: player.sessionId, killerType: 'npc', killerId: monster.id });
            this.onPlayerDeathByMonster(player, monster);
        }

        return { hitsplats, deaths, xpGains };
    }

    private onMonsterDeath(
        player: PlayerSchema,
        monster: MonsterSchema,
        state: GameState,
        xpGains: { skill: string; amount: number }[],
    ): void {
        monster.isDead = true;
        monster.inCombat = false;
        monster.combatPlayerId = null;
        monster.respawnTimer = monster.respawnTime;
        monster.state = 'DEAD';
        player.combatTargetMonsterId = null;
        player.state = 'idle';

        // Clear threat table for this monster
        if (this.monsterBehavior) {
            this.monsterBehavior.clearThreat(monster.id);
        }

        // XP reward (only on kill) — distributed by combat style
        const xp = monster.combatStats.xpReward;
        const totalBaseXP = xp.attack + xp.strength + xp.hitpoints;
        const styledXP = this.applyStyleXP(player.sessionId, totalBaseXP);
        xpGains.push(...styledXP);

        // Create weighted loot pile
        this.createMonsterLoot(monster, state);

        // Quest progress
        this.questSystem.checkMonsterKill(player, monster.monsterId, monster.isBoss);
    }

    private onPlayerDeathByMonster(player: PlayerSchema, monster: MonsterSchema): void {
        player.isDead = true;
        player.state = 'dead';
        player.respawnTimer = 10;
        player.combatTargetMonsterId = null;

        // Clear potion buffs on death
        this.clearBuffs(player.sessionId);

        // Remove from threat table
        if (this.monsterBehavior) {
            this.monsterBehavior.removeThreat(monster.id, player.sessionId);
            // If no one else is fighting, monster leashes
            const engaged = this.monsterBehavior.getEngagedPlayers(monster.id, new Map() as any);
            if (engaged.length === 0) {
                monster.inCombat = false;
                monster.combatPlayerId = null;
                monster.state = 'LEASHING';
            } else {
                // Switch to next highest-threat player
                monster.combatPlayerId = engaged[0].sessionId;
            }
        } else {
            monster.inCombat = false;
            monster.combatPlayerId = null;
            monster.state = 'LEASHING';
        }

        // Lose food on death
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.type === 'food') {
                this.inventorySystem.clearSlot(player, i);
            }
        }
    }

    private createMonsterLoot(monster: MonsterSchema, state: GameState): void {
        const lootItems: { id: string; qty: number }[] = [];

        // Roll coin drop
        const coinDrop = monster.combatStats.coinDrop;
        const coins = Math.floor(coinDrop.min + Math.random() * (coinDrop.max - coinDrop.min));
        if (coins > 0) lootItems.push({ id: 'coins', qty: coins });

        // Roll each drop independently using weight as % chance
        for (const drop of monster.combatStats.drops) {
            if (Math.random() * 100 < drop.weight) {
                const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
                lootItems.push({ id: drop.id, qty });
            }
        }

        // Always drop bones
        lootItems.push({ id: 'bones', qty: 1 });

        if (lootItems.length === 0) return;

        const lootId = `loot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const pile = new LootPile();
        pile.id = lootId;
        pile.x = monster.x;
        pile.z = monster.z;
        pile.timer = LOOT_DECAY_TIME;
        pile.itemsJson = JSON.stringify(lootItems);
        state.lootPiles.set(lootId, pile);
    }

    // ============================================================
    // Boss Raid Combat — multiple players vs one boss
    // Processes ALL engaged players' attacks and boss retaliates
    // against highest-threat target. Call instead of processMonsterCombatTick
    // when monster.isBoss && multiple players engaged.
    // ============================================================

    processBossRaidTick(
        engagedPlayers: PlayerSchema[],
        monster: MonsterSchema,
        state: GameState,
    ): { hitsplats: HitsplatEvent[]; deaths: DeathEvent[]; xpGains: { skill: string; amount: number }[] } {
        const hitsplats: HitsplatEvent[] = [];
        const deaths: DeathEvent[] = [];
        const xpGains: { skill: string; amount: number }[] = [];

        if (monster.isDead) return { hitsplats, deaths, xpGains };

        // === Each player attacks the boss ===
        for (const player of engagedPlayers) {
            if (player.isDead) continue;

            const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
            const pAtk = player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack');
            const pStr = player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength');
            const monDef = monster.combatStats.defence;
            // Apply phase defence multiplier
            const phaseDefMult = this.monsterBehavior?.getBossPhaseMultipliers(monster).defence ?? 1;
            const effectiveMonDef = monDef * phaseDefMult;

            const isSpec = player.specActive;
            player.specActive = false;

            if (isSpec || Math.random() * (pAtk + 5) > Math.random() * (effectiveMonDef + 5)) {
                let dmg: number;
                const maxHit = Math.floor(pStr * 0.8 + 2);
                if (isSpec) {
                    dmg = Math.max(1, Math.floor(maxHit * SPEC_DAMAGE_MULT));
                    player.energy = Math.min(player.maxEnergy, player.energy + 5);
                } else {
                    dmg = Math.floor(Math.random() * maxHit) + 1;
                }
                monster.hp = Math.max(0, monster.hp - dmg);
                hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: dmg, isMiss: false, isSpec, x: monster.x, z: monster.z });

                if (this.monsterBehavior) {
                    this.monsterBehavior.addThreat(monster.id, player.sessionId, dmg);
                }
            } else {
                hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: 0, isMiss: true, isSpec: false, x: monster.x, z: monster.z });
                if (this.monsterBehavior) {
                    this.monsterBehavior.addThreat(monster.id, player.sessionId, 1);
                }
            }

            // Check boss death after each player's attack
            if (monster.hp <= 0) {
                deaths.push({ entityType: 'npc', entityId: monster.id, killerType: 'player', killerId: player.sessionId });
                // All engaged players get XP
                for (const p of engagedPlayers) {
                    if (!p.isDead) {
                        const xp = monster.combatStats.xpReward;
                        xpGains.push({ skill: 'attack', amount: xp.attack });
                        xpGains.push({ skill: 'strength', amount: xp.strength });
                        xpGains.push({ skill: 'hitpoints', amount: xp.hitpoints });
                        if (p.equippedShield.id) {
                            xpGains.push({ skill: 'defence', amount: Math.ceil(xp.attack * 0.5) });
                        }
                        p.combatTargetMonsterId = null;
                        p.state = 'idle';
                    }
                }
                monster.isDead = true;
                monster.inCombat = false;
                monster.combatPlayerId = null;
                monster.respawnTimer = monster.respawnTime;
                monster.state = 'DEAD';
                this.createMonsterLoot(monster, state);
                if (this.monsterBehavior) {
                    this.monsterBehavior.clearThreat(monster.id);
                    this.monsterBehavior.resetBossPhase(monster.id);
                }
                // Quest credit to killer
                this.questSystem.checkMonsterKill(player, monster.monsterId, monster.isBoss);
                return { hitsplats, deaths, xpGains };
            }
        }

        // === Boss attacks highest-threat player ===
        const target = this.monsterBehavior?.getTopThreatPlayer(monster.id, state.players as any) ?? engagedPlayers[0];
        if (target && !target.isDead) {
            const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
            const monStr = monster.combatStats.strength * monster.enrageMultiplier;
            const helm = target.equippedHelm.id ? target.equippedHelm : null;
            const shield = target.equippedShield.id ? target.equippedShield : null;
            const pDef = target.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0) + this.getPotionBoost(target.sessionId, 'defence');

            if (Math.random() * (monAtk + 5) > Math.random() * (pDef + 5)) {
                const maxHit = Math.floor(monStr * 0.8 + 2);
                const dmg = Math.floor(Math.random() * maxHit) + 1;
                target.hp = Math.max(0, target.hp - dmg);
                hitsplats.push({ targetType: 'player', targetId: target.sessionId, damage: dmg, isMiss: false, isSpec: false, x: target.x, z: target.z });
            } else {
                hitsplats.push({ targetType: 'player', targetId: target.sessionId, damage: 0, isMiss: true, isSpec: false, x: target.x, z: target.z });
            }

            if (target.hp <= 0) {
                deaths.push({ entityType: 'player', entityId: target.sessionId, killerType: 'npc', killerId: monster.id });
                this.onPlayerDeathByMonster(target, monster);
            }
        }

        return { hitsplats, deaths, xpGains };
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
