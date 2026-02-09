// ============================================================
// AgentScape — NPC Behavior System (Behavior Tree Edition)
//
// Agents autonomously: patrol zones, fight monsters, pick up
// loot, eat food when low HP, return to town to shop/bank.
// Each role has different behavior priorities.
//
// Features:
//  - Behavior tree per role (cached)
//  - Simulated combat with HP changes
//  - Social interactions between nearby agents
//  - Agent progression (XP, level ups, gear tiers)
//  - Player combat reactions
//  - Hunting party behavior
//  - Quest narration
//  - Death/respawn flavor messages
//
// States: IDLE → CHOOSING → WAITING_PATH → WALKING →
//         WORKING | FIGHTING | RESTING | BANKING
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameMap } from '../utils/MapGenerator';
import { ROLE_BUILDING_WEIGHTS, RESPAWN_TIME, AGENT_DIALOGUE, MONSTERS } from '../config';

// Behavior tree imports
import { BTContext, BTNode, selector, sequence, weightedRandom, condition, action } from '../agents/BehaviorTree';
import { AgentMemory, AgentMemoryManager, CachedNPC } from '../agents/AgentMemory';
import { AgentProfile, getProfile, notecardToProfile,
    SOCIAL_DIALOGUE, PROGRESSION_DIALOGUE, DEATH_DIALOGUE, RESPAWN_DIALOGUE,
    PLAYER_COMBAT_DIALOGUE, QUEST_DIALOGUE, PARTY_DIALOGUE, GEAR_TIER_NAMES,
    RAID_DIALOGUE,
} from '../agents/AgentProfiles';
import {
    randomWalkableInZone,
    randomWalkableNear,
    pickHuntTarget,
    estimateFightDamage,
    getBuildingDoor,
    getShopDoor,
    getTownDoor,
    pickQuest,
} from '../agents/AgentContext';
import { RaidCoordinator } from '../agents/RaidCoordinator';
import { RAID_GATHER_POINTS, AGENT_XP_MULTIPLIER, BOSSES } from '../config';

export interface NPCChatEvent {
    npcId: string;
    npcName: string;
    message: string;
    roleColor: string;
    x: number;
    z: number;
}

export interface PathfindRequest {
    npc: NPCSchema;
    targetX: number;
    targetZ: number;
}

// ---- Helpers ----
function pick(lines: string[]): string {
    return lines[Math.floor(Math.random() * lines.length)];
}

