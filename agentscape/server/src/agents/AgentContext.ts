// ============================================================
// AgentScape — Agent Context & World Utilities
// Provides zone detection, target finding, and position
// helpers for behavior tree conditions and actions.
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameState } from '../schema/GameState';
import { PlayerSchema } from '../schema/PlayerSchema';
import { GameMap } from '../utils/MapGenerator';
import { BUILDINGS, ZONES, MONSTERS, QUESTS, getZoneAt } from '../config';
import { AgentProfile } from './AgentProfiles';

// ---- Zone helpers ----

/** Get the zone ID for a given position. */
export function getZoneId(x: number, z: number): string {
    const zone = getZoneAt(x, z);
    return zone?.id || 'wilderness';
}

/** Find a random walkable tile within a zone's bounds. */
export function randomWalkableInZone(zoneId: string, map: GameMap): { x: number; z: number } | null {
    const zone = ZONES[zoneId];
    if (!zone) return null;
    const { x1, z1, x2, z2 } = zone.bounds;
    for (let i = 0; i < 30; i++) {
        const x = x1 + Math.floor(Math.random() * (x2 - x1));
        const z = z1 + Math.floor(Math.random() * (z2 - z1));
        if (map.grid[x]?.[z] && map.grid[x][z] > 0) {
            return { x, z };
        }
    }
    return null;
}

/** Find a random walkable tile near a specific position (within radius). */
export function randomWalkableNear(cx: number, cz: number, radius: number, map: GameMap): { x: number; z: number } | null {
    for (let i = 0; i < 20; i++) {
        const x = cx + Math.floor(Math.random() * radius * 2) - radius;
        const z = cz + Math.floor(Math.random() * radius * 2) - radius;
        if (x >= 0 && x < 200 && z >= 0 && z < 200 && map.grid[x]?.[z] > 0) {
            return { x, z };
        }
    }
    return null;
}

// ---- Monster targeting ----

/** Pick a hunt target, optionally filtering by agent's effective level. */
export function pickHuntTarget(
    profile: AgentProfile,
    map: GameMap,
    effectiveLevel: number = 1,
): { monsterType: string; monsterName: string; x: number; z: number; zone: string } | null {
    // Start with profile targets, but also unlock higher monsters by level
    let targets = [...profile.huntTargets];

    // Unlock additional monsters based on effective level
    const allMonsters = Object.values(MONSTERS);
    for (const m of allMonsters) {
        if (m.level <= effectiveLevel + 2 && !targets.includes(m.id) && m.id !== 'man' && m.id !== 'woman') {
            // Only add monsters from preferred zones or adjacent zones
            const validZones = [...profile.preferredZones, 'the_forest'];
            if (validZones.includes(m.zone)) {
                targets.push(m.id);
            }
        }
    }

    if (targets.length === 0) return null;

    // Prefer monsters near the agent's level (within +-5)
    const levelFiltered = targets.filter(id => {
        const m = MONSTERS[id];
        return m && m.level >= effectiveLevel - 5 && m.level <= effectiveLevel + 3;
    });

    const pool = levelFiltered.length > 0 ? levelFiltered : targets;
    const shuffled = pool.sort(() => Math.random() - 0.5);

    for (const monsterId of shuffled) {
        const monsterDef = MONSTERS[monsterId];
        if (!monsterDef) continue;

        // Use map.monsterSpawns if available, otherwise fall back to zone random
        const spawns = map.monsterSpawns?.[monsterId];
        if (spawns && spawns.length > 0) {
            const spawn = spawns[Math.floor(Math.random() * spawns.length)];
            // Add small offset so agents don't stack on exact spawn points
            const pos = randomWalkableNear(spawn.x, spawn.z, 3, map);
            if (pos) {
                return {
                    monsterType: monsterId,
                    monsterName: monsterDef.name,
                    x: pos.x,
                    z: pos.z,
                    zone: monsterDef.zone,
                };
            }
        }

        // Fallback: random point in the monster's zone
        const pos = randomWalkableInZone(monsterDef.zone, map);
        if (pos) {
            return {
                monsterType: monsterId,
                monsterName: monsterDef.name,
                x: pos.x,
                z: pos.z,
                zone: monsterDef.zone,
            };
        }
    }

    return null;
}

