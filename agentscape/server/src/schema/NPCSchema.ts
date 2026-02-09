import { Schema, type } from '@colyseus/schema';

export class NPCSchema extends Schema {
    @type('string') id: string = '';
    @type('string') name: string = '';
    @type('string') role: string = 'aligned';
    @type('string') roleColor: string = '#60a5fa';
    @type('float32') x: number = 0;
    @type('float32') z: number = 0;
    @type('uint8') tileX: number = 0;
    @type('uint8') tileZ: number = 0;
    @type('int16') hp: number = 60;
    @type('int16') maxHp: number = 60;
    @type('string') state: string = 'IDLE'; // IDLE, CHOOSING, WAITING_PATH, WALKING, WORKING
    @type('boolean') isDead: boolean = false;
    @type('float32') rotation: number = 0;

    // Server-only state
    spawnX: number = 0;
    spawnZ: number = 0;
    stateTimer: number = 3;
    targetBuilding: string | null = null;
    path: { x: number; z: number }[] = [];
    pathIndex: number = 0;
    moveProgress: number = 0;
    moveFromX: number = 0;
    moveFromZ: number = 0;
    moveToX: number = 0;
    moveToZ: number = 0;
    walkCycle: number = 0;
    workTimer: number = 0;
    inCombat: boolean = false;
    combatPlayerId: string | null = null;
    combatTimer: number = 0;
    respawnTimer: number = 0;
    combatStats: { hp: number; attack: number; strength: number; defence: number; drops: string[] } = {
        hp: 60, attack: 5, strength: 4, defence: 3, drops: ['coins'],
    };
    agentData: any = null; // raw data from factory_users
}