function template(line: string, vars: Record<string, string | number>): string {
    let result = line;
    for (const [k, v] of Object.entries(vars)) {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
    return result;
}

export class NPCBehaviorSystem {
    private map: GameMap;
    private pathfindQueue: PathfindRequest[] = [];
    private memories: AgentMemoryManager = new AgentMemoryManager();
    private behaviorTrees: Map<string, BTNode> = new Map();
    private raidCoordinator: RaidCoordinator | null = null;

    // NPC position cache for social interactions & party detection
    private npcCache: Map<string, CachedNPC> = new Map();

    constructor(map: GameMap) {
        this.map = map;
    }

    setRaidCoordinator(rc: RaidCoordinator): void {
        this.raidCoordinator = rc;
    }

    getPathfindQueue(): PathfindRequest[] {
        return this.pathfindQueue;
    }

    clearPathfindQueue(): void {
        this.pathfindQueue = [];
    }

    removeMemory(npcId: string): void {
        this.memories.remove(npcId);
        this.npcCache.delete(npcId);
    }

    // ================================================================
    // Behavior Tree — built per role, cached
    // ================================================================

    /** Expose memory manager for notecard attachment. */
    getMemoryManager(): AgentMemoryManager {
        return this.memories;
    }

    private getTree(npcId: string, role: string): BTNode {
        // Cache by npcId so each agent's notecard-driven weights are used
        let tree = this.behaviorTrees.get(npcId);
        if (!tree) {
            tree = this.buildTree(npcId, role);
            this.behaviorTrees.set(npcId, tree);
        }
        return tree;
    }

    private buildTree(npcId: string, role: string): BTNode {
        const memory = this.memories.get(npcId);
        const profile = memory.notecard ? notecardToProfile(memory.notecard) : getProfile(role);

        return selector(
            // Priority 1: Survival — eat or flee when low HP
            sequence(
                condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) < profile.eatHpPercent / 100),
                selector(
                    sequence(
                        condition(ctx => ctx.memory.foodCount > 0),
                        action(ctx => { ctx.memory.currentGoal = { type: 'eat', targetX: ctx.npc.x, targetZ: ctx.npc.z }; }),
                    ),
                    sequence(
                        condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) < profile.fleeHpPercent / 100),
                        action(ctx => {
                            const door = getTownDoor(ctx.map);
                            if (door) ctx.memory.currentGoal = { type: 'flee', targetX: door.x, targetZ: door.z };
                        }),
                    ),
                ),
            ),

            // Priority 2: Restock
            sequence(
                condition(ctx => ctx.memory.foodCount <= profile.shopFoodThreshold || ctx.memory.tripsSinceShop >= 4),
                action(ctx => {
                    const door = getShopDoor(ctx.map);
                    if (door) ctx.memory.currentGoal = { type: 'shop', targetX: door.x, targetZ: door.z, buildingId: 'general_store' };
                }),
            ),

            // Priority 2.5: Raid objective (requires level >= 10)
            sequence(
                condition(ctx => ctx.memory.effectiveLevel >= 10),
                condition(ctx => ctx.memory.foodCount > 0),
                condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) > 0.5),
                condition(() => !!this.raidCoordinator),
                action(ctx => {
                    this.evaluateRaidBehavior(ctx.npc, ctx.memory, profile);
                }),
            ),

            // Priority 3: Weighted random — combat, building, patrol, explore
            weightedRandom([
                {
                    weight: profile.combatWeight,
                    node: sequence(
                        condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) > 0.5),
                        condition(ctx => ctx.memory.foodCount > 0),
                        action(ctx => {
                            // Try to join a nearby hunting party first
                            const party = this.findNearbyHunter(ctx.npc.id, ctx.npc.x, ctx.npc.z);
                            if (party) {
                                const pos = randomWalkableNear(party.x, party.z, 5, ctx.map);
                                if (pos) {
                                    ctx.memory.currentGoal = {
                                        type: 'hunt', targetX: pos.x, targetZ: pos.z,
                                        zone: party.goalZone || 'the_forest',
                                        monsterType: party.goalMonsterType || undefined,
                                        monsterName: party.goalMonsterType ? MONSTERS[party.goalMonsterType]?.name : undefined,
                                    };
                                    ctx.memory.partyWith = party.id;
                                    return;
                                }
                            }
                            // Solo hunt with level-aware targeting
                            const target = pickHuntTarget(profile, ctx.map, ctx.memory.effectiveLevel);
                            if (target) {
                                ctx.memory.currentGoal = {
                                    type: 'hunt', targetX: target.x, targetZ: target.z,
                                    zone: target.zone, monsterType: target.monsterType, monsterName: target.monsterName,
                                };
                                ctx.memory.partyWith = null;
                            }
                        }),
                    ),
                },
                {
                    weight: profile.buildingWeight,
                    node: action(ctx => {
                        const buildingId = this.chooseTargetBuilding(ctx.npc.role);
                        const door = getBuildingDoor(buildingId, ctx.map);
                        if (door) ctx.memory.currentGoal = { type: 'work', targetX: door.x, targetZ: door.z, buildingId };
                    }),
                },
                {
                    weight: profile.patrolWeight,
                    node: action(ctx => {
                        const zone = profile.preferredZones[Math.floor(Math.random() * profile.preferredZones.length)] || 'suite_city';
                        const pos = randomWalkableInZone(zone, ctx.map);
                        if (pos) ctx.memory.currentGoal = { type: 'patrol', targetX: pos.x, targetZ: pos.z, zone };
                    }),
                },
                {
                    weight: profile.exploreWeight,
                    node: action(ctx => {
                        const pos = randomWalkableNear(Math.round(ctx.npc.x), Math.round(ctx.npc.z), 15, ctx.map);
                        if (pos) ctx.memory.currentGoal = { type: 'explore', targetX: pos.x, targetZ: pos.z };
                    }),
                },
            ]),
        );
    }

    // ================================================================
    // Building selection
    // ================================================================

    private chooseTargetBuilding(role: string): string {
        const weights = ROLE_BUILDING_WEIGHTS[role] || ROLE_BUILDING_WEIGHTS.aligned;
        const entries = Object.entries(weights);
        const total = entries.reduce((s, [, w]) => s + w, 0);
        let r = Math.random() * total;
        for (const [id, wt] of entries) {
            r -= wt;
            if (r <= 0) return id;
        }
        return entries[0][0];
    }

    // ================================================================
    // Chat helpers
    // ================================================================

    private tryChat(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, lines: string[], events: NPCChatEvent[]): void {
        if (memory.chatCooldown > 0) return;
        events.push({
            npcId: npc.id, npcName: npc.name,
            message: pick(lines),
            roleColor: npc.roleColor, x: npc.x, z: npc.z,
        });
        memory.chatCooldown = profile.chatInterval + Math.random() * 5;
    }

    private emitChat(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, message: string, events: NPCChatEvent[]): void {
        if (memory.chatCooldown > 0) return;
        events.push({
            npcId: npc.id, npcName: npc.name,
            message, roleColor: npc.roleColor, x: npc.x, z: npc.z,
        });
        memory.chatCooldown = profile.chatInterval + Math.random() * 5;
    }

    // ================================================================
    // NPC Cache — track positions for social/party systems
    // ================================================================

    private updateCache(npc: NPCSchema, memory: AgentMemory): void {
        this.npcCache.set(npc.id, {
            id: npc.id,
            x: npc.x,
            z: npc.z,
            name: npc.name,
            role: npc.role,
            state: npc.state,
            goalType: memory.currentGoal?.type || null,
            goalZone: memory.currentGoal?.zone || null,
            goalMonsterType: memory.currentGoal?.monsterType || null,
            effectiveLevel: memory.effectiveLevel,
        });
    }

    // ================================================================
    // Social Interactions — agent-to-agent chat
    // ================================================================

    private trySocialInteraction(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, events: NPCChatEvent[]): void {
        if (memory.socialCooldown > 0 || memory.chatCooldown > 0) return;

        for (const [id, cached] of this.npcCache) {
            if (id === npc.id) continue;
            const dist = Math.abs(cached.x - npc.x) + Math.abs(cached.z - npc.z);
            if (dist > 6) continue;

            // Found a nearby agent — generate social dialogue
            const key = `${npc.role}->${cached.role}`;
            const lines = SOCIAL_DIALOGUE[key] || SOCIAL_DIALOGUE['generic'];
            const line = template(pick(lines), { name: cached.name });

            events.push({
                npcId: npc.id, npcName: npc.name,
                message: line,
                roleColor: npc.roleColor, x: npc.x, z: npc.z,
            });
            memory.addEvent({ timestamp: Date.now(), type: 'social', description: `Talked to ${cached.name} (${cached.role})` });
            memory.socialCooldown = 20 + Math.random() * 15;
            memory.chatCooldown = profile.chatInterval + Math.random() * 5;
            return;
        }
    }

    // ================================================================
    // Party Detection — find nearby hunting agents
    // ================================================================

    private findNearbyHunter(excludeId: string, x: number, z: number): CachedNPC | null {
        for (const [id, cached] of this.npcCache) {
            if (id === excludeId) continue;
            if (cached.state !== 'FIGHTING' && cached.goalType !== 'hunt') continue;
            const dist = Math.abs(cached.x - x) + Math.abs(cached.z - z);
            if (dist < 30) return cached;
        }
        return null;
    }

    // ================================================================
    // Progression — XP gain and level ups
    // ================================================================

    awardXP(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, monsterType: string, events: NPCChatEvent[]): void {
        const monster = MONSTERS[monsterType];
        const baseXp = monster ? monster.level * 5 + Math.floor(Math.random() * monster.level * 2) : 10;
        const xpGain = baseXp * AGENT_XP_MULTIPLIER;
        memory.xp += xpGain;

        // Level formula: sqrt(xp / 15) + 1, capped at 50
        const newLevel = Math.min(50, Math.floor(Math.sqrt(memory.xp / 15)) + 1);

        if (newLevel > memory.effectiveLevel) {
            memory.effectiveLevel = newLevel;
            memory.addEvent({ timestamp: Date.now(), type: 'level_up', description: `Reached level ${newLevel}` });
            const msg = template(pick(PROGRESSION_DIALOGUE.levelUp), { level: newLevel });
            this.emitChat(npc, memory, profile, msg, events);

            // Gear tier upgrades at level thresholds
            const oldTier = memory.gearTier;
            if (newLevel >= 25 && memory.gearTier < 4) memory.gearTier = 4;
            else if (newLevel >= 15 && memory.gearTier < 3) memory.gearTier = 3;
            else if (newLevel >= 8 && memory.gearTier < 2) memory.gearTier = 2;

            if (memory.gearTier > oldTier) {
                const gearMsg = template(pick(PROGRESSION_DIALOGUE.gearUpgrade), { gear: GEAR_TIER_NAMES[memory.gearTier] || 'Unknown' });
                // Queue gear message for next chat opportunity
                memory.chatCooldown = 0;
                this.emitChat(npc, memory, profile, gearMsg, events);
            }
        }
    }

    // ================================================================
    // Quest System — accept, track, complete
    // ================================================================

    private maybeAcceptQuest(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, events: NPCChatEvent[]): void {
        if (memory.currentQuestId) return; // Already on a quest
        if (Math.random() > 0.15) return;  // 15% chance when idle

        const quest = pickQuest(profile.preferredZones);
        if (!quest) return;

        memory.currentQuestId = quest.questId;
        memory.currentQuestName = quest.questName;
        memory.questMonsterType = quest.monsterType;
        memory.questKillTarget = quest.killTarget;
        memory.questKillCount = 0;

        const msg = template(pick(QUEST_DIALOGUE.accept), { quest: quest.questName });
        this.emitChat(npc, memory, profile, msg, events);
    }

    private trackQuestKill(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, monsterType: string, events: NPCChatEvent[]): void {
        if (!memory.currentQuestId || memory.questMonsterType !== monsterType) return;

        memory.questKillCount++;

        // Progress update at ~33% and ~66%
        const pct = memory.questKillCount / memory.questKillTarget;
        if ((pct > 0.3 && pct < 0.4) || (pct > 0.6 && pct < 0.7)) {
            const monsterName = MONSTERS[monsterType]?.name || monsterType;
            const msg = template(pick(QUEST_DIALOGUE.progress), {
                kills: memory.questKillCount, target: memory.questKillTarget, monster: monsterName,
            });
            this.emitChat(npc, memory, profile, msg, events);
        }

        // Quest complete
        if (memory.questKillCount >= memory.questKillTarget) {
            memory.questsCompleted++;
            memory.addEvent({ timestamp: Date.now(), type: 'quest_complete', description: `Completed quest: ${memory.currentQuestName} (#${memory.questsCompleted} total)` });
            const msg = template(pick(QUEST_DIALOGUE.complete), {
                quest: memory.currentQuestName, total: memory.questsCompleted,
            });
            this.emitChat(npc, memory, profile, msg, events);

            // Bonus coins for quest completion
            memory.coins += 20 + Math.floor(Math.random() * 30);
            memory.currentQuestId = null;
            memory.questMonsterType = null;
        }
    }

    // ================================================================
    // Main update — called every tick (100ms) per NPC
    // ================================================================

    updateNPC(npc: NPCSchema, dt: number): NPCChatEvent[] {
        const events: NPCChatEvent[] = [];
        const memory = this.memories.get(npc.id);
        const profile = memory.notecard ? notecardToProfile(memory.notecard) : getProfile(npc.role);

        // Tick cooldowns
        if (memory.chatCooldown > 0) memory.chatCooldown -= dt;
        if (memory.socialCooldown > 0) memory.socialCooldown -= dt;

        // Update NPC position cache for social/party systems
        this.updateCache(npc, memory);

        // ---- Dead: wait for respawn ----
        if (npc.isDead) {
            npc.activity = 'Dead';
            npc.respawnTimer -= dt;
            // Death announcement (once)
            if (!memory.deathAnnounced) {
                memory.deathAnnounced = true;
                const msg = template(pick(DEATH_DIALOGUE), { monster: memory.lastDeathMonster || 'something' });
                events.push({
                    npcId: npc.id, npcName: npc.name,
                    message: msg,
                    roleColor: npc.roleColor, x: npc.x, z: npc.z,
                });
            }
            return events;
        }

        // ---- Respawn detection ----
        if (memory.deathAnnounced) {
            memory.deathAnnounced = false;
            memory.foodCount = 3;
            memory.coins = Math.max(memory.coins - 20, 10);
            memory.currentGoal = null;
            memory.partyWith = null;
            npc.activity = 'Idle';
            const n = memory.totalDeaths;
            const msg = template(pick(RESPAWN_DIALOGUE), { n, monster: memory.lastDeathMonster || 'something' });
            memory.chatCooldown = 0;
            events.push({
                npcId: npc.id, npcName: npc.name,
                message: msg,
                roleColor: npc.roleColor, x: npc.x, z: npc.z,
            });
        }

        // ---- Player combat reaction ----
        if (npc.inCombat) {
            if (!memory.wasInPlayerCombat) {
                memory.wasInPlayerCombat = true;
                const lines = PLAYER_COMBAT_DIALOGUE[npc.role] || PLAYER_COMBAT_DIALOGUE.aligned;
                memory.chatCooldown = 0;
                this.tryChat(npc, memory, profile, lines, events);
            }
            return events;
        }
        if (memory.wasInPlayerCombat) {
            memory.wasInPlayerCombat = false;
        }

        // ---- State machine ----
        switch (npc.state) {
            case 'IDLE':
                npc.stateTimer -= dt;
                if (npc.stateTimer <= 0) {
                    // Maybe accept a quest
                    this.maybeAcceptQuest(npc, memory, profile, events);

                    // Evaluate behavior tree to pick next goal
                    memory.currentGoal = null;
                    const ctx: BTContext = { npc, memory, profile, map: this.map };
                    this.getTree(npc.id, npc.role)(ctx);

                    if (memory.currentGoal) {
                        this.executeGoal(npc, memory, profile, events);
                    } else {
                        npc.stateTimer = 2 + Math.random() * 3;
                    }
                }

                // Social interaction check while idle
                if (Math.random() < 0.002) {
                    this.trySocialInteraction(npc, memory, profile, events);
                }

                // Rare ambient chat
                if (Math.random() < 0.0003) {
                    const lines = AGENT_DIALOGUE[npc.role] || AGENT_DIALOGUE.aligned;
                    this.tryChat(npc, memory, profile, lines, events);
                }
                break;

            case 'CHOOSING':
                if (memory.currentGoal) {
                    this.pathfindQueue.push({
                        npc,
                        targetX: memory.currentGoal.targetX,
                        targetZ: memory.currentGoal.targetZ,
                    });
                    npc.state = 'WAITING_PATH';
                    npc.stateTimer = 10;
                } else {
                    npc.state = 'IDLE';
                    npc.stateTimer = 2 + Math.random() * 3;
                }
                break;

            case 'WAITING_PATH':
                npc.stateTimer -= dt;
                if (npc.path.length > 1) {
                    npc.state = 'WALKING';
                    npc.pathIndex = 1;
                    npc.moveProgress = 0;
                    npc.moveFromX = npc.path[0].x;
                    npc.moveFromZ = npc.path[0].z;
                    npc.moveToX = npc.path[1].x;
                    npc.moveToZ = npc.path[1].z;
                } else if (npc.stateTimer <= 0) {
                    npc.state = 'IDLE';
                    npc.stateTimer = 2 + Math.random() * 4;
                }
                break;

            case 'WALKING':
                // Social interaction while walking past other agents
                if (Math.random() < 0.001) {
                    this.trySocialInteraction(npc, memory, profile, events);
                }
                break;

            case 'WORKING':
                // Intercept: MovementSystem sets ALL NPCs to WORKING on arrival.
                // If our goal isn't 'work', redirect to the right state.
                if (memory.currentGoal && memory.currentGoal.type !== 'work') {
                    this.onPathComplete(npc, events);
                    break;
                }
                npc.workTimer -= dt;
                if (npc.workTimer > 1 && Math.random() < 0.001) {
                    this.tryChat(npc, memory, profile, profile.dialogue.working, events);
                }
                if (npc.workTimer <= 0) {
                    npc.state = 'IDLE';
                    npc.activity = 'Idle';
                    npc.stateTimer = 3 + Math.random() * 5;
                    memory.currentGoal = null;
                }
                break;

            case 'FIGHTING':
                this.updateFighting(npc, memory, profile, dt, events);
                break;

            case 'REAL_COMBAT':
                // Handled by AgentCombatAdapter in room game loop.
                // We just handle chat and flee detection here.
                if (Math.random() < 0.002 && memory.notecard) {
                    const role = memory.notecard.race;
                    const fightLines = RAID_DIALOGUE[role]?.fight || ['Fighting!'];
                    this.tryChat(npc, memory, profile, fightLines, events);
                }
                break;

            case 'RESTING':
                this.updateResting(npc, memory, profile, dt, events);
                break;

            case 'BANKING':
                this.updateBanking(npc, memory, profile, dt, events);
                break;

            default:
                npc.state = 'IDLE';
                npc.stateTimer = 2 + Math.random() * 3;
                break;
        }

        return events;
    }

    // ================================================================
    // Goal execution
    // ================================================================

    private executeGoal(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, events: NPCChatEvent[]): void {
        const goal = memory.currentGoal!;

        switch (goal.type) {
            case 'eat':
                npc.state = 'RESTING';
                npc.activity = 'Eating';
                memory.restTimer = 1.0 + Math.random() * 0.5;
                this.tryChat(npc, memory, profile, profile.dialogue.eating, events);
                break;

            case 'flee':
                npc.activity = 'Fleeing';
                this.tryChat(npc, memory, profile, profile.dialogue.fleeing, events);
                npc.state = 'CHOOSING';
                break;

            case 'shop':
                npc.activity = 'Shopping';
                this.tryChat(npc, memory, profile, profile.dialogue.shopping, events);
                npc.state = 'CHOOSING';
                break;

            case 'hunt':
                npc.activity = 'Hunting ' + (goal.monsterName || 'monster');
                // Party chat if joining someone
                if (memory.partyWith) {
                    const partner = this.npcCache.get(memory.partyWith);
                    if (partner) {
                        const msg = template(pick(PARTY_DIALOGUE.join), { name: partner.name });
                        this.emitChat(npc, memory, profile, msg, events);
                        memory.addEvent({ timestamp: Date.now(), type: 'party_formed', description: `Joined ${partner.name} for hunting` });
                    }
                } else {
                    this.tryChat(npc, memory, profile, profile.dialogue.hunting, events);
                }
                memory.tripsSinceShop++;
                memory.sessionsHunted++;
                npc.state = 'CHOOSING';
                break;

            case 'work':
                npc.activity = 'Working at ' + (goal.buildingId || 'building');
                this.tryChat(npc, memory, profile, profile.dialogue.working, events);
                npc.state = 'CHOOSING';
                break;

            case 'patrol':
                npc.activity = 'Patrolling ' + (goal.zone || 'area');
                this.tryChat(npc, memory, profile, profile.dialogue.patrolling, events);
                memory.tripsSinceShop++;
                npc.state = 'CHOOSING';
                break;

            case 'explore':
                npc.activity = 'Exploring';
                npc.state = 'CHOOSING';
                break;

            case 'raid_gather':
            case 'raid_travel':
                npc.activity = 'Traveling to raid';
                npc.state = 'CHOOSING';
                break;

            case 'raid_fight':
                // Will transition to REAL_COMBAT on path completion
                npc.activity = 'Charging boss!';
                npc.state = 'CHOOSING';
                break;

            case 'supply_run':
                npc.activity = 'Resupplying for raid';
                npc.state = 'CHOOSING';
                break;

            default:
                npc.state = 'IDLE';
                npc.activity = 'Idle';
                npc.stateTimer = 3 + Math.random() * 4;
                break;
        }
    }

    // ================================================================
    // RAID BEHAVIOR — evaluate whether to join/start/scout raids
    // ================================================================

    private evaluateRaidBehavior(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile): void {
        if (!this.raidCoordinator) return;
        const nc = memory.notecard;
        if (!nc) return;

        // Already in raid state — continue
        if (memory.raidState === 'traveling' || memory.raidState === 'fighting') return;

        // Check for active rally to join
        const rallies = this.raidCoordinator.getActiveRallies();
        for (const rally of rallies) {
            if (rally.memberIds.has(npc.id)) continue; // already joined
            if (this.raidCoordinator.shouldJoinRaid(nc, memory, rally.memberIds.size, rally.targetBossId)) {
                this.raidCoordinator.joinRally(rally.id, npc.id);
                memory.raidPartyId = rally.id;
                memory.raidState = 'preparing';
                memory.raidRole = this.raidCoordinator.determineRaidRole(nc);
                memory.targetBossId = rally.targetBossId;

                // Travel to gather point
                const gp = rally.gatherPoint;
                memory.currentGoal = { type: 'raid_gather', targetX: gp.x, targetZ: gp.z };
                npc.activity = 'Rallying for ' + (BOSSES[rally.targetBossId]?.name || 'boss');

                // Recruit chat
                const recruitLines = RAID_DIALOGUE[nc.race]?.recruit || ['Join us for the raid!'];
                const line = recruitLines[Math.floor(Math.random() * recruitLines.length)];
                this.emitChat(npc, memory, profile, line.replace('{name}', ''), []);
                memory.addEvent({ timestamp: Date.now(), type: 'raid_join', description: `Joined rally for ${BOSSES[rally.targetBossId]?.name || 'boss'}` });
                return;
            }
        }

        // No rally exists — consider starting one
        if (memory.effectiveLevel >= 15 && nc.aggression > 45 && Math.random() < 0.01) {
            const bossId = this.raidCoordinator.pickBossTarget(memory.effectiveLevel, nc.aggression);
            if (bossId) {
                const rally = this.raidCoordinator.createRally(npc, bossId);
                if (rally) {
                    memory.raidPartyId = rally.id;
                    memory.raidState = 'preparing';
                    memory.raidRole = this.raidCoordinator.determineRaidRole(nc);
                    memory.targetBossId = bossId;

                    const gp = rally.gatherPoint;
                    memory.currentGoal = { type: 'raid_gather', targetX: gp.x, targetZ: gp.z };
                    npc.activity = 'Rallying for ' + (BOSSES[bossId]?.name || 'boss');

                    const rallyLines = RAID_DIALOGUE[nc.race]?.rally || ['Raid forming!'];
                    this.emitChat(npc, memory, profile, rallyLines[Math.floor(Math.random() * rallyLines.length)], []);
                    memory.addEvent({ timestamp: Date.now(), type: 'rally_call', description: `Called rally for ${BOSSES[bossId]?.name || 'boss'}` });
                    return;
                }
            }
        }

        // Scout boss zone if high curiosity and low knowledge
        if (nc.curiosity > 50 && memory.dragonKnowledge < 50 && memory.effectiveLevel >= 12 && Math.random() < 0.005) {
            const bossId = this.raidCoordinator.pickBossTarget(memory.effectiveLevel, nc.aggression);
            if (bossId) {
                const gp = RAID_GATHER_POINTS[bossId];
                if (gp) {
                    memory.currentGoal = { type: 'explore', targetX: gp.x, targetZ: gp.z };
                    npc.activity = 'Scouting ' + (BOSSES[bossId]?.name || 'boss area');
                    memory.dragonKnowledge = Math.min(100, memory.dragonKnowledge + 3);
                    return;
                }
            }
        }
    }

    // ================================================================
    // FIGHTING state — simulate combat with monsters
    // ================================================================

    private updateFighting(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        memory.fightTimer -= dt;

        // Simulate periodic damage
        if (Math.random() < dt * 0.3) {
            const dmg = Math.max(1, Math.floor(memory.fightDamage * (0.3 + Math.random() * 0.4)));
            npc.hp = Math.max(0, npc.hp - dmg);
        }

        // Mid-fight eat
        if (npc.hp > 0 && (npc.hp / npc.maxHp) < profile.eatHpPercent / 100 && memory.foodCount > 0) {
            memory.foodCount--;
            const healAmt = 10 + Math.floor(Math.random() * 5);
            npc.hp = Math.min(npc.maxHp, npc.hp + healAmt);
            this.tryChat(npc, memory, profile, profile.dialogue.eating, events);
        }

        // Death
        if (npc.hp <= 0) {
            npc.hp = 0;
            npc.isDead = true;
            npc.respawnTimer = RESPAWN_TIME;
            memory.totalDeaths++;
            memory.lastDeathMonster = memory.fightMonsterName;
            memory.addEvent({ timestamp: Date.now(), type: 'death', description: `Killed by ${memory.fightMonsterName}` });
            memory.currentGoal = null;
            memory.fightTimer = 0;
            return;
        }

        // Victory
        if (memory.fightTimer <= 0) {
            memory.killCount++;
            memory.totalKills++;
            memory.addEvent({ timestamp: Date.now(), type: 'kill', description: `Defeated ${memory.fightMonsterName} (kill #${memory.totalKills})` });

            // Progression: award XP
            const monsterType = memory.currentGoal?.monsterType || 'spam_bot';
            this.awardXP(npc, memory, profile, monsterType, events);

            // Quest tracking
            this.trackQuestKill(npc, memory, profile, monsterType, events);

            // Victory chat (if XP/quest didn't already chat)
            this.tryChat(npc, memory, profile, profile.dialogue.victory, events);

            // Loot
            memory.coins += 5 + Math.floor(Math.random() * 20);
            if (Math.random() < 0.2) {
                memory.foodCount = Math.min(memory.foodCount + 1, profile.maxFoodCarry);
            }

            // Continue hunting?
            if (memory.foodCount > 0 && (npc.hp / npc.maxHp) > 0.4 && Math.random() < 0.6) {
                const pos = randomWalkableNear(Math.round(npc.x), Math.round(npc.z), 8, this.map);
                if (pos && memory.currentGoal?.monsterType) {
                    this.pathfindQueue.push({ npc, targetX: pos.x, targetZ: pos.z });
                    npc.state = 'WAITING_PATH';
                    npc.stateTimer = 5;
                    return;
                }
            }

            npc.state = 'IDLE';
            npc.activity = 'Idle';
            npc.stateTimer = 2 + Math.random() * 4;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // RESTING state
    // ================================================================

    private updateResting(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        memory.restTimer -= dt;
        if (memory.restTimer <= 0) {
            if (memory.foodCount > 0) {
                memory.foodCount--;
                const healAmt = 10 + Math.floor(Math.random() * 8);
                npc.hp = Math.min(npc.maxHp, npc.hp + healAmt);
            }
            npc.state = 'IDLE';
            npc.activity = 'Idle';
            npc.stateTimer = 1 + Math.random() * 2;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // BANKING state
    // ================================================================

    private updateBanking(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        npc.workTimer -= dt;
        if (npc.workTimer <= 0) {
            const bought = Math.min(profile.maxFoodCarry - memory.foodCount, 3 + Math.floor(Math.random() * 3));
            memory.foodCount += bought;
            memory.coins = Math.max(0, memory.coins - bought * 10);
            memory.tripsSinceShop = 0;
            npc.hp = Math.min(npc.maxHp, npc.hp + Math.floor(npc.maxHp * 0.2));
            npc.state = 'IDLE';
            npc.activity = 'Idle';
            npc.stateTimer = 2 + Math.random() * 3;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // Path completion handler
    // ================================================================

    onPathComplete(npc: NPCSchema, events: NPCChatEvent[] = []): void {
        const memory = this.memories.get(npc.id);
        const profile = memory.notecard ? notecardToProfile(memory.notecard) : getProfile(npc.role);
        const goal = memory.currentGoal;

        if (!goal) {
            npc.state = 'WORKING';
            npc.workTimer = 5 + Math.random() * 10;
            return;
        }

        switch (goal.type) {
            case 'hunt': {
                npc.state = 'FIGHTING';
                const monsterType = goal.monsterType || 'spam_bot';
                memory.fightTimer = profile.fightDurationBase + (Math.random() * 2 - 1) * profile.fightDurationVar;
                memory.fightDamage = estimateFightDamage(monsterType, npc.combatStats);
                memory.fightMonsterName = goal.monsterName || 'monster';
                npc.activity = 'Fighting ' + memory.fightMonsterName;
                this.tryChat(npc, memory, profile, profile.dialogue.fightStart, events);
                break;
            }

            case 'shop':
            case 'flee':
                npc.state = 'BANKING';
                npc.workTimer = 3 + Math.random() * 4;
                break;

            case 'work':
                npc.state = 'WORKING';
                npc.targetBuilding = goal.buildingId || null;
                npc.workTimer = 5 + Math.random() * 10;
                break;

            case 'patrol':
            case 'explore':
                npc.state = 'IDLE';
                npc.activity = 'Idle';
                npc.stateTimer = 2 + Math.random() * 5;
                memory.currentGoal = null;
                break;

            case 'raid_gather':
                // Arrived at gather point — wait for launch
                npc.state = 'IDLE';
                npc.activity = 'Waiting for raid';
                npc.stateTimer = 2 + Math.random() * 3;
                memory.raidState = 'preparing';
                // Check if we should launch
                if (this.raidCoordinator && memory.raidPartyId) {
                    const rally = this.raidCoordinator.getRally(memory.raidPartyId);
                    if (rally && this.raidCoordinator.shouldLaunchRaid(rally, this.memories)) {
                        this.raidCoordinator.launchRaid(rally.id);
                        // All gathered members get raid_fight goal
                        const bossDef = BOSSES[rally.targetBossId];
                        const bossSpawn = bossDef?.spawnPos;
                        if (bossSpawn) {
                            for (const memberId of rally.memberIds) {
                                const memberMem = this.memories.get(memberId);
                                memberMem.raidState = 'traveling';
                                memberMem.currentGoal = {
                                    type: 'raid_fight',
                                    targetX: bossSpawn.x,
                                    targetZ: bossSpawn.z,
                                    monsterType: rally.targetBossId,
                                    monsterName: bossDef?.name,
                                };
                            }
                        }
                    }
                }
                memory.currentGoal = null;
                break;

            case 'raid_fight':
                // Arrived at boss — transition to REAL_COMBAT
                // The AgentCombatAdapter will handle actual engagement
                npc.state = 'REAL_COMBAT';
                npc.activity = 'Fighting ' + (goal.monsterName || 'boss');
                memory.raidState = 'fighting';
                memory.raidAttempts++;
                memory.addEvent({ timestamp: Date.now(), type: 'raid_engage', description: `Engaging ${goal.monsterName || 'boss'}` });
                // Don't clear goal — room will use it to know which boss to engage
                break;

            case 'supply_run':
                npc.state = 'BANKING';
                npc.workTimer = 3 + Math.random() * 4;
                break;

            default:
                npc.state = 'WORKING';
                npc.workTimer = 5 + Math.random() * 10;
                break;
        }
    }
}
