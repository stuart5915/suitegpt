// ============================================================
// AgentScape — NPC Behavior State Machine
// Ported from apps/runescape-game.html lines 1450-1495
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameMap } from '../utils/MapGenerator';
import { ROLE_BUILDING_WEIGHTS, RESPAWN_TIME, AGENT_DIALOGUE, BUILDINGS } from '../config';

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

export class NPCBehaviorSystem {
    private map: GameMap;
    private pathfindQueue: PathfindRequest[] = [];

    constructor(map: GameMap) {
        this.map = map;
    }

    getPathfindQueue(): PathfindRequest[] {
        return this.pathfindQueue;
    }

    clearPathfindQueue(): void {
        this.pathfindQueue = [];
    }

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

    updateNPC(npc: NPCSchema, dt: number): NPCChatEvent[] {
        const events: NPCChatEvent[] = [];

        if (npc.isDead) {
            npc.respawnTimer -= dt;
            // respawn handled by CombatSystem
            return events;
        }

        if (npc.inCombat) return events; // combat handled separately

        switch (npc.state) {
            case 'IDLE':
                npc.stateTimer -= dt;
                if (npc.stateTimer <= 0) {
                    npc.state = 'CHOOSING';
                }
                // Occasional chat while idle
                if (Math.random() < 0.0005) {
                    const lines = AGENT_DIALOGUE[npc.role] || AGENT_DIALOGUE.app_builder;
                    const line = lines[Math.floor(Math.random() * lines.length)];
                    events.push({
                        npcId: npc.id,
                        npcName: npc.name,
                        message: line,
                        roleColor: npc.roleColor,
                        x: npc.x,
                        z: npc.z,
                    });
                }
                break;

            case 'CHOOSING': {
                const tid = this.chooseTargetBuilding(npc.role);
                npc.targetBuilding = tid;
                const door = this.map.buildingDoors[tid];
                if (door) {
                    this.pathfindQueue.push({ npc, targetX: door.x, targetZ: door.z });
                }
                npc.state = 'WAITING_PATH';
                npc.stateTimer = 10;
                break;
            }

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
                    npc.stateTimer = 3 + Math.random() * 5;
                }
                break;

            case 'WALKING':
                // Movement handled by MovementSystem
                break;

            case 'WORKING':
                npc.workTimer -= dt;
                if (npc.workTimer <= 0) {
                    npc.state = 'IDLE';
                    npc.stateTimer = 3 + Math.random() * 5;
                }
                break;
        }

        return events;
    }
}
