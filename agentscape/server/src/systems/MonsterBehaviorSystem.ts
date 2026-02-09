// ============================================================
// AgentScape — Monster Behavior System
// Handles PvM monster AI: patrol, aggro, leash, boss abilities
// ============================================================

import { MonsterSchema } from '../schema/MonsterSchema';
import { PlayerSchema } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { GameMap } from '../utils/MapGenerator';
import {
    ZONES, MONSTERS, BOSSES, BossPhase,
    MONSTER_MOVE_SPEED, MONSTER_AGGRO_RANGE, MONSTER_LEASH_RANGE, BOSS_AGGRO_RANGE,
    isInSafeZone,
} from '../config';
import { MapSchema } from '@colyseus/schema';
import { AgentCombatAdapter, AgentCombatResults } from '../agents/AgentCombatAdapter';
import { AgentMemoryManager } from '../agents/AgentMemory';

export interface MonsterPathfindRequest {
    monster: MonsterSchema;
    targetX: number;
    targetZ: number;
}

export interface MonsterAbilityEvent {
    monsterId: string;
    monsterName: string;
    abilityName: string;
    abilityType: string;
    damage?: number;
    heal?: number;
    radius?: number;
    x: number;
    z: number;
}

export interface BossPhaseChangeEvent {
    monsterId: string;
    monsterName: string;
    phaseName: string;
    message: string;
    attackMultiplier: number;
    defenceMultiplier: number;
}

// Threat table for multi-player boss combat
// Maps monster ID → { playerId → threat value }
export type ThreatTable = Map<string, Map<string, number>>;

export class MonsterBehaviorSystem {
    private map: GameMap;
    private pathfindQueue: MonsterPathfindRequest[] = [];

    // Threat tables: bosses track who's dealing damage to decide targets
    private threatTables: ThreatTable = new Map();

    // Boss phase tracking: monsterId → current phase index
    private bossPhases: Map<string, number> = new Map();

    // Agent combat adapter (set after construction)
    private agentCombatAdapter: AgentCombatAdapter | null = null;
    private agentMemories: AgentMemoryManager | null = null;

    constructor(map: GameMap) {
        this.map = map;
    }

    /** Link to the agent combat adapter so boss abilities can hit agents. */
    setAgentCombatAdapter(adapter: AgentCombatAdapter, memories: AgentMemoryManager): void {
        this.agentCombatAdapter = adapter;
        this.agentMemories = memories;
    }

    // --- Threat management ---

    /** Add threat for a player hitting a boss. Called by CombatSystem on damage. */
    addThreat(monsterId: string, playerId: string, amount: number): void {
        if (!this.threatTables.has(monsterId)) {
            this.threatTables.set(monsterId, new Map());
        }
        const table = this.threatTables.get(monsterId)!;
        table.set(playerId, (table.get(playerId) || 0) + amount);
    }

    /** Get the player with highest threat for this monster. */
    getTopThreatPlayer(monsterId: string, players: MapSchema<PlayerSchema>): PlayerSchema | null {
        const table = this.threatTables.get(monsterId);
        if (!table || table.size === 0) return null;

        let topId: string | null = null;
        let topThreat = -1;
        table.forEach((threat, playerId) => {
            const player = players.get(playerId);
            if (player && !player.isDead && threat > topThreat) {
                topThreat = threat;
                topId = playerId;
            }
        });

        return topId ? players.get(topId) || null : null;
    }

    /** Get all players engaged with this monster (have threat). */
    getEngagedPlayers(monsterId: string, players: MapSchema<PlayerSchema>): PlayerSchema[] {
        const table = this.threatTables.get(monsterId);
        if (!table) return [];

        const engaged: PlayerSchema[] = [];
        table.forEach((_, playerId) => {
            const player = players.get(playerId);
            if (player && !player.isDead) engaged.push(player);
        });
        return engaged;
    }

    /** Remove a player from a monster's threat table (on death, disconnect, flee). */
    removeThreat(monsterId: string, playerId: string): void {
        const table = this.threatTables.get(monsterId);
        if (table) {
            table.delete(playerId);
            if (table.size === 0) this.threatTables.delete(monsterId);
        }
    }

    /** Clear all threat for a monster (on death, leash, respawn). */
    clearThreat(monsterId: string): void {
        this.threatTables.delete(monsterId);
    }

    /** Remove a player from ALL threat tables (on disconnect). */
    removePlayerFromAllThreats(playerId: string): void {
        this.threatTables.forEach((table, monsterId) => {
            table.delete(playerId);
            if (table.size === 0) this.threatTables.delete(monsterId);
        });
    }

