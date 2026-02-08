import { Schema, type } from '@colyseus/schema';

export class MonsterSchema extends Schema {
    // --- Synced to client ---
    @type('string') id: string = '';           // unique instance ID
    @type('string') monsterId: string = '';    // config MONSTERS/BOSSES key
    @type('string') name: string = '';
    @type('string') icon: string = '';
    @type('uint8') level: number = 1;
    @type('float32') x: number = 0;
    @type('float32') z: number = 0;
    @type('uint8') tileX: number = 0;
    @type('uint8') tileZ: number = 0;
    @type('int16') hp: number = 25;
    @type('int16') maxHp: number = 25;
    @type('string') state: string = 'IDLE';    // IDLE, PATROL, AGGRO, ATTACKING, LEASHING, DEAD
    @type('boolean') isDead: boolean = false;
    @type('boolean') isBoss: boolean = false;
    @type('boolean') isRaidBoss: boolean = false;
    @type('boolean') aggressive: boolean = false;
    @type('string') zone: string = '';
    @type('float32') rotation: number = 0;
    @type('string') color: string = '#94a3b8';
    @type('boolean') isHumanoid: boolean = false;
    @type('string') skinColor: string = '';
    @type('string') hairColor: string = '';

    // --- Server-only state ---
    spawnX: number = 0;
    spawnZ: number = 0;
    stateTimer: number = 3;
    respawnTime: number = 15;
    respawnTimer: number = 0;

    // Patrol
    patrolTargetX: number = 0;
    patrolTargetZ: number = 0;
    path: { x: number; z: number }[] = [];
    pathIndex: number = 0;
    moveProgress: number = 0;
    moveFromX: number = 0;
    moveFromZ: number = 0;
    moveToX: number = 0;
    moveToZ: number = 0;

    // Combat
    inCombat: boolean = false;
    combatPlayerId: string | null = null;
    combatTimer: number = 0;
    aggroTargetId: string | null = null;
    aggroRange: number = 5;
    leashRange: number = 15;

    // Combat stats (copied from config at spawn)
    combatStats: {
        attack: number;
        strength: number;
        defence: number;
        drops: { id: string; weight: number; minQty: number; maxQty: number }[];
        coinDrop: { min: number; max: number };
        xpReward: { attack: number; strength: number; hitpoints: number };
    } = {
        attack: 3, strength: 2, defence: 1,
        drops: [], coinDrop: { min: 5, max: 15 },
        xpReward: { attack: 8, strength: 6, hitpoints: 4 },
    };

    // Boss-specific
    abilities: {
        name: string;
        type: string;
        damage?: number;
        heal?: number;
        radius?: number;
        cooldown: number;
        trigger?: number;
        currentCooldown: number;
    }[] = [];
    enraged: boolean = false;
    enrageMultiplier: number = 1;
}
