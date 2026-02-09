import { Schema, type, ArraySchema, MapSchema, filter } from '@colyseus/schema';
import type { Client } from 'colyseus';
import { BankSchema } from './BankSchema';
import { PlayerAchievements } from './AchievementSchema';

export class InventoryItem extends Schema {
    @type('string') id: string = '';
    @type('string') name: string = '';
    @type('string') icon: string = '';
    @type('uint16') quantity: number = 0;
    @type('string') type: string = '';
    @type('boolean') stackable: boolean = false;
    @type('int8') attackStat: number = 0;
    @type('int8') strengthStat: number = 0;
    @type('int8') defenceStat: number = 0;
    @type('uint8') healAmount: number = 0;
}

export class QuestProgress extends Schema {
    @type('string') questId: string = '';
    @type('string') status: string = 'active'; // 'active' | 'completed'
    @type('string') objectiveData: string = '{}'; // JSON-serialized objective progress
}

export class PlayerSchema extends Schema {
    // Public — synced to all clients
    @type('string') sessionId: string = '';
    @type('string') name: string = 'Player';
    @type('string') color: string = '#3355aa';
    @type('float32') x: number = 15;
    @type('float32') z: number = 15;
    @type('uint8') tileX: number = 15;
    @type('uint8') tileZ: number = 15;
    @type('int16') hp: number = 100;
    @type('int16') maxHp: number = 100;
    @type('uint8') combatLevel: number = 3;
    @type('string') state: string = 'idle'; // idle, walking, combat, dead, skilling
    @type('float32') rotation: number = 0;
    @type('boolean') isDead: boolean = false;
    @type('string') entityType: string = 'player'; // 'player' | 'agent'
    @type('boolean') isRunning: boolean = false;
    @type('boolean') isResting: boolean = false;

    // Private — filtered to owning client only
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') runEnergy: number = 100;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') energy: number = 100;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') maxEnergy: number = 100;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') attack: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') strength: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') defence: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') hitpoints: number = 10;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') attackXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') strengthXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') defenceXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') hitpointsXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') prayer: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') prayerXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') thieving: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') thievingXP: number = 0;

    // ── Gathering Skills ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') woodcutting: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') woodcuttingXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') mining: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') miningXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') fishing: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') fishingXP: number = 0;

    // ── Production Skills ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') cooking: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') cookingXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') smithing: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') smithingXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') crafting: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') craftingXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') fletching: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') fletchingXP: number = 0;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint8') runecrafting: number = 1;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') runecraftingXP: number = 0;

    // ── Bank ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(BankSchema) bank: BankSchema = new BankSchema();

    // ── Total Level (sum of all skill levels) ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint16') totalLevel: number = 10;

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type([InventoryItem]) inventory = new ArraySchema<InventoryItem>();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedWeapon: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedHelm: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedShield: InventoryItem = new InventoryItem();

    // ── Additional Equipment Slots ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedBody: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedLegs: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedBoots: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedGloves: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedCape: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedRing: InventoryItem = new InventoryItem();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(InventoryItem) equippedAmulet: InventoryItem = new InventoryItem();

    // ── Achievements ──
    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type(PlayerAchievements) achievements: PlayerAchievements = new PlayerAchievements();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type({ map: QuestProgress }) quests = new MapSchema<QuestProgress>();

    @filter(function (this: PlayerSchema, client: Client) {
        return client.sessionId === this.sessionId;
    })
    @type('uint32') coins: number = 0; // quick accessor

    // Server-side only (not synced)
    runEnergyTimer: number = 0;
    combatTargetNpcId: string | null = null;
    combatTargetMonsterId: string | null = null;
    combatTimer: number = 0;
    specActive: boolean = false;
    energyRegenTimer: number = 0;
    respawnTimer: number = 0;
    pathQueue: { x: number; z: number }[] = [];
    pathIndex: number = 0;
    moveProgress: number = 0;
    moveFromX: number = 0;
    moveFromZ: number = 0;
    moveToX: number = 0;
    moveToZ: number = 0;
    isMoving: boolean = false;
    pendingBuildingAction: string | null = null;
    pendingPickpocket: { type: 'npc' | 'monster'; id: string } | null = null;
    pendingStallSteal: string | null = null; // stallId to steal from on arrival
    pendingNpcInteraction: string | null = null; // npcId to talk to on arrival
    skillingAction: { type: string; timer: number; maxTime: number } | null = null;
    skillingCooldown: number = 0;
    stunTimer: number = 0;
    dirty: boolean = false; // needs save
    lastSaveTime: number = 0;
    supabaseUserId: string | null = null;
}