    getPathfindQueue(): MonsterPathfindRequest[] {
        return this.pathfindQueue;
    }

    clearPathfindQueue(): void {
        this.pathfindQueue = [];
    }

    updateMonster(
        monster: MonsterSchema,
        dt: number,
        players: MapSchema<PlayerSchema>,
        npcs?: MapSchema<NPCSchema>,
    ): MonsterAbilityEvent[] {
        const events: MonsterAbilityEvent[] = [];

        if (monster.isDead) {
            monster.respawnTimer -= dt;
            // Respawn handled externally (in room)
            return events;
        }

        // Tick ability cooldowns
        for (const ability of monster.abilities) {
            if (ability.currentCooldown > 0) {
                ability.currentCooldown -= dt;
            }
        }

        if (monster.inCombat) {
            if (monster.isBoss) {
                // Check phase transitions
                this.checkBossPhase(monster);
                // Check boss abilities during combat — now also hits agents
                const abilityEvents = this.checkBossAbilities(monster, players, npcs);
                events.push(...abilityEvents);
            }
            return events;
        }

        switch (monster.state) {
            case 'IDLE':
                monster.stateTimer -= dt;
                if (monster.stateTimer <= 0) {
                    // Check for nearby players to aggro (if aggressive)
                    if (monster.aggressive) {
                        const target = this.findAggroTarget(monster, players);
                        if (target) {
                            monster.aggroTargetId = target.sessionId;
                            monster.state = 'AGGRO';
                            break;
                        }
                    }
                    // Otherwise patrol
                    monster.state = 'PATROL';
                    this.choosePatrolTarget(monster);
                }
                break;

            case 'PATROL':
                // If aggressive, keep scanning for players
                if (monster.aggressive) {
                    const target = this.findAggroTarget(monster, players);
                    if (target) {
                        monster.aggroTargetId = target.sessionId;
                        monster.state = 'AGGRO';
                        monster.path = [];
                        break;
                    }
                }
                // Movement handled by movement system via path
                break;

            case 'AGGRO': {
                const target = players.get(monster.aggroTargetId || '');
                if (!target || target.isDead) {
                    // Target gone, go back to idle
                    monster.aggroTargetId = null;
                    monster.state = 'LEASHING';
                    this.pathToSpawn(monster);
                    break;
                }

                // Check leash range
                const distFromSpawn = Math.sqrt(
                    (monster.x - monster.spawnX) ** 2 + (monster.z - monster.spawnZ) ** 2
                );
                if (distFromSpawn > monster.leashRange) {
                    monster.aggroTargetId = null;
                    monster.state = 'LEASHING';
                    this.pathToSpawn(monster);
                    break;
                }

                // Check if target is in safe zone
                if (isInSafeZone(target.x, target.z)) {
                    monster.aggroTargetId = null;
                    monster.state = 'LEASHING';
                    this.pathToSpawn(monster);
                    break;
                }

                // Move towards target (request new path periodically)
                const distToTarget = Math.sqrt(
                    (monster.x - target.x) ** 2 + (monster.z - target.z) ** 2
                );
                if (distToTarget <= 1.5) {
                    // In attack range — combat system will handle
                    monster.state = 'ATTACKING';
                } else {
                    // Chase — request pathfind to player position
                    if (monster.path.length === 0 || monster.stateTimer <= 0) {
                        this.pathfindQueue.push({
                            monster,
                            targetX: Math.floor(target.x),
                            targetZ: Math.floor(target.z),
                        });
                        monster.stateTimer = 2; // re-path every 2s
                    }
                    monster.stateTimer -= dt;
                }
                break;
            }

            case 'ATTACKING': {
                // Check if target still in range
                const attackTarget = players.get(monster.aggroTargetId || '');
                if (!attackTarget || attackTarget.isDead) {
                    monster.aggroTargetId = null;
                    monster.state = 'LEASHING';
                    this.pathToSpawn(monster);
                    break;
                }

                const dist = Math.sqrt(
                    (monster.x - attackTarget.x) ** 2 + (monster.z - attackTarget.z) ** 2
                );
                if (dist > 2.5) {
                    // Target moved out of range, chase again
                    monster.state = 'AGGRO';
                    monster.stateTimer = 0; // immediate re-path
                }
                // Combat ticks handled by CombatSystem
                break;
            }

            case 'LEASHING':
                // Walk back to spawn, then go idle
                if (monster.path.length === 0) {
                    // Arrived at spawn or path failed
                    monster.x = monster.spawnX;
                    monster.z = monster.spawnZ;
                    monster.hp = monster.maxHp; // full heal on leash
                    monster.enraged = false;
                    monster.enrageMultiplier = 1;
                    monster.state = 'IDLE';
                    monster.stateTimer = 2 + Math.random() * 3;
                    this.clearThreat(monster.id); // reset threat on leash
                }
                break;
        }

        return events;
    }

