// ============================================================
// AgentScape — Agent Combat Adapter
// Bridges NPC agents to real MonsterSchema combat.
// Adapter pattern — does NOT modify CombatSystem or PlayerSchema.
// Agents engage real monsters, deal/take real damage, share
// threat tables with players.
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { MonsterSchema } from '../schema/MonsterSchema';
import { MonsterBehaviorSystem } from '../systems/MonsterBehaviorSystem';
import { AgentMemory, AgentMemoryManager } from './AgentMemory';
import { NPC_COMBAT_STATS, BOSSES, AGENT_BASE_ATTACK_SPEED } from '../config';
import { MapSchema } from '@colyseus/schema';

export interface AgentHitsplat {
    targetType: 'monster' | 'npc';
    targetId: string;
    damage: number;
    isMiss: boolean;
    isSpec: boolean;
    x: number;
    z: number;
    attackerName?: string;
}

export interface AgentDeathEvent {
    type: 'agent_death' | 'monster_death_by_agents';
    entityId: string;
    entityName: string;
    killedBy?: string;
    bossId?: string;
}

export interface RaidEvent {
    type: 'rally_call' | 'raid_start' | 'raid_wipe' | 'raid_victory' | 'agent_death' | 'boss_damage';
    agentName?: string;
    bossName?: string;
    bossId?: string;
    bossHpPercent?: number;
    count?: number;
    deaths?: number;
    message?: string;
}

export interface AgentCombatResults {
    hitsplats: AgentHitsplat[];
    deaths: AgentDeathEvent[];
    raidEvents: RaidEvent[];
}

// Per-agent combat timer (tracks when they can attack next)
interface AgentCombatState {
    attackTimer: number;
    attackSpeed: number;
}

export class AgentCombatAdapter {
    private monsterBehavior: MonsterBehaviorSystem;
    private combatStates: Map<string, AgentCombatState> = new Map();

    constructor(monsterBehavior: MonsterBehaviorSystem) {
        this.monsterBehavior = monsterBehavior;
    }

    // --- Effective stats from NPC base + gear tier + level ---

    getEffectiveAttack(npc: NPCSchema, mem: AgentMemory): number {
        const base = (NPC_COMBAT_STATS[npc.role] || NPC_COMBAT_STATS.aligned).attack;
        return base + mem.gearTier * 3 + Math.floor(mem.effectiveLevel * 0.5);
    }

    getEffectiveStrength(npc: NPCSchema, mem: AgentMemory): number {
        const base = (NPC_COMBAT_STATS[npc.role] || NPC_COMBAT_STATS.aligned).strength;
        return base + mem.gearTier * 2 + Math.floor(mem.effectiveLevel * 0.4);
    }

    getEffectiveDefence(npc: NPCSchema, mem: AgentMemory): number {
        const base = (NPC_COMBAT_STATS[npc.role] || NPC_COMBAT_STATS.aligned).defence;
        return base + mem.gearTier * 2 + Math.floor(mem.effectiveLevel * 0.3);
    }

    getAttackSpeed(mem: AgentMemory): number {
        // Faster weapons at higher gear tiers
        const speeds: Record<number, number> = { 1: 3.0, 2: 2.8, 3: 2.6, 4: 2.4, 5: 2.2, 6: 2.0 };
        return speeds[mem.gearTier] || AGENT_BASE_ATTACK_SPEED;
    }

    // --- Engage / Disengage ---

    engageMonster(npc: NPCSchema, monster: MonsterSchema, mem: AgentMemory): void {
        npc.combatTargetMonsterId = monster.id;
        mem.targetBossId = monster.isBoss ? monster.monsterId : null;

        // Add to monster threat table (agents use 'agent:' prefix to avoid player ID collisions)
        this.monsterBehavior.addThreat(monster.id, `agent:${npc.id}`, 1);

        // Mark monster in combat
        if (!monster.inCombat) {
            monster.inCombat = true;
            monster.state = 'ATTACKING';
        }

        // Init combat timer
        this.combatStates.set(npc.id, {
            attackTimer: 0,
            attackSpeed: this.getAttackSpeed(mem),
        });

        // Face the monster
        npc.rotation = Math.atan2(monster.x - npc.x, monster.z - npc.z);
    }

