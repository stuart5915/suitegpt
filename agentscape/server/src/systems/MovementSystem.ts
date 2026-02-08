// ============================================================
// AgentScape — Server-Authoritative Movement System
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { MonsterSchema } from '../schema/MonsterSchema';
import { GameMap } from '../utils/MapGenerator';
import { findPath, PathNode } from '../utils/Pathfinding';
import { MOVE_SPEED, NPC_MOVE_SPEED, MONSTER_MOVE_SPEED, MAP_SIZE, BUILDINGS } from '../config';

export class MovementSystem {
    private map: GameMap;

    constructor(map: GameMap) {
        this.map = map;
    }

    startPlayerMove(player: PlayerSchema, targetX: number, targetZ: number): boolean {
        // Validate target
        if (targetX < 0 || targetX >= MAP_SIZE || targetZ < 0 || targetZ >= MAP_SIZE) return false;
        if (this.map.grid[targetX][targetZ] === 0) return false;
        if (player.isDead) return false;

        const path = findPath(this.map.grid, player.tileX, player.tileZ, targetX, targetZ);
        if (path.length < 2) return false;

        player.pathQueue = path;
        player.pathIndex = 1;
        player.isMoving = true;
        player.moveProgress = 0;
        player.moveFromX = path[0].x;
        player.moveFromZ = path[0].z;
        player.moveToX = path[1].x;
        player.moveToZ = path[1].z;
        player.state = 'walking';
        return true;
    }

    updatePlayerMovement(player: PlayerSchema, dt: number): void {
        if (!player.isMoving || player.pathQueue.length === 0) return;

        const runMult = (player.isRunning && player.runEnergy > 0) ? 1.8 : 1.0;
        player.moveProgress += dt * MOVE_SPEED * runMult;

        if (player.moveProgress >= 1) {
            player.moveProgress = 0;
            player.tileX = player.moveToX;
            player.tileZ = player.moveToZ;
            player.x = player.moveToX;
            player.z = player.moveToZ;
            player.pathIndex++;

            if (player.pathIndex < player.pathQueue.length) {
                player.moveFromX = player.moveToX;
                player.moveFromZ = player.moveToZ;
                player.moveToX = player.pathQueue[player.pathIndex].x;
                player.moveToZ = player.pathQueue[player.pathIndex].z;
            } else {
                this.stopPlayerMove(player);
                return;
            }
        }

        if (player.isMoving) {
            // Interpolate position
            const lx = player.moveFromX + (player.moveToX - player.moveFromX) * player.moveProgress;
            const lz = player.moveFromZ + (player.moveToZ - player.moveFromZ) * player.moveProgress;
            player.x = lx;
            player.z = lz;
            player.rotation = Math.atan2(player.moveToX - player.moveFromX, player.moveToZ - player.moveFromZ);
        }
    }

    stopPlayerMove(player: PlayerSchema): void {
        player.isMoving = false;
        player.pathQueue = [];
        player.state = (player.combatTargetNpcId || player.combatTargetMonsterId) ? 'combat' : 'idle';
    }

    updateNPCMovement(npc: NPCSchema, dt: number): void {
        if (npc.state !== 'WALKING') return;

        npc.moveProgress += dt * NPC_MOVE_SPEED;
        npc.walkCycle += dt * 10;

        if (npc.moveProgress >= 1) {
            npc.moveProgress = 0;
            npc.tileX = npc.moveToX;
            npc.tileZ = npc.moveToZ;
            npc.x = npc.moveToX;
            npc.z = npc.moveToZ;
            npc.pathIndex++;

            if (npc.pathIndex < npc.path.length) {
                npc.moveFromX = npc.moveToX;
                npc.moveFromZ = npc.moveToZ;
                npc.moveToX = npc.path[npc.pathIndex].x;
                npc.moveToZ = npc.path[npc.pathIndex].z;
            } else {
                // Arrived at building
                npc.state = 'WORKING';
                npc.workTimer = 5 + Math.random() * 10;
                npc.path = [];

                const bd = BUILDINGS.find(b => b.id === npc.targetBuilding);
                if (bd) {
                    npc.rotation = Math.atan2(bd.x - npc.tileX, bd.z - npc.tileZ);
                }
                return;
            }
        }

        if (npc.state === 'WALKING') {
            const lx = npc.moveFromX + (npc.moveToX - npc.moveFromX) * npc.moveProgress;
            const lz = npc.moveFromZ + (npc.moveToZ - npc.moveFromZ) * npc.moveProgress;
            npc.x = lx;
            npc.z = lz;
            npc.rotation = Math.atan2(npc.moveToX - npc.moveFromX, npc.moveToZ - npc.moveFromZ);
        }
    }

    pathfindForNPC(npc: NPCSchema, targetX: number, targetZ: number): void {
        npc.path = findPath(this.map.grid, npc.tileX, npc.tileZ, targetX, targetZ);
    }

    // ============================================================
    // Monster Movement
    // ============================================================

    updateMonsterMovement(monster: MonsterSchema, dt: number): void {
        if (monster.isDead || monster.path.length === 0) return;
        if (monster.state !== 'PATROL' && monster.state !== 'AGGRO' && monster.state !== 'LEASHING') return;

        monster.moveProgress += dt * MONSTER_MOVE_SPEED;

        if (monster.moveProgress >= 1) {
            monster.moveProgress = 0;
            monster.tileX = monster.moveToX;
            monster.tileZ = monster.moveToZ;
            monster.x = monster.moveToX;
            monster.z = monster.moveToZ;
            monster.pathIndex++;

            if (monster.pathIndex < monster.path.length) {
                monster.moveFromX = monster.moveToX;
                monster.moveFromZ = monster.moveToZ;
                monster.moveToX = monster.path[monster.pathIndex].x;
                monster.moveToZ = monster.path[monster.pathIndex].z;
            } else {
                // Path complete
                monster.path = [];
                return;
            }
        }

        if (monster.path.length > 0) {
            const lx = monster.moveFromX + (monster.moveToX - monster.moveFromX) * monster.moveProgress;
            const lz = monster.moveFromZ + (monster.moveToZ - monster.moveFromZ) * monster.moveProgress;
            monster.x = lx;
            monster.z = lz;
            monster.rotation = Math.atan2(monster.moveToX - monster.moveFromX, monster.moveToZ - monster.moveFromZ);
        }
    }

    pathfindForMonster(monster: MonsterSchema, targetX: number, targetZ: number): void {
        const path = findPath(this.map.grid, monster.tileX, monster.tileZ, targetX, targetZ);
        monster.path = path;
        if (path.length > 1) {
            monster.pathIndex = 1;
            monster.moveProgress = 0;
            monster.moveFromX = path[0].x;
            monster.moveFromZ = path[0].z;
            monster.moveToX = path[1].x;
            monster.moveToZ = path[1].z;
        }
    }
}