    private findAggroTarget(monster: MonsterSchema, players: MapSchema<PlayerSchema>): PlayerSchema | null {
        const range = monster.isBoss ? BOSS_AGGRO_RANGE : MONSTER_AGGRO_RANGE;
        let closest: PlayerSchema | null = null;
        let closestDist = range + 1;

        players.forEach((player) => {
            if (player.isDead) return;
            if (isInSafeZone(player.x, player.z)) return;

            const dist = Math.sqrt(
                (monster.x - player.x) ** 2 + (monster.z - player.z) ** 2
            );
            if (dist < closestDist) {
                closestDist = dist;
                closest = player;
            }
        });

        return closest;
    }

    /**
     * Find all players in aggro range of an aggressive monster.
     * Used for multi-target aggro: monster adds all nearby players to threat table.
     */
    findAllAggroTargets(monster: MonsterSchema, players: MapSchema<PlayerSchema>): PlayerSchema[] {
        if (!monster.aggressive) return [];
        const range = monster.isBoss ? BOSS_AGGRO_RANGE : MONSTER_AGGRO_RANGE;
        const targets: PlayerSchema[] = [];

        players.forEach((player) => {
            if (player.isDead) return;
            if (isInSafeZone(player.x, player.z)) return;

            const dist = Math.sqrt(
                (monster.x - player.x) ** 2 + (monster.z - player.z) ** 2
            );
            if (dist <= range) {
                targets.push(player);
            }
        });

        return targets;
    }

    /**
     * For aggressive monsters in combat, scan for additional nearby players
     * and add them to the threat table. This makes multiple players aggro at once.
     * Returns newly aggro'd player IDs.
     */
    scanForAdditionalAggro(monster: MonsterSchema, players: MapSchema<PlayerSchema>): string[] {
        if (!monster.aggressive || !monster.inCombat) return [];

        const newAggros: string[] = [];
        const range = monster.isBoss ? BOSS_AGGRO_RANGE : MONSTER_AGGRO_RANGE;
        const currentThreat = this.threatTables.get(monster.id);

        players.forEach((player) => {
            if (player.isDead) return;
            if (isInSafeZone(player.x, player.z)) return;
            // Skip if already in threat table
            if (currentThreat?.has(player.sessionId)) return;
            // Skip if already fighting something else
            if (player.combatTargetMonsterId && player.combatTargetMonsterId !== monster.id) return;

            const dist = Math.sqrt(
                (monster.x - player.x) ** 2 + (monster.z - player.z) ** 2
            );
            if (dist <= range) {
                this.addThreat(monster.id, player.sessionId, 1);
                newAggros.push(player.sessionId);
            }
        });

        return newAggros;
    }

    private choosePatrolTarget(monster: MonsterSchema): void {
        const zone = ZONES[monster.zone];
        if (!zone) {
            monster.state = 'IDLE';
            monster.stateTimer = 3;
            return;
        }

        // Random position within spawn radius (5 tiles from spawn)
        const radius = 5;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * radius;
        let tx = Math.floor(monster.spawnX + Math.cos(angle) * dist);
        let tz = Math.floor(monster.spawnZ + Math.sin(angle) * dist);

        // Clamp to zone bounds
        tx = Math.max(zone.bounds.x1 + 1, Math.min(zone.bounds.x2 - 1, tx));
        tz = Math.max(zone.bounds.z1 + 1, Math.min(zone.bounds.z2 - 1, tz));

        monster.patrolTargetX = tx;
        monster.patrolTargetZ = tz;

        this.pathfindQueue.push({ monster, targetX: tx, targetZ: tz });
    }

    private pathToSpawn(monster: MonsterSchema): void {
        this.pathfindQueue.push({
            monster,
            targetX: Math.floor(monster.spawnX),
            targetZ: Math.floor(monster.spawnZ),
        });
    }

    /** Store last agent combat results from boss abilities for room to broadcast. */
    lastAgentAbilityResults: AgentCombatResults | null = null;

