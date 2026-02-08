// ============================================================
// AgentScape — NPC Behavior System (Behavior Tree Edition)
//
// Agents autonomously: patrol zones, fight monsters, pick up
// loot, eat food when low HP, return to town to shop/bank.
// Each role has different behavior priorities.
//
// States: IDLE → CHOOSING → WAITING_PATH → WALKING →
//         WORKING | FIGHTING | RESTING | BANKING
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameMap } from '../utils/MapGenerator';
import { ROLE_BUILDING_WEIGHTS, RESPAWN_TIME, AGENT_DIALOGUE } from '../config';

// Behavior tree imports
import { BTContext, BTNode, selector, sequence, weightedRandom, condition, action } from '../agents/BehaviorTree';
import { AgentMemory, AgentMemoryManager } from '../agents/AgentMemory';
import { AgentProfile, getProfile } from '../agents/AgentProfiles';
import {
    randomWalkableInZone,
    randomWalkableNear,
    pickHuntTarget,
    estimateFightDamage,
    getBuildingDoor,
    getShopDoor,
    getTownDoor,
} from '../agents/AgentContext';

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

// ---- Pick a random line from a dialogue array ----
function pick(lines: string[]): string {
    return lines[Math.floor(Math.random() * lines.length)];
}

export class NPCBehaviorSystem {
    private map: GameMap;
    private pathfindQueue: PathfindRequest[] = [];
    private memories: AgentMemoryManager = new AgentMemoryManager();
    private behaviorTrees: Map<string, BTNode> = new Map(); // role → tree

    constructor(map: GameMap) {
        this.map = map;
    }

    getPathfindQueue(): PathfindRequest[] {
        return this.pathfindQueue;
    }

    clearPathfindQueue(): void {
        this.pathfindQueue = [];
    }

    // ---- Memory access (for cleanup) ----
    removeMemory(npcId: string): void {
        this.memories.remove(npcId);
    }

    // ================================================================
    // Behavior Tree — built per role, cached
    // ================================================================

    private getTree(role: string): BTNode {
        let tree = this.behaviorTrees.get(role);
        if (!tree) {
            tree = this.buildTree(role);
            this.behaviorTrees.set(role, tree);
        }
        return tree;
    }

    private buildTree(role: string): BTNode {
        const profile = getProfile(role);

        return selector(
            // Priority 1: Survival — eat or flee when low HP
            sequence(
                condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) < profile.eatHpPercent / 100),
                selector(
                    // Eat food if available
                    sequence(
                        condition(ctx => ctx.memory.foodCount > 0),
                        action(ctx => { ctx.memory.currentGoal = { type: 'eat', targetX: ctx.npc.x, targetZ: ctx.npc.z }; }),
                    ),
                    // Flee to town if no food
                    sequence(
                        condition(ctx => (ctx.npc.hp / ctx.npc.maxHp) < profile.fleeHpPercent / 100),
                        action(ctx => {
                            const door = getTownDoor(ctx.map);
                            if (door) {
                                ctx.memory.currentGoal = { type: 'flee', targetX: door.x, targetZ: door.z };
                            }
                        }),
                    ),
                ),
            ),

