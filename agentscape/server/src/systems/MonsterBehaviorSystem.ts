// ============================================================
// AgentScape — Monster Behavior System
// Handles PvM monster AI: patrol, aggro, leash, boss abilities
// ============================================================

import { MonsterSchema } from '../schema/MonsterSchema';
import { PlayerSchema } from '../schema/PlayerSchema';
import { GameMap } from '../utils/MapGenerator';
import {
    ZONES, MONSTERS, BOSSES,
    MONSTER_MOVE_SPEED, MONSTER_AGGRO_RANGE, MONSTER_LEASH_RANGE, BOSS_AGGRO_RANGE,
    isInSafeZone,
} from '../config';
import { MapSchema } from '@colyseus/schema';

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

export class MonsterBehaviorSystem {
    private map: GameMap;
    private pathfindQueue: MonsterPathfindRequest[] = [];

    constructor(map: GameMap) {
        this.map = map;
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
            // Check boss abilities during combat
            if (monster.isBoss) {
                const abilityEvents = this.checkBossAbilities(monster, players);
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

    private checkBossAbilities(
        monster: MonsterSchema,
        players: MapSchema<PlayerSchema>,
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
                        monster.enrageMultiplier = 1.5;
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
                    // Stun a random player in combat
                    const target = players.get(monster.combatPlayerId || '');
                    if (target && !target.isDead) {
                        events.push({
                            monsterId: monster.id,
                            monsterName: monster.name,
                            abilityName: ability.name,
                            abilityType: 'stun',
                            x: monster.x,
                            z: monster.z,
                        });
                        // Stun effect: skip player's next combat tick(s)
                        // Handled by setting a stun timer on the player (room handles this)
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
    }
}