    private checkBossAbilities(
        monster: MonsterSchema,
        players: MapSchema<PlayerSchema>,
        npcs?: MapSchema<NPCSchema>,
    ): MonsterAbilityEvent[] {
        const events: MonsterAbilityEvent[] = [];
        const hpPercent = (monster.hp / monster.maxHp) * 100;

        for (const ability of monster.abilities) {
            if (ability.currentCooldown > 0) continue;
            if (ability.trigger && hpPercent > ability.trigger) continue;

            // Use the ability
            ability.currentCooldown = ability.cooldown;

            switch (ability.type) {
                case 'aoe': {
                    events.push({
                        monsterId: monster.id,
                        monsterName: monster.name,
                        abilityName: ability.name,
                        abilityType: 'aoe',
                        damage: ability.damage,
                        radius: ability.radius,
                        x: monster.x,
                        z: monster.z,
                    });
                    // Apply damage to all players in radius
                    const r = ability.radius || 4;
                    players.forEach((player) => {
                        if (player.isDead) return;
                        const dist = Math.sqrt(
                            (player.x - monster.x) ** 2 + (player.z - monster.z) ** 2
                        );
                        if (dist <= r) {
                            const dmg = Math.max(1, (ability.damage || 10) - Math.floor(Math.random() * 5));
                            player.hp = Math.max(0, player.hp - dmg);
                            if (player.hp <= 0) {
                                player.isDead = true;
                            }
                        }
                    });
                    // Also damage agents in REAL_COMBAT
                    if (this.agentCombatAdapter && this.agentMemories && npcs) {
                        this.lastAgentAbilityResults = this.agentCombatAdapter.applyBossAOEToAgents(
                            monster, npcs, this.agentMemories, ability.damage || 10, r,
                        );
                    }
                    break;
                }

                case 'heal': {
                    const healAmount = ability.heal || 50;
                    monster.hp = Math.min(monster.maxHp, monster.hp + healAmount);
                    events.push({
                        monsterId: monster.id,
                        monsterName: monster.name,
                        abilityName: ability.name,
                        abilityType: 'heal',
                        heal: healAmount,
                        x: monster.x,
                        z: monster.z,
                    });
                    break;
                }

                case 'enrage': {
                    if (!monster.enraged) {
                        monster.enraged = true;
                        // Stack enrage (1.5x) on top of current phase multiplier
                        const currentPhaseMulti = this.getBossPhaseMultipliers(monster).attack;
                        monster.enrageMultiplier = currentPhaseMulti * 1.5;
                        events.push({
                            monsterId: monster.id,
                            monsterName: monster.name,
                            abilityName: ability.name,
                            abilityType: 'enrage',
                            x: monster.x,
                            z: monster.z,
                        });
                    }
                    break;
                }

                case 'stun': {
                    // Stun the highest-threat player (or random engaged player for bosses)
                    const engaged = this.getEngagedPlayers(monster.id, players);
                    const stunTarget = engaged.length > 0
                        ? engaged[Math.floor(Math.random() * engaged.length)]
                        : players.get(monster.combatPlayerId || '');
                    if (stunTarget && !stunTarget.isDead) {
                        events.push({
                            monsterId: monster.id,
                            monsterName: monster.name,
                            abilityName: ability.name,
                            abilityType: 'stun',
                            x: monster.x,
                            z: monster.z,
                        });
                    }
                    // Also stun a random agent
                    if (this.agentCombatAdapter && this.agentMemories && npcs) {
                        this.agentCombatAdapter.applyBossStunToAgents(monster, npcs, this.agentMemories);
                    }
                    break;
                }

                case 'summon': {
                    events.push({
                        monsterId: monster.id,
                        monsterName: monster.name,
                        abilityName: ability.name,
                        abilityType: 'summon',
                        x: monster.x,
                        z: monster.z,
                    });
                    // Actual spawning handled by the room after receiving event
                    break;
                }

                case 'drain': {
                    // Drain energy from nearby players — prevents spec attacks
                    const drainRadius = ability.radius || 4;
                    players.forEach((player) => {
                        if (player.isDead) return;
                        const dist = Math.sqrt(
                            (player.x - monster.x) ** 2 + (player.z - monster.z) ** 2
                        );
                        if (dist <= drainRadius) {
                            const drainAmount = ability.damage || 20;
                            player.energy = Math.max(0, player.energy - drainAmount);
                            if (ability.heal) {
                                monster.hp = Math.min(monster.maxHp, monster.hp + ability.heal);
                            }
                        }
                    });
                    // Also drain agents
                    if (this.agentCombatAdapter && this.agentMemories && npcs) {
                        this.agentCombatAdapter.applyBossDrainToAgents(
                            monster, npcs, this.agentMemories, ability.damage || 20, drainRadius,
                        );
                    }
                    events.push({
                        monsterId: monster.id,
                        monsterName: monster.name,
                        abilityName: ability.name,
                        abilityType: 'drain',
                        damage: ability.damage,
                        heal: ability.heal,
                        radius: ability.radius,
                        x: monster.x,
                        z: monster.z,
                    });
                    break;
                }
            }

            // Only use one ability per tick
            break;
        }

        return events;
    }