    disengageAgent(npc: NPCSchema, monster: MonsterSchema | null): void {
        if (monster) {
            this.monsterBehavior.removeThreat(monster.id, `agent:${npc.id}`);
        }
        npc.combatTargetMonsterId = '';
        this.combatStates.delete(npc.id);
    }

    // --- Main tick: process all agents in REAL_COMBAT ---

    processAllTicks(
        npcs: MapSchema<NPCSchema>,
        monsters: MapSchema<MonsterSchema>,
        memories: AgentMemoryManager,
        dt: number,
    ): AgentCombatResults {
        const results: AgentCombatResults = { hitsplats: [], deaths: [], raidEvents: [] };

        npcs.forEach((npc) => {
            if (npc.isDead || npc.state !== 'REAL_COMBAT') return;
            if (!npc.combatTargetMonsterId) return;

            const monster = monsters.get(npc.combatTargetMonsterId);
            if (!monster || monster.isDead) {
                npc.combatTargetMonsterId = '';
                npc.state = 'IDLE';
                npc.stateTimer = 2 + Math.random() * 3;
                npc.activity = 'Idle';
                return;
            }

            const mem = memories.get(npc.id);

            // Stun check
            if (mem.raidStunTimer > 0) {
                mem.raidStunTimer -= dt;
                return;
            }

            // Attack timer
            let cs = this.combatStates.get(npc.id);
            if (!cs) {
                cs = { attackTimer: 0, attackSpeed: this.getAttackSpeed(mem) };
                this.combatStates.set(npc.id, cs);
            }
            cs.attackTimer += dt;
            if (cs.attackTimer < cs.attackSpeed) return;
            cs.attackTimer -= cs.attackSpeed;

            // --- Agent attacks monster ---
            const atkRoll = this.getEffectiveAttack(npc, mem);
            const strRoll = this.getEffectiveStrength(npc, mem);
            const monDef = monster.combatStats.defence * (monster.enrageMultiplier > 1 ? this.getBossDefMultiplier(monster) : 1);

            const hit = Math.random() * (atkRoll + 5) > Math.random() * (monDef + 5);
            if (hit) {
                const maxHit = Math.floor(strRoll * 0.8 + 2);
                const dmg = Math.floor(Math.random() * maxHit) + 1;
                monster.hp = Math.max(0, monster.hp - dmg);
                results.hitsplats.push({
                    targetType: 'monster', targetId: monster.id,
                    damage: dmg, isMiss: false, isSpec: false,
                    x: monster.x, z: monster.z, attackerName: npc.name,
                });
                // Add threat
                this.monsterBehavior.addThreat(monster.id, `agent:${npc.id}`, dmg);
            } else {
                results.hitsplats.push({
                    targetType: 'monster', targetId: monster.id,
                    damage: 0, isMiss: true, isSpec: false,
                    x: monster.x, z: monster.z, attackerName: npc.name,
                });
            }

            // --- Check monster death ---
            if (monster.hp <= 0) {
                this.handleMonsterKill(npc, monster, mem, npcs, memories, results);
                return;
            }

            // --- Monster retaliates against agent ---
            this.monsterRetaliateAgent(npc, monster, mem, results);

            // --- Mid-fight eat (personality-driven) ---
            const eatThreshold = mem.notecard ? (30 + mem.notecard.caution * 0.3) / 100 : 0.45;
            if (npc.hp > 0 && (npc.hp / npc.maxHp) < eatThreshold && mem.foodCount > 0) {
                mem.foodCount--;
                const healAmt = 10 + Math.floor(Math.random() * 5);
                npc.hp = Math.min(npc.maxHp, npc.hp + healAmt);
            }

            // --- Flee check ---
            const fleeThreshold = mem.notecard ? (10 + mem.notecard.caution * 0.2) / 100 : 0.20;
            if (npc.hp > 0 && (npc.hp / npc.maxHp) < fleeThreshold && mem.foodCount <= 0) {
                this.disengageAgent(npc, monster);
                npc.state = 'IDLE';
                npc.stateTimer = 2;
                npc.activity = 'Fleeing';
                mem.raidState = 'recovering';
                mem.currentGoal = { type: 'flee', targetX: 100, targetZ: 95 };
            }
        });

        return results;
    }