/** Get the damage an agent takes per fight based on monster level vs NPC stats. */
export function estimateFightDamage(monsterType: string, npcCombatStats: { defence: number }): number {
    const monster = MONSTERS[monsterType];
    if (!monster) return 5;
    // Simplified: damage = monster strength minus some defence mitigation
    const rawDamage = Math.max(1, monster.strength - Math.floor(npcCombatStats.defence * 0.5));
    // Add variance: 60%-140% of base
    return Math.floor(rawDamage * (0.6 + Math.random() * 0.8));
}

// ---- Quest helpers ----

/** Pick a kill quest appropriate for the agent's preferred zones. */
export function pickQuest(preferredZones: string[]): { questId: string; questName: string; monsterType: string; killTarget: number } | null {
    const candidates: { questId: string; questName: string; monsterType: string; killTarget: number }[] = [];

    for (const [id, quest] of Object.entries(QUESTS)) {
        // Only consider kill_monster quests
        for (const obj of quest.objectives) {
            if (obj.type === 'kill_monster') {
                const monster = MONSTERS[obj.monsterId];
                if (monster && (preferredZones.includes(monster.zone) || monster.zone === 'the_forest')) {
                    candidates.push({
                        questId: id,
                        questName: quest.name,
                        monsterType: obj.monsterId,
                        killTarget: obj.count,
                    });
                }
            }
        }
    }

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// ---- Building helpers ----

/** Get the door position for a building by ID. */
export function getBuildingDoor(buildingId: string, map: GameMap): { x: number; z: number } | null {
    const door = map.buildingDoors?.[buildingId];
    return door || null;
}

/** Get the general store door position (for shopping). */
export function getShopDoor(map: GameMap): { x: number; z: number } | null {
    return getBuildingDoor('general_store', map);
}

/** Get the town hall door position (for fleeing to safety). */
export function getTownDoor(map: GameMap): { x: number; z: number } | null {
    return getBuildingDoor('town_hall', map);
}

// ---- Context builder (for future LLM integration) ----

export class AgentContext {
    buildPrompt(npc: NPCSchema, state: GameState): string {
        const nearbyPlayers: string[] = [];
        const nearbyNPCs: string[] = [];

        state.players.forEach((player) => {
            const dist = Math.abs(player.x - npc.x) + Math.abs(player.z - npc.z);
            if (dist < 10) {
                nearbyPlayers.push(`${player.name} (combat lvl ${player.combatLevel}, hp ${player.hp}/${player.maxHp}) at (${Math.round(player.x)},${Math.round(player.z)})`);
            }
        });

        state.npcs.forEach((other) => {
            if (other.id === npc.id || other.isDead) return;
            const dist = Math.abs(other.x - npc.x) + Math.abs(other.z - npc.z);
            if (dist < 8) {
                nearbyNPCs.push(`${other.name} (${other.role}) at (${Math.round(other.x)},${Math.round(other.z)})`);
            }
        });

        const nearestBuilding = BUILDINGS.reduce((best, b) => {
            const dist = Math.abs(b.x - npc.x) + Math.abs(b.z - npc.z);
            if (!best || dist < best.dist) return { name: b.name, id: b.id, dist };
            return best;
        }, null as { name: string; id: string; dist: number } | null);

        const zone = getZoneId(npc.x, npc.z);

        return `You are ${npc.name}, a ${npc.role} agent in AgentScape.
Position: (${Math.round(npc.x)}, ${Math.round(npc.z)})
Zone: ${zone}
HP: ${npc.hp}/${npc.maxHp}
State: ${npc.state}
${npc.inCombat ? 'IN COMBAT' : ''}
Nearest building: ${nearestBuilding?.name || 'unknown'} (${nearestBuilding?.dist || '?'} tiles away)
Nearby players: ${nearbyPlayers.join(', ') || 'none'}
Nearby agents: ${nearbyNPCs.join(', ') || 'none'}

Choose your next action: move_to, chat, or wait.`;
    }
}