    // Called when a monster's patrol walk completes
    onPatrolComplete(monster: MonsterSchema): void {
        monster.state = 'IDLE';
        monster.stateTimer = 2 + Math.random() * 4;
    }

    // Called when a monster's leash walk completes
    onLeashComplete(monster: MonsterSchema): void {
        monster.x = monster.spawnX;
        monster.z = monster.spawnZ;
        monster.hp = monster.maxHp;
        monster.enraged = false;
        monster.enrageMultiplier = 1;
        monster.state = 'IDLE';
        monster.stateTimer = 2 + Math.random() * 3;
        this.clearThreat(monster.id);
        this.resetBossPhase(monster.id);
    }

    // --- Boss phase system ---

    /**
     * Check if a boss should transition to a new phase based on HP%.
     * Returns a phase change event if a transition occurred, null otherwise.
     * The caller (room) should broadcast the message and apply stat multipliers.
     */
    checkBossPhase(monster: MonsterSchema): BossPhaseChangeEvent | null {
        if (!monster.isBoss) return null;

        const bossDef = BOSSES[monster.monsterId];
        if (!bossDef || !bossDef.phases || bossDef.phases.length === 0) return null;

        const hpPercent = (monster.hp / monster.maxHp) * 100;
        const currentPhaseIdx = this.bossPhases.get(monster.id) || 0;

        // Find the highest phase index whose threshold is >= current HP%
        // Phases are ordered high→low threshold, so we find the last one that activates
        let newPhaseIdx = 0;
        for (let i = bossDef.phases.length - 1; i >= 0; i--) {
            if (hpPercent <= bossDef.phases[i].hpThreshold) {
                newPhaseIdx = i;
                break;
            }
        }

        if (newPhaseIdx > currentPhaseIdx) {
            this.bossPhases.set(monster.id, newPhaseIdx);
            const phase = bossDef.phases[newPhaseIdx];

            // Apply phase multiplier — stacks WITH enrage
            // enrageMultiplier = phaseAttack * (enraged ? 1.5 : 1.0)
            const enrageBonus = monster.enraged ? 1.5 : 1.0;
            monster.enrageMultiplier = phase.attackMultiplier * enrageBonus;

            return {
                monsterId: monster.id,
                monsterName: monster.name,
                phaseName: phase.name,
                message: phase.message,
                attackMultiplier: phase.attackMultiplier,
                defenceMultiplier: phase.defenceMultiplier,
            };
        }

        return null;
    }

    /** Get current phase stat multipliers for a boss. */
    getBossPhaseMultipliers(monster: MonsterSchema): { attack: number; defence: number; speed: number } {
        if (!monster.isBoss) return { attack: 1, defence: 1, speed: 1 };

        const bossDef = BOSSES[monster.monsterId];
        if (!bossDef || !bossDef.phases) return { attack: 1, defence: 1, speed: 1 };

        const phaseIdx = this.bossPhases.get(monster.id) || 0;
        const phase = bossDef.phases[phaseIdx];
        if (!phase) return { attack: 1, defence: 1, speed: 1 };

        return {
            attack: phase.attackMultiplier,
            defence: phase.defenceMultiplier,
            speed: phase.speedMultiplier,
        };
    }

    /** Reset boss phase tracking (on death/respawn). */
    resetBossPhase(monsterId: string): void {
        this.bossPhases.delete(monsterId);
    }

    // --- Pack aggro ---
    // Find nearby same-type monsters that should join the fight
    findPackMembers(
        attackedMonster: MonsterSchema,
        allMonsters: MapSchema<MonsterSchema>,
        packRadius: number = 6,
    ): MonsterSchema[] {
        const pack: MonsterSchema[] = [];
        allMonsters.forEach((other) => {
            if (other.id === attackedMonster.id) return;
            if (other.isDead || other.inCombat) return;
            if (other.monsterId !== attackedMonster.monsterId) return; // same type only
            const dist = Math.sqrt(
                (other.x - attackedMonster.x) ** 2 + (other.z - attackedMonster.z) ** 2
            );
            if (dist <= packRadius) {
                pack.push(other);
            }
        });
        return pack;
    }
}