    // --- Monster retaliates against an agent ---
    private monsterRetaliateAgent(npc: NPCSchema, monster: MonsterSchema, mem: AgentMemory, results: AgentCombatResults): void {
        const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
        const monStr = monster.combatStats.strength * monster.enrageMultiplier;
        const agentDef = this.getEffectiveDefence(npc, mem);

        const monHit = Math.random() * (monAtk + 5) > Math.random() * (agentDef + 5);
        if (monHit) {
            const maxHit = Math.floor(monStr * 0.8 + 2);
            const dmg = Math.floor(Math.random() * maxHit) + 1;
            npc.hp = Math.max(0, npc.hp - dmg);
            results.hitsplats.push({
                targetType: 'npc', targetId: npc.id,
                damage: dmg, isMiss: false, isSpec: false,
                x: npc.x, z: npc.z,
            });
        }

        // Agent death
        if (npc.hp <= 0) {
            this.handleAgentDeath(npc, monster, mem, results);
        }
    }

    // --- Agent dies ---
    private handleAgentDeath(npc: NPCSchema, monster: MonsterSchema, mem: AgentMemory, results: AgentCombatResults): void {
        npc.hp = 0;
        npc.isDead = true;
        npc.respawnTimer = 30;
        mem.totalDeaths++;
        mem.lastDeathMonster = monster.name;
        mem.raidState = 'recovering';
        mem.currentGoal = null;
        mem.fightTimer = 0;
        mem.addEvent({ timestamp: Date.now(), type: 'raid_death', description: `Killed by ${monster.name} during raid` });

        this.disengageAgent(npc, monster);

        results.deaths.push({
            type: 'agent_death', entityId: npc.id, entityName: npc.name, killedBy: monster.name,
        });

        if (monster.isBoss) {
            mem.raidAttempts++;
            mem.lastRaidResult = 'wipe';
            mem.dragonKnowledge = Math.min(100, mem.dragonKnowledge + 5);
            results.raidEvents.push({
                type: 'agent_death', agentName: npc.name, bossName: monster.name,
                bossId: monster.monsterId,
                bossHpPercent: Math.round((monster.hp / monster.maxHp) * 100),
            });
        }
    }

    // --- Monster killed by agents ---
    private handleMonsterKill(
        killerNpc: NPCSchema, monster: MonsterSchema, killerMem: AgentMemory,
        npcs: MapSchema<NPCSchema>, memories: AgentMemoryManager,
        results: AgentCombatResults,
    ): void {
        monster.isDead = true;
        monster.inCombat = false;
        monster.combatPlayerId = null;
        monster.respawnTimer = monster.respawnTime;
        monster.state = 'DEAD';

        results.deaths.push({
            type: 'monster_death_by_agents', entityId: monster.id, entityName: monster.name,
            killedBy: killerNpc.name, bossId: monster.isBoss ? monster.monsterId : undefined,
        });

        // Disengage ALL agents fighting this monster
        npcs.forEach((npc) => {
            if (npc.combatTargetMonsterId === monster.id) {
                const mem = memories.get(npc.id);
                this.disengageAgent(npc, monster);
                npc.state = 'IDLE';
                npc.stateTimer = 3 + Math.random() * 4;
                npc.activity = 'Idle';

                if (monster.isBoss) {
                    mem.raidKills++;
                    mem.lastRaidResult = 'victory';
                    mem.raidState = 'none';
                    mem.dragonKnowledge = Math.min(100, mem.dragonKnowledge + 20);
                    mem.addEvent({ timestamp: Date.now(), type: 'raid_victory', description: `Helped defeat ${monster.name}!` });
                }
            }
        });

        // Boss victory event
        if (monster.isBoss) {
            results.raidEvents.push({
                type: 'raid_victory', bossName: monster.name, bossId: monster.monsterId,
                agentName: killerNpc.name,
                message: `${monster.name} has been defeated!`,
            });
        }

        // Clear threat
        this.monsterBehavior.clearThreat(monster.id);
    }