            // Priority 2: Restock — go shop when out of food or after many trips
            sequence(
                condition(ctx => ctx.memory.foodCount <= profile.shopFoodThreshold || ctx.memory.tripsSinceShop >= 4),
                action(ctx => {
                    const door = getShopDoor(ctx.map);
                    if (door) {
                        ctx.memory.currentGoal = { type: 'shop', targetX: door.x, targetZ: door.z, buildingId: 'general_store' };
                    }
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
                            const target = pickHuntTarget(profile, ctx.map);
                            if (target) {
                                ctx.memory.currentGoal = {
                                    type: 'hunt',
                                    targetX: target.x,
                                    targetZ: target.z,
                                    zone: target.zone,
                                    monsterType: target.monsterType,
                                    monsterName: target.monsterName,
                                };
                            }
                        }),
                    ),
                },
                {
                    weight: profile.buildingWeight,
                    node: action(ctx => {
                        const buildingId = this.chooseTargetBuilding(ctx.npc.role);
                        const door = getBuildingDoor(buildingId, ctx.map);
                        if (door) {
                            ctx.memory.currentGoal = { type: 'work', targetX: door.x, targetZ: door.z, buildingId };
                        }
                    }),
                },
                {
                    weight: profile.patrolWeight,
                    node: action(ctx => {
                        const zone = profile.preferredZones[Math.floor(Math.random() * profile.preferredZones.length)] || 'suite_city';
                        const pos = randomWalkableInZone(zone, ctx.map);
                        if (pos) {
                            ctx.memory.currentGoal = { type: 'patrol', targetX: pos.x, targetZ: pos.z, zone };
                        }
                    }),
                },
                {
                    weight: profile.exploreWeight,
                    node: action(ctx => {
                        // Explore: wander near current position
                        const pos = randomWalkableNear(Math.round(ctx.npc.x), Math.round(ctx.npc.z), 15, ctx.map);
                        if (pos) {
                            ctx.memory.currentGoal = { type: 'explore', targetX: pos.x, targetZ: pos.z };
                        }
                    }),
                },
            ]),
        );
    }

    // ================================================================
    // Building selection (kept from original for WORK goals)
    // ================================================================

    private chooseTargetBuilding(role: string): string {
        const weights = ROLE_BUILDING_WEIGHTS[role] || ROLE_BUILDING_WEIGHTS.app_builder;
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
    // Chat helper — respects cooldown
    // ================================================================

    private tryChat(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, lines: string[], events: NPCChatEvent[]): void {
        if (memory.chatCooldown > 0) return;
        events.push({
            npcId: npc.id,
            npcName: npc.name,
            message: pick(lines),
            roleColor: npc.roleColor,
            x: npc.x,
            z: npc.z,
        });
        memory.chatCooldown = profile.chatInterval + Math.random() * 5;
    }

    // ================================================================
    // Main update — called every tick (100ms) per NPC
    // ================================================================

    updateNPC(npc: NPCSchema, dt: number): NPCChatEvent[] {
        const events: NPCChatEvent[] = [];
        const memory = this.memories.get(npc.id);
        const profile = getProfile(npc.role);

        // Tick cooldowns
        if (memory.chatCooldown > 0) memory.chatCooldown -= dt;

        // ---- Dead: wait for respawn ----
        if (npc.isDead) {
            npc.respawnTimer -= dt;
            return events;
        }

        // ---- In player combat: handled by CombatSystem ----
        if (npc.inCombat) return events;

        // ---- State machine ----
        switch (npc.state) {
            case 'IDLE':
                npc.stateTimer -= dt;
                if (npc.stateTimer <= 0) {
                    // Evaluate behavior tree to pick next goal
                    memory.currentGoal = null;
                    const ctx: BTContext = { npc, memory, profile, map: this.map };
                    this.getTree(npc.role)(ctx);

                    if (memory.currentGoal) {
                        this.executeGoal(npc, memory, profile, events);
                    } else {
                        // Fallback: short idle, try again
                        npc.stateTimer = 2 + Math.random() * 3;
                    }
                }

                // Rare ambient chat while idle
                if (Math.random() < 0.0003) {
                    const lines = AGENT_DIALOGUE[npc.role] || AGENT_DIALOGUE.app_builder;
                    this.tryChat(npc, memory, profile, lines, events);
                }
                break;

            case 'CHOOSING':
                // Goal already set, initiate pathfind
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
                    // Pathfinding timed out, go back to idle
                    npc.state = 'IDLE';
                    npc.stateTimer = 2 + Math.random() * 4;
                }
                break;

            case 'WALKING':
                // Movement handled by MovementSystem.
                // When path completes, MovementSystem will set state
                // based on the current goal type.
                break;

            case 'WORKING':
                // Intercept: MovementSystem sets ALL NPCs to WORKING on path
                // completion. If our goal isn't 'work', redirect to the right state.
                if (memory.currentGoal && memory.currentGoal.type !== 'work') {
                    this.onPathComplete(npc, events);
                    break;
                }
                npc.workTimer -= dt;
                // Chat about work occasionally
                if (npc.workTimer > 1 && Math.random() < 0.001) {
                    this.tryChat(npc, memory, profile, profile.dialogue.working, events);
                }
                if (npc.workTimer <= 0) {
                    npc.state = 'IDLE';
                    npc.stateTimer = 3 + Math.random() * 5;
                    memory.currentGoal = null;
                }
                break;

            case 'FIGHTING':
                this.updateFighting(npc, memory, profile, dt, events);
                break;

            case 'RESTING':
                this.updateResting(npc, memory, profile, dt, events);
                break;

            case 'BANKING':
                this.updateBanking(npc, memory, profile, dt, events);
                break;

            default:
                // Unknown state, reset to IDLE
                npc.state = 'IDLE';
                npc.stateTimer = 2 + Math.random() * 3;
                break;
        }

        return events;
    }

    // ================================================================
    // Goal execution — transitions from IDLE to the right state
    // ================================================================

    private executeGoal(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, events: NPCChatEvent[]): void {
        const goal = memory.currentGoal!;

        switch (goal.type) {
            case 'eat':
                // Eat immediately (no movement needed)
                npc.state = 'RESTING';
                memory.restTimer = 1.0 + Math.random() * 0.5;
                this.tryChat(npc, memory, profile, profile.dialogue.eating, events);
                break;

            case 'flee':
                // Chat about fleeing, then pathfind to town
                this.tryChat(npc, memory, profile, profile.dialogue.fleeing, events);
                npc.state = 'CHOOSING';
                break;

            case 'shop':
                this.tryChat(npc, memory, profile, profile.dialogue.shopping, events);
                npc.state = 'CHOOSING';
                break;

            case 'hunt':
                this.tryChat(npc, memory, profile, profile.dialogue.hunting, events);
                memory.tripsSinceShop++;
                memory.sessionsHunted++;
                npc.state = 'CHOOSING';
                break;

            case 'work':
                this.tryChat(npc, memory, profile, profile.dialogue.working, events);
                npc.state = 'CHOOSING';
                break;

            case 'patrol':
                this.tryChat(npc, memory, profile, profile.dialogue.patrolling, events);
                memory.tripsSinceShop++;
                npc.state = 'CHOOSING';
                break;

            case 'explore':
                npc.state = 'CHOOSING';
                break;

            default:
                npc.state = 'IDLE';
                npc.stateTimer = 3 + Math.random() * 4;
                break;
        }
    }

    // ================================================================
    // FIGHTING state — simulate combat with monsters
    // ================================================================

    private updateFighting(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        memory.fightTimer -= dt;

        // Simulate taking periodic damage during the fight
        if (Math.random() < dt * 0.3) {
            const dmg = Math.max(1, Math.floor(memory.fightDamage * (0.3 + Math.random() * 0.4)));
            npc.hp = Math.max(0, npc.hp - dmg);
        }

        // Mid-fight survival check: eat food if low
        if (npc.hp > 0 && (npc.hp / npc.maxHp) < profile.eatHpPercent / 100 && memory.foodCount > 0) {
            memory.foodCount--;
            const healAmt = 10 + Math.floor(Math.random() * 5);
            npc.hp = Math.min(npc.maxHp, npc.hp + healAmt);
            this.tryChat(npc, memory, profile, profile.dialogue.eating, events);
        }

        // Check if NPC died during fight
        if (npc.hp <= 0) {
            npc.hp = 0;
            npc.isDead = true;
            npc.respawnTimer = RESPAWN_TIME;
            memory.totalDeaths++;
            memory.currentGoal = null;
            memory.fightTimer = 0;
            return;
        }

        // Check if fight is over (timer expired = victory)
        if (memory.fightTimer <= 0) {
            // Victory!
            memory.killCount++;
            memory.totalKills++;
            this.tryChat(npc, memory, profile, profile.dialogue.victory, events);

            // Simulate loot: gain some coins
            memory.coins += 5 + Math.floor(Math.random() * 20);

            // Small chance of food drop
            if (Math.random() < 0.2) {
                memory.foodCount = Math.min(memory.foodCount + 1, profile.maxFoodCarry);
            }

            // After victory, stay in zone briefly or start new fight
            if (memory.foodCount > 0 && (npc.hp / npc.maxHp) > 0.4 && Math.random() < 0.6) {
                // Hunt another monster nearby — move to new position, onPathComplete will re-init fight
                const pos = randomWalkableNear(Math.round(npc.x), Math.round(npc.z), 8, this.map);
                if (pos && memory.currentGoal?.monsterType) {
                    this.pathfindQueue.push({ npc, targetX: pos.x, targetZ: pos.z });
                    npc.state = 'WAITING_PATH';
                    npc.stateTimer = 5;
                    return;
                }
            }

            // Done hunting, go back to idle
            npc.state = 'IDLE';
            npc.stateTimer = 2 + Math.random() * 4;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // RESTING state — eating food, brief heal pause
    // ================================================================

    private updateResting(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        memory.restTimer -= dt;

        if (memory.restTimer <= 0) {
            // Heal from food
            if (memory.foodCount > 0) {
                memory.foodCount--;
                const healAmt = 10 + Math.floor(Math.random() * 8);
                npc.hp = Math.min(npc.maxHp, npc.hp + healAmt);
            }

            // Return to idle to re-evaluate
            npc.state = 'IDLE';
            npc.stateTimer = 1 + Math.random() * 2;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // BANKING state — at shop, simulate buying supplies
    // ================================================================

    private updateBanking(npc: NPCSchema, memory: AgentMemory, profile: AgentProfile, dt: number, events: NPCChatEvent[]): void {
        npc.workTimer -= dt;

        if (npc.workTimer <= 0) {
            // Simulate buying food
            const bought = Math.min(profile.maxFoodCarry - memory.foodCount, 3 + Math.floor(Math.random() * 3));
            memory.foodCount += bought;
            memory.coins = Math.max(0, memory.coins - bought * 10);
            memory.tripsSinceShop = 0;

            // Heal a bit while in town
            npc.hp = Math.min(npc.maxHp, npc.hp + Math.floor(npc.maxHp * 0.2));

            // Done shopping
            npc.state = 'IDLE';
            npc.stateTimer = 2 + Math.random() * 3;
            memory.currentGoal = null;
        }
    }

    // ================================================================
    // Called by MovementSystem when NPC path completes
    // (NPCs arrive at their destination)
    // ================================================================

    onPathComplete(npc: NPCSchema, events: NPCChatEvent[] = []): void {
        const memory = this.memories.get(npc.id);
        const profile = getProfile(npc.role);
        const goal = memory.currentGoal;

        if (!goal) {
            // No goal, default to WORKING at building
            npc.state = 'WORKING';
            npc.workTimer = 5 + Math.random() * 10;
            return;
        }

        switch (goal.type) {
            case 'hunt': {
                // Arrived at monster zone — start fighting!
                npc.state = 'FIGHTING';
                const monsterType = goal.monsterType || 'spam_bot';
                memory.fightTimer = profile.fightDurationBase + (Math.random() * 2 - 1) * profile.fightDurationVar;
                memory.fightDamage = estimateFightDamage(monsterType, npc.combatStats);
                memory.fightMonsterName = goal.monsterName || 'monster';
                this.tryChat(npc, memory, profile, profile.dialogue.fightStart, events);
                break;
            }

            case 'shop':
            case 'flee':
                // Arrived at shop or town — simulate shopping
                npc.state = 'BANKING';
                npc.workTimer = 3 + Math.random() * 4;
                break;

            case 'work':
                // Arrived at building — do work
                npc.state = 'WORKING';
                npc.targetBuilding = goal.buildingId || null;
                npc.workTimer = 5 + Math.random() * 10;
                break;

            case 'patrol':
            case 'explore':
                // Arrived at patrol/explore point — brief pause then idle
                npc.state = 'IDLE';
                npc.stateTimer = 2 + Math.random() * 5;
                memory.currentGoal = null;
                break;

            default:
                npc.state = 'WORKING';
                npc.workTimer = 5 + Math.random() * 10;
                break;
        }
    }
}
