// ============================================================
// AgentScape — Server-Authoritative Combat System
// Ported from apps/runescape-game.html lines 1498-1620
// ============================================================

import { PlayerSchema, InventoryItem } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { MonsterSchema } from '../schema/MonsterSchema';
import { GameState, LootPile } from '../schema/GameState';
import { COMBAT_TICK, SPEC_DAMAGE_MULT, SPEC_ENERGY_COST, RESPAWN_TIME, LOOT_DECAY_TIME, ITEMS, BUILDINGS, COMBAT_STYLES, CombatStyleDef, MONSTER_SPECIALS, MonsterSpecialDef, PRAYERS, PrayerDef, getSetBonus, BONES_XP, maxPrayerPoints, BOSSES, getWeaponTierMult, calculateCombatLevel, getRandomSlayerTask, SlayerTaskDef } from '../config';
import { InventorySystem } from './InventorySystem';
import { QuestSystem } from './QuestSystem';
import type { MonsterBehaviorSystem } from './MonsterBehaviorSystem';

// Potion buff durations (in seconds)
const POTION_DURATION = 120; // 2 minutes
const ANTIPOISON_IMMUNITY = 90; // 90 seconds immunity after drinking antipoison
const FOOD_COOLDOWN = 3; // 3 combat ticks between eating
const GRAVE_DURATION = 60; // seconds before grave becomes public
const FLEE_DELAY = 3; // seconds of vulnerability while fleeing
const HP_REGEN_INTERVAL = 5; // seconds between HP regen ticks
const HP_REGEN_COMBAT_DELAY = 10; // seconds after combat ends before regen starts

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
        this.antipoisonImmunity.delete(playerId);
        this.foodCooldowns.delete(playerId);
        this.fleeTimers.delete(playerId);
    }

    // --- Combat styles ---

    // Track player combat style: playerId → style ID
    private playerStyles: Map<string, string> = new Map();
    // Track poison: playerId → { damage per tick, ticks remaining }
    private poisonTimers: Map<string, { damage: number; ticks: number }> = new Map();
    // Antipoison immunity: playerId → seconds remaining
    private antipoisonImmunity: Map<string, number> = new Map();
    // Food cooldown: playerId → seconds until can eat again
    private foodCooldowns: Map<string, number> = new Map();
    // Flee timers: playerId → { seconds remaining, monsterId or npcId }
    private fleeTimers: Map<string, { remaining: number; targetType: 'npc' | 'monster'; targetId: string }> = new Map();
    // Slayer tasks: playerId → { task, killsRemaining }
    private slayerTasks: Map<string, { task: SlayerTaskDef; killsRemaining: number }> = new Map();
    // HP regen tracking: playerId → { lastCombatTime (epoch ms), regenTimer }
    private hpRegenTimers: Map<string, { lastCombatTime: number; regenTimer: number }> = new Map();

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

    /** Apply poison to a player (from monster special). Blocked by antipoison immunity. */
    applyPoison(playerId: string, damage: number, ticks: number): void {
        // Antipoison immunity blocks new poison
        if ((this.antipoisonImmunity.get(playerId) || 0) > 0) return;
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
            // Antivirus amulet halves poison damage
            let dmg = poison.damage;
            if (player.equippedHelm.id === 'antivirus_amulet' || player.equippedShield.id === 'antivirus_amulet') {
                dmg = Math.max(1, Math.floor(dmg * 0.5));
            }
            player.hp = Math.max(0, player.hp - dmg);
            hitsplats.push({
                targetType: 'player', targetId: playerId,
                damage: dmg, isMiss: false, isSpec: false,
                x: player.x, z: player.z,
            });
            poison.ticks--;
            if (poison.ticks <= 0) this.poisonTimers.delete(playerId);
            if (player.hp <= 0) player.isDead = true;
        });
        return hitsplats;
    }

    /** Tick antipoison immunity timers and food cooldowns. Call once per second (same as updatePotionBuffs). */
    updateTimers(dt: number): void {
        this.antipoisonImmunity.forEach((remaining, playerId) => {
            const newVal = remaining - dt;
            if (newVal <= 0) this.antipoisonImmunity.delete(playerId);
            else this.antipoisonImmunity.set(playerId, newVal);
        });
        this.foodCooldowns.forEach((remaining, playerId) => {
            const newVal = remaining - dt;
            if (newVal <= 0) this.foodCooldowns.delete(playerId);
            else this.foodCooldowns.set(playerId, newVal);
        });
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

    // --- Prayer system ---

    // Active prayers per player: playerId → set of active prayer IDs
    private activePrayers: Map<string, Set<string>> = new Map();
    // Prayer points per player: playerId → current points
    private prayerPoints: Map<string, number> = new Map();

    /** Activate a prayer. Returns false if level too low or already active. */
    activatePrayer(playerId: string, prayerId: string, prayerLevel: number): boolean {
        const prayer = PRAYERS[prayerId];
        if (!prayer) return false;
        if (prayerLevel < prayer.levelReq) return false;

        const points = this.prayerPoints.get(playerId) || 0;
        if (points <= 0) return false;

        if (!this.activePrayers.has(playerId)) {
            this.activePrayers.set(playerId, new Set());
        }
        const active = this.activePrayers.get(playerId)!;

        // Deactivate conflicting prayers of the same type
        // (can't have two protection prayers, or two attack boosts)
        if (prayer.type === 'protection') {
            active.forEach(id => { if (PRAYERS[id]?.type === 'protection') active.delete(id); });
        }

        active.add(prayerId);
        return true;
    }

    /** Deactivate a prayer. */
    deactivatePrayer(playerId: string, prayerId: string): void {
        this.activePrayers.get(playerId)?.delete(prayerId);
    }

    /** Deactivate all prayers for a player. */
    deactivateAllPrayers(playerId: string): void {
        this.activePrayers.delete(playerId);
    }

    /** Set prayer points (called on login/restore). */
    setPrayerPoints(playerId: string, points: number): void {
        this.prayerPoints.set(playerId, points);
    }

    /** Get current prayer points. */
    getPrayerPoints(playerId: string): number {
        return this.prayerPoints.get(playerId) || 0;
    }

    /** Drain prayer points for active prayers. Call once per combat tick. */
    drainPrayer(playerId: string): void {
        const active = this.activePrayers.get(playerId);
        if (!active || active.size === 0) return;

        let totalDrain = 0;
        active.forEach(id => {
            const prayer = PRAYERS[id];
            if (prayer) totalDrain += prayer.drainRate;
        });

        const current = this.prayerPoints.get(playerId) || 0;
        const newPoints = Math.max(0, current - totalDrain);
        this.prayerPoints.set(playerId, newPoints);

        // Deactivate all prayers when out of points
        if (newPoints <= 0) {
            this.deactivateAllPrayers(playerId);
        }
    }

    /** Get combined prayer effects for a player. */
    getPrayerEffects(playerId: string): {
        damageReduction: number;
        attackBoost: number;
        strengthBoost: number;
        defenceBoost: number;
        attackMultiplier: number;
        strengthMultiplier: number;
    } {
        const result = {
            damageReduction: 0,
            attackBoost: 0, strengthBoost: 0, defenceBoost: 0,
            attackMultiplier: 1, strengthMultiplier: 1,
        };

        const active = this.activePrayers.get(playerId);
        if (!active) return result;

        active.forEach(id => {
            const prayer = PRAYERS[id];
            if (!prayer) return;
            const e = prayer.effects;
            if (e.damageReduction) result.damageReduction = Math.max(result.damageReduction, e.damageReduction);
            if (e.attackBoost) result.attackBoost += e.attackBoost;
            if (e.strengthBoost) result.strengthBoost += e.strengthBoost;
            if (e.defenceBoost) result.defenceBoost += e.defenceBoost;
            if (e.attackMultiplier) result.attackMultiplier = Math.max(result.attackMultiplier, e.attackMultiplier);
            if (e.strengthMultiplier) result.strengthMultiplier = Math.max(result.strengthMultiplier, e.strengthMultiplier);
        });

        return result;
    }

    // --- Equipment set bonuses ---

    /** Get set bonus for a player's current equipment. */
    getPlayerSetBonus(player: PlayerSchema): { attack: number; strength: number; defence: number } {
        const weaponTier = player.equippedWeapon.id ? (ITEMS[player.equippedWeapon.id]?.tier) : undefined;
        const helmTier = player.equippedHelm.id ? (ITEMS[player.equippedHelm.id]?.tier) : undefined;
        const shieldTier = player.equippedShield.id ? (ITEMS[player.equippedShield.id]?.tier) : undefined;
        const bonus = getSetBonus(weaponTier, helmTier, shieldTier);
        if (!bonus) return { attack: 0, strength: 0, defence: 0 };
        return { attack: bonus.attackBonus, strength: bonus.strengthBonus, defence: bonus.defenceBonus };
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

        // Mark player as in combat for HP regen tracking
        this.markInCombat(player.sessionId);

        // === Player attacks NPC (potions + style + prayer + set bonus + weapon tier) ===
        const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
        const weaponMult = getWeaponTierMult(player.equippedWeapon.id || undefined);
        const style = this.getPlayerStyle(player.sessionId);
        const prayer = this.getPrayerEffects(player.sessionId);
        const setBonus = this.getPlayerSetBonus(player);
        const pAtk = Math.floor(
            (player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack') + style.attackBonus + prayer.attackBoost + setBonus.attack)
            * prayer.attackMultiplier
        );
        const pStr = Math.floor(
            (player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength') + style.strengthBonus + prayer.strengthBoost + setBonus.strength)
            * prayer.strengthMultiplier
        );
        const nDef = npc.combatStats.defence;

        const isSpec = player.specActive;
        player.specActive = false;

        if (isSpec || Math.random() * (pAtk + 1) > Math.random() * (nDef + 1)) {
            let dmg: number;
            if (isSpec) {
                dmg = Math.max(1, Math.floor((pStr + 1) * weaponMult * SPEC_DAMAGE_MULT));
                player.energy = Math.min(player.maxEnergy, player.energy + 5);
            } else {
                dmg = Math.max(1, Math.floor(Math.random() * (pStr + 1) * weaponMult));
            }
            npc.hp -= dmg;
            hitsplats.push({ targetType: 'npc', targetId: npc.id, damage: dmg, isMiss: false, isSpec, x: npc.x, z: npc.z });
        } else {
            hitsplats.push({ targetType: 'npc', targetId: npc.id, damage: 0, isMiss: true, isSpec: false, x: npc.x, z: npc.z });
        }

        // === NPC attacks Player (potions + style + prayer + set bonus) ===
        const nAtk = npc.combatStats.attack;
        const nStr = npc.combatStats.strength;
        const helm = player.equippedHelm.id ? player.equippedHelm : null;
        const shield = player.equippedShield.id ? player.equippedShield : null;
        const pDef = player.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0) + this.getPotionBoost(player.sessionId, 'defence') + style.defenceBonus + prayer.defenceBoost + setBonus.defence;

        if (Math.random() * (nAtk + 1) > Math.random() * (pDef + 1)) {
            let dmg = Math.max(1, Math.floor(Math.random() * (nStr + 1)));
            // Apply prayer damage reduction
            if (prayer.damageReduction > 0) {
                dmg = Math.max(1, Math.floor(dmg * (1 - prayer.damageReduction)));
            }
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
            this.onPlayerDeath(player, npc, state);
        }

        // Drain prayer points per combat tick
        this.drainPrayer(player.sessionId);

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

        // XP reward — distributed by combat style
        const cs = npc.combatStats;
        const enemyLvl = Math.floor((cs.attack + cs.strength + cs.defence) / 3) + 1;
        const baseXP = enemyLvl * 4; // total XP pool, distributed by style
        const styledXP = this.applyStyleXP(player.sessionId, baseXP);
        xpGains.push(...styledXP);

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

    private onPlayerDeath(player: PlayerSchema, npc: NPCSchema, state?: GameState): void {
        player.isDead = true;
        player.state = 'dead';
        player.respawnTimer = 3;
        player.combatTargetNpcId = null;
        npc.inCombat = false;
        npc.combatPlayerId = null;

        // Clear potion buffs and prayers on death
        this.clearBuffs(player.sessionId);
        this.deactivateAllPrayers(player.sessionId);
        // Clear all threat tables (player is dead)
        if (this.monsterBehavior) {
            this.monsterBehavior.removePlayerFromAllThreats(player.sessionId);
        }

        // Create grave with all inventory items
        if (state) {
            this.createGrave(player, state);
        } else {
            // Fallback: just lose food (if state not available)
            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                if (item && item.type === 'food') {
                    this.inventorySystem.clearSlot(player, i);
                }
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

        // Mark player as in combat for HP regen tracking
        this.markInCombat(player.sessionId);

        // === Player attacks monster (potions + style + prayer + set bonus + weapon tier) ===
        const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
        const weaponMult = getWeaponTierMult(player.equippedWeapon.id || undefined);
        const style = this.getPlayerStyle(player.sessionId);
        const prayer = this.getPrayerEffects(player.sessionId);
        const setBonus = this.getPlayerSetBonus(player);
        const pAtk = Math.floor(
            (player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack') + style.attackBonus + prayer.attackBoost + setBonus.attack)
            * prayer.attackMultiplier
        );
        const pStr = Math.floor(
            (player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength') + style.strengthBonus + prayer.strengthBoost + setBonus.strength)
            * prayer.strengthMultiplier
        );
        const monDef = monster.combatStats.defence;

        const isSpec = player.specActive;
        player.specActive = false;

        if (isSpec || Math.random() * (pAtk + 5) > Math.random() * (monDef + 5)) {
            let dmg: number;
            const maxHit = Math.floor((pStr * 0.8 + 2) * weaponMult);
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

        // === Monster attacks player (enrage + potions + style + prayer + set bonus) ===
        const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
        const monStr = monster.combatStats.strength * monster.enrageMultiplier;
        const helm = player.equippedHelm.id ? player.equippedHelm : null;
        const shield = player.equippedShield.id ? player.equippedShield : null;
        const pDef = player.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0) + this.getPotionBoost(player.sessionId, 'defence') + style.defenceBonus + prayer.defenceBoost + setBonus.defence;

        if (Math.random() * (monAtk + 5) > Math.random() * (pDef + 5)) {
            const maxHit = Math.floor(monStr * 0.8 + 2);
            let dmg = Math.floor(Math.random() * maxHit) + 1;
            // Apply prayer damage reduction
            if (prayer.damageReduction > 0) {
                dmg = Math.max(1, Math.floor(dmg * (1 - prayer.damageReduction)));
            }
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
            this.onPlayerDeathByMonster(player, monster, state);
        }

        // Drain prayer points per combat tick
        this.drainPrayer(player.sessionId);

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

        // Slayer task progress
        const slayerReward = this.checkSlayerKill(player.sessionId, monster.monsterId);
        if (slayerReward) {
            xpGains.push({ skill: 'slayer', amount: slayerReward.slayerXP });
            // Bonus combat XP distributed by style
            const bonusXP = this.applyStyleXP(player.sessionId, slayerReward.combatXP);
            xpGains.push(...bonusXP);
            // Coin reward added directly to player
            player.coins += slayerReward.coins;
        }
    }

    private onPlayerDeathByMonster(player: PlayerSchema, monster: MonsterSchema, state?: GameState): void {
        player.isDead = true;
        player.state = 'dead';
        player.respawnTimer = 10;
        player.combatTargetMonsterId = null;

        // Clear potion buffs and prayers on death
        this.clearBuffs(player.sessionId);
        this.deactivateAllPrayers(player.sessionId);

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

        // Create grave with all inventory items
        if (state) {
            this.createGrave(player, state);
        } else {
            // Fallback: just lose food
            for (let i = 0; i < player.inventory.length; i++) {
                const item = player.inventory[i];
                if (item && item.type === 'food') {
                    this.inventorySystem.clearSlot(player, i);
                }
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

        // Always drop bones (type depends on monster)
        lootItems.push({ id: this.getMonsterBoneType(monster), qty: 1 });

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

    /**
     * Boss raid loot: top damage dealer gets rare item drops,
     * all engaged players get a split of coin drops and bones.
     */
    private createBossRaidLoot(
        monster: MonsterSchema,
        state: GameState,
        engagedPlayers: PlayerSchema[],
        damageDealt: Map<string, number>,
    ): void {
        // Find top damage dealer
        let topDamageId: string | null = null;
        let topDamage = 0;
        damageDealt.forEach((dmg, playerId) => {
            if (dmg > topDamage) {
                topDamage = dmg;
                topDamageId = playerId;
            }
        });

        // Roll rare item drops — only top damage dealer gets these
        const rareItems: { id: string; qty: number }[] = [];
        for (const drop of monster.combatStats.drops) {
            if (Math.random() * 100 < drop.weight) {
                const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
                rareItems.push({ id: drop.id, qty });
            }
        }

        // Coin drop split evenly among living players
        const coinDrop = monster.combatStats.coinDrop;
        const totalCoins = Math.floor(coinDrop.min + Math.random() * (coinDrop.max - coinDrop.min));
        const alivePlayers = engagedPlayers.filter(p => !p.isDead);
        const coinsPerPlayer = alivePlayers.length > 0 ? Math.floor(totalCoins / alivePlayers.length) : totalCoins;

        // Create individual loot piles for each player
        for (const player of alivePlayers) {
            const items: { id: string; qty: number }[] = [];

            // Everyone gets their share of coins
            if (coinsPerPlayer > 0) items.push({ id: 'coins', qty: coinsPerPlayer });

            // Everyone gets bones (type depends on boss)
            items.push({ id: this.getMonsterBoneType(monster), qty: 1 });

            // Top damage dealer gets the rare drops
            if (player.sessionId === topDamageId && rareItems.length > 0) {
                items.push(...rareItems);
            }

            if (items.length > 0) {
                const lootId = `loot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const pile = new LootPile();
                pile.id = lootId;
                pile.x = monster.x + (Math.random() - 0.5) * 2; // spread piles slightly
                pile.z = monster.z + (Math.random() - 0.5) * 2;
                pile.timer = LOOT_DECAY_TIME;
                pile.itemsJson = JSON.stringify(items);
                state.lootPiles.set(lootId, pile);
            }
        }
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

        // Track damage per player for loot sharing
        const damageDealt: Map<string, number> = new Map();

        // === Each player attacks the boss (potions + style + prayer + set bonus + weapon tier) ===
        for (const player of engagedPlayers) {
            if (player.isDead) continue;

            this.markInCombat(player.sessionId);
            const weapon = player.equippedWeapon.id ? player.equippedWeapon : null;
            const weaponMult = getWeaponTierMult(player.equippedWeapon.id || undefined);
            const style = this.getPlayerStyle(player.sessionId);
            const prayer = this.getPrayerEffects(player.sessionId);
            const setBonus = this.getPlayerSetBonus(player);
            const pAtk = Math.floor(
                (player.attack + (weapon ? weapon.attackStat : 0) + this.getPotionBoost(player.sessionId, 'attack') + style.attackBonus + prayer.attackBoost + setBonus.attack)
                * prayer.attackMultiplier
            );
            const pStr = Math.floor(
                (player.strength + (weapon ? weapon.strengthStat : 0) + this.getPotionBoost(player.sessionId, 'strength') + style.strengthBonus + prayer.strengthBoost + setBonus.strength)
                * prayer.strengthMultiplier
            );
            const monDef = monster.combatStats.defence;
            // Apply phase defence multiplier
            const phaseDefMult = this.monsterBehavior?.getBossPhaseMultipliers(monster).defence ?? 1;
            const effectiveMonDef = monDef * phaseDefMult;

            const isSpec = player.specActive;
            player.specActive = false;

            if (isSpec || Math.random() * (pAtk + 5) > Math.random() * (effectiveMonDef + 5)) {
                let dmg: number;
                const maxHit = Math.floor((pStr * 0.8 + 2) * weaponMult);
                if (isSpec) {
                    dmg = Math.max(1, Math.floor(maxHit * SPEC_DAMAGE_MULT));
                    player.energy = Math.min(player.maxEnergy, player.energy + 5);
                } else {
                    dmg = Math.floor(Math.random() * maxHit) + 1;
                }
                monster.hp = Math.max(0, monster.hp - dmg);
                hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: dmg, isMiss: false, isSpec, x: monster.x, z: monster.z });

                damageDealt.set(player.sessionId, (damageDealt.get(player.sessionId) || 0) + dmg);
                if (this.monsterBehavior) {
                    this.monsterBehavior.addThreat(monster.id, player.sessionId, dmg);
                }
            } else {
                hitsplats.push({ targetType: 'monster', targetId: monster.id, damage: 0, isMiss: true, isSpec: false, x: monster.x, z: monster.z });
                if (this.monsterBehavior) {
                    this.monsterBehavior.addThreat(monster.id, player.sessionId, 1);
                }
            }

            // Drain prayer each combat tick
            this.drainPrayer(player.sessionId);

            // Check boss death after each player's attack
            if (monster.hp <= 0) {
                deaths.push({ entityType: 'npc', entityId: monster.id, killerType: 'player', killerId: player.sessionId });
                // All engaged players get XP — distributed by combat style
                const xp = monster.combatStats.xpReward;
                const totalBaseXP = xp.attack + xp.strength + xp.hitpoints;
                for (const p of engagedPlayers) {
                    if (!p.isDead) {
                        const styledXP = this.applyStyleXP(p.sessionId, totalBaseXP);
                        xpGains.push(...styledXP);
                        p.combatTargetMonsterId = null;
                        p.state = 'idle';
                    }
                }
                monster.isDead = true;
                monster.inCombat = false;
                monster.combatPlayerId = null;
                monster.respawnTimer = monster.respawnTime;
                monster.state = 'DEAD';

                // Boss loot sharing: top damage dealer gets rare drops, all get coin split
                this.createBossRaidLoot(monster, state, engagedPlayers, damageDealt);

                if (this.monsterBehavior) {
                    this.monsterBehavior.clearThreat(monster.id);
                    this.monsterBehavior.resetBossPhase(monster.id);
                }
                // Quest credit to all engaged players (boss kills are special)
                for (const p of engagedPlayers) {
                    if (!p.isDead) {
                        this.questSystem.checkMonsterKill(p, monster.monsterId, monster.isBoss);
                    }
                }
                return { hitsplats, deaths, xpGains };
            }
        }

        // === Boss attacks highest-threat player (prayer + style + set bonus applied) ===
        const target = this.monsterBehavior?.getTopThreatPlayer(monster.id, state.players as any) ?? engagedPlayers[0];
        if (target && !target.isDead) {
            const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
            const monStr = monster.combatStats.strength * monster.enrageMultiplier;
            const tPrayer = this.getPrayerEffects(target.sessionId);
            const tStyle = this.getPlayerStyle(target.sessionId);
            const tSetBonus = this.getPlayerSetBonus(target);
            const helm = target.equippedHelm.id ? target.equippedHelm : null;
            const shield = target.equippedShield.id ? target.equippedShield : null;
            const pDef = target.defence + (helm ? helm.defenceStat : 0) + (shield ? shield.defenceStat : 0)
                + this.getPotionBoost(target.sessionId, 'defence') + tStyle.defenceBonus + tPrayer.defenceBoost + tSetBonus.defence;

            if (Math.random() * (monAtk + 5) > Math.random() * (pDef + 5)) {
                const maxHit = Math.floor(monStr * 0.8 + 2);
                let dmg = Math.floor(Math.random() * maxHit) + 1;
                // Apply prayer damage reduction
                if (tPrayer.damageReduction > 0) {
                    dmg = Math.max(1, Math.floor(dmg * (1 - tPrayer.damageReduction)));
                }
                target.hp = Math.max(0, target.hp - dmg);
                hitsplats.push({ targetType: 'player', targetId: target.sessionId, damage: dmg, isMiss: false, isSpec: false, x: target.x, z: target.z });
            } else {
                hitsplats.push({ targetType: 'player', targetId: target.sessionId, damage: 0, isMiss: true, isSpec: false, x: target.x, z: target.z });
            }

            if (target.hp <= 0) {
                deaths.push({ entityType: 'player', entityId: target.sessionId, killerType: 'npc', killerId: monster.id });
                this.onPlayerDeathByMonster(target, monster, state);
            }
        }

        return { hitsplats, deaths, xpGains };
    }

    // ============================================================
    // Food Eating — heal during combat with cooldown
    // ============================================================

    /** Eat food from inventory. Returns heal amount or 0 if can't eat. */
    eatFood(player: PlayerSchema, inventorySlot: number): number {
        if (player.isDead) return 0;

        // Check food cooldown
        const cooldown = this.foodCooldowns.get(player.sessionId) || 0;
        if (cooldown > 0) return 0;

        const item = player.inventory[inventorySlot];
        if (!item || !item.id) return 0;

        const itemDef = ITEMS[item.id];
        if (!itemDef || itemDef.type !== 'food') return 0;

        const healAmount = (itemDef as any).healAmount || 10;
        player.hp = Math.min(player.maxHp, player.hp + healAmount);

        // Consume the food
        this.inventorySystem.clearSlot(player, inventorySlot);

        // Set cooldown (in seconds, based on combat ticks)
        this.foodCooldowns.set(player.sessionId, FOOD_COOLDOWN * COMBAT_TICK);

        return healAmount;
    }

    // ============================================================
    // Antipoison — cure poison + grant immunity
    // ============================================================

    /** Use antipoison potion. Cures poison and grants immunity. Returns true if consumed. */
    useAntipoison(player: PlayerSchema): boolean {
        // Cure existing poison
        this.poisonTimers.delete(player.sessionId);

        // Grant immunity
        this.antipoisonImmunity.set(player.sessionId, ANTIPOISON_IMMUNITY);

        return true;
    }

    /** Check if a player has antipoison immunity. */
    hasAntipoisonImmunity(playerId: string): boolean {
        return (this.antipoisonImmunity.get(playerId) || 0) > 0;
    }

    // ============================================================
    // Bones Burying — prayer XP
    // ============================================================

    /** Bury bones from inventory. Returns prayer XP gained, or 0 if invalid. */
    buryBones(player: PlayerSchema, inventorySlot: number): { prayerXP: number } {
        if (player.isDead) return { prayerXP: 0 };

        const item = player.inventory[inventorySlot];
        if (!item || !item.id) return { prayerXP: 0 };

        const itemDef = ITEMS[item.id];
        if (!itemDef || itemDef.type !== 'bones') return { prayerXP: 0 };

        const xp = BONES_XP[item.id] || 15;

        // Consume the bones
        this.inventorySystem.clearSlot(player, inventorySlot);

        return { prayerXP: xp };
    }

    // ============================================================
    // Combat Flee — retreat with penalty
    // ============================================================

    /** Attempt to flee from combat. Player takes damage for FLEE_DELAY seconds, then disengages. */
    attemptFlee(player: PlayerSchema): boolean {
        if (player.isDead) return false;
        if (this.fleeTimers.has(player.sessionId)) return false; // already fleeing

        if (player.combatTargetMonsterId) {
            this.fleeTimers.set(player.sessionId, {
                remaining: FLEE_DELAY,
                targetType: 'monster',
                targetId: player.combatTargetMonsterId,
            });
            return true;
        }
        if (player.combatTargetNpcId) {
            this.fleeTimers.set(player.sessionId, {
                remaining: FLEE_DELAY,
                targetType: 'npc',
                targetId: player.combatTargetNpcId,
            });
            return true;
        }
        return false;
    }

    /** Check if a player is currently fleeing. */
    isFleeing(playerId: string): boolean {
        return this.fleeTimers.has(playerId);
    }

    /** Update flee timers. Returns list of playerIds who completed their flee. Call once per second. */
    updateFleeTimers(dt: number): string[] {
        const completed: string[] = [];
        this.fleeTimers.forEach((flee, playerId) => {
            flee.remaining -= dt;
            if (flee.remaining <= 0) {
                completed.push(playerId);
                this.fleeTimers.delete(playerId);
            }
        });
        return completed;
    }

    /** Complete a flee — disengage from combat and reset threat. */
    completeFlee(player: PlayerSchema, npc?: NPCSchema, monster?: MonsterSchema): void {
        if (npc) {
            this.disengageCombat(player, npc);
        }
        if (monster) {
            player.combatTargetMonsterId = null;
            player.state = 'idle';
            if (this.monsterBehavior) {
                this.monsterBehavior.removeThreat(monster.id, player.sessionId);
                const engaged = this.monsterBehavior.getEngagedPlayers(monster.id, new Map() as any);
                if (engaged.length === 0) {
                    monster.inCombat = false;
                    monster.combatPlayerId = null;
                    monster.state = 'LEASHING';
                } else {
                    monster.combatPlayerId = engaged[0].sessionId;
                }
            }
        }
    }

    // ============================================================
    // Death Grave System — drop items as reclaimable grave
    // ============================================================

    /** Create a grave loot pile on player death. Only the owner can loot for GRAVE_DURATION seconds. */
    createGrave(player: PlayerSchema, state: GameState): void {
        const graveItems: { id: string; qty: number }[] = [];

        // Drop all non-equipped inventory items (keep equipped gear)
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            if (item && item.id) {
                graveItems.push({ id: item.id, qty: item.quantity || 1 });
                this.inventorySystem.clearSlot(player, i);
            }
        }

        if (graveItems.length === 0) return;

        const graveId = `grave_${player.sessionId}_${Date.now()}`;
        const pile = new LootPile();
        pile.id = graveId;
        pile.x = player.x;
        pile.z = player.z;
        pile.timer = GRAVE_DURATION;
        pile.itemsJson = JSON.stringify(graveItems);
        // Store owner info in the ID prefix so the room can check ownership
        state.lootPiles.set(graveId, pile);
    }

    // ============================================================
    // Bone type helpers — bosses drop better bones
    // ============================================================

    /** Get the appropriate bone type for a monster. */
    private getMonsterBoneType(monster: MonsterSchema): string {
        if (monster.monsterId === 'data_breach_dragon') return 'dragon_bones';
        if (monster.isBoss) return 'big_bones';
        return 'bones';
    }

    // ============================================================
    // Slayer Task System
    // ============================================================

    /** Assign a random slayer task to a player. Returns the task or null if none eligible. */
    assignSlayerTask(playerId: string, combatLevel: number): SlayerTaskDef | null {
        if (this.slayerTasks.has(playerId)) return null; // already has a task
        const task = getRandomSlayerTask(combatLevel);
        if (!task) return null;
        this.slayerTasks.set(playerId, { task, killsRemaining: task.count });
        return task;
    }

    /** Get player's current slayer task. */
    getSlayerTask(playerId: string): { task: SlayerTaskDef; killsRemaining: number } | null {
        return this.slayerTasks.get(playerId) || null;
    }

    /** Cancel a slayer task. */
    cancelSlayerTask(playerId: string): void {
        this.slayerTasks.delete(playerId);
    }

    /** Check a monster kill against slayer task. Returns reward if completed, null otherwise. */
    checkSlayerKill(playerId: string, monsterId: string): { slayerXP: number; combatXP: number; coins: number } | null {
        const entry = this.slayerTasks.get(playerId);
        if (!entry) return null;
        if (entry.task.monsterId !== monsterId) return null;

        entry.killsRemaining--;
        if (entry.killsRemaining <= 0) {
            // Task complete!
            const reward = {
                slayerXP: entry.task.xpReward.slayer,
                combatXP: entry.task.xpReward.combat,
                coins: entry.task.coinReward,
            };
            this.slayerTasks.delete(playerId);
            return reward;
        }
        return null;
    }

    // ============================================================
    // HP Regeneration — heal out of combat
    // ============================================================

    /** Mark a player as being in combat (resets regen timer). */
    private markInCombat(playerId: string): void {
        this.hpRegenTimers.set(playerId, { lastCombatTime: Date.now(), regenTimer: 0 });
    }

    /** Update HP regeneration for all players. Call once per second. */
    updateHpRegen(players: Map<string, PlayerSchema>, dt: number): void {
        const now = Date.now();
        players.forEach((player, playerId) => {
            if (player.isDead) return;
            if (player.hp >= player.maxHp) return;
            if (player.state === 'combat') return;

            const regen = this.hpRegenTimers.get(playerId);
            if (!regen) {
                // No combat history — start regen immediately
                this.hpRegenTimers.set(playerId, { lastCombatTime: 0, regenTimer: dt });
                return;
            }

            // Must be out of combat for HP_REGEN_COMBAT_DELAY seconds
            const timeSinceCombat = (now - regen.lastCombatTime) / 1000;
            if (timeSinceCombat < HP_REGEN_COMBAT_DELAY) return;

            regen.regenTimer += dt;
            if (regen.regenTimer >= HP_REGEN_INTERVAL) {
                regen.regenTimer -= HP_REGEN_INTERVAL;
                player.hp = Math.min(player.maxHp, player.hp + 1);
            }
        });
    }

    // ============================================================
    // Combat Level — OSRS-style formula
    // ============================================================

    /** Calculate a player's combat level. */
    getCombatLevel(player: PlayerSchema): number {
        return calculateCombatLevel({
            attack: player.attack,
            strength: player.strength,
            defence: player.defence,
            hitpoints: player.maxHp,
            prayer: this.getPrayerPoints(player.sessionId),
        });
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