    private getBossDefMultiplier(monster: MonsterSchema): number {
        const bossDef = BOSSES[monster.monsterId];
        if (!bossDef || !bossDef.phases) return 1;
        // Use current enrage multiplier as proxy for phase
        const hpPct = (monster.hp / monster.maxHp) * 100;
        for (let i = bossDef.phases.length - 1; i >= 0; i--) {
            if (hpPct <= bossDef.phases[i].hpThreshold) {
                return bossDef.phases[i].defenceMultiplier;
            }
        }
        return 1;
    }

    // --- Apply boss AOE damage to agents ---
    applyBossAOEToAgents(
        monster: MonsterSchema,
        npcs: MapSchema<NPCSchema>,
        memories: AgentMemoryManager,
        damage: number,
        radius: number,
    ): AgentCombatResults {
        const results: AgentCombatResults = { hitsplats: [], deaths: [], raidEvents: [] };

        npcs.forEach((npc) => {
            if (npc.isDead || npc.state !== 'REAL_COMBAT') return;
            if (npc.combatTargetMonsterId !== monster.id) return;

            const dist = Math.sqrt((npc.x - monster.x) ** 2 + (npc.z - monster.z) ** 2);
            if (dist <= radius) {
                const mem = memories.get(npc.id);
                const agentDef = this.getEffectiveDefence(npc, mem);
                const dmg = Math.max(1, damage - Math.floor(Math.random() * Math.min(agentDef, 5)));
                npc.hp = Math.max(0, npc.hp - dmg);

                results.hitsplats.push({
                    targetType: 'npc', targetId: npc.id,
                    damage: dmg, isMiss: false, isSpec: false,
                    x: npc.x, z: npc.z,
                });

                if (npc.hp <= 0) {
                    this.handleAgentDeath(npc, monster, mem, results);
                }
            }
        });

        return results;
    }

    // --- Apply boss stun to agents ---
    applyBossStunToAgents(
        monster: MonsterSchema,
        npcs: MapSchema<NPCSchema>,
        memories: AgentMemoryManager,
    ): void {
        // Stun a random engaged agent
        const engaged: NPCSchema[] = [];
        npcs.forEach((npc) => {
            if (npc.isDead || npc.state !== 'REAL_COMBAT') return;
            if (npc.combatTargetMonsterId === monster.id) engaged.push(npc);
        });
        if (engaged.length > 0) {
            const target = engaged[Math.floor(Math.random() * engaged.length)];
            const mem = memories.get(target.id);
            mem.raidStunTimer = 4.8; // 2 attack ticks
        }
    }

    // --- Apply boss drain to agents ---
    applyBossDrainToAgents(
        monster: MonsterSchema,
        npcs: MapSchema<NPCSchema>,
        memories: AgentMemoryManager,
        damage: number,
        radius: number,
    ): void {
        npcs.forEach((npc) => {
            if (npc.isDead || npc.state !== 'REAL_COMBAT') return;
            if (npc.combatTargetMonsterId !== monster.id) return;

            const dist = Math.sqrt((npc.x - monster.x) ** 2 + (npc.z - monster.z) ** 2);
            if (dist <= radius) {
                // Agents don't have energy, but we reduce food as a penalty
                const mem = memories.get(npc.id);
                if (mem.foodCount > 0) mem.foodCount--;
            }
        });
    }
}
