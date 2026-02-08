// ============================================================
// AgentScape — Server-Authoritative Skilling System
// Woodcutting, Mining, Fishing + original Harvest/Training
// ============================================================
//
// === INTEGRATION NOTES (for AgentScapeRoom.ts / other terminals) ===
//
// config.ts (Terminal 3) — Add these items for a richer experience:
//   oak_logs:      { id: 'oak_logs', name: 'Oak Logs', icon: '\u{1FAB5}', stackable: true, type: 'material' }
//   willow_logs:   { id: 'willow_logs', name: 'Willow Logs', icon: '\u{1FAB5}', stackable: true, type: 'material' }
//   copper_ore:    { id: 'copper_ore', name: 'Copper Ore', icon: '\u{1FAA8}', stackable: true, type: 'material' }
//   iron_ore:      { id: 'iron_ore', name: 'Iron Ore', icon: '\u26CF\uFE0F', stackable: true, type: 'material' }
//   mithril_ore:   { id: 'mithril_ore', name: 'Mithril Ore', icon: '\u{1F48E}', stackable: true, type: 'material' }
//   raw_shrimp:    { id: 'raw_shrimp', name: 'Raw Shrimp', icon: '\u{1F990}', stackable: false, type: 'material' }
//   raw_trout:     { id: 'raw_trout', name: 'Raw Trout', icon: '\u{1F41F}', stackable: false, type: 'material' }
//   raw_lobster:   { id: 'raw_lobster', name: 'Raw Lobster', icon: '\u{1F99E}', stackable: false, type: 'material' }
//   (Until added, the system uses existing items: logs, code_fragment, raw_fish, etc.)
//
// PlayerSchema.ts — Add these skill fields (same pattern as attack/attackXP):
//   woodcutting: uint8 = 1, woodcuttingXP: uint32 = 0
//   mining: uint8 = 1, miningXP: uint32 = 0
//   fishing: uint8 = 1, fishingXP: uint32 = 0
//   (Until added, skill XP is tracked internally by SkillingSystem)
//
// AgentScapeRoom.ts — Wire up:
//   1. Add action handler:
//      case 'gather_resource': {
//          const event = this.skillingSystem.startGathering(player, action.payload.nodeId);
//          if (event) client.send('skilling_event', event);
//          break;
//      }
//   2. In move_to handler, cancel skilling:
//      player.skillingAction = null;
//   3. Change gameLoop step 7 to call updateSkilling unconditionally
//      (not gated on player.skillingAction) so cooldowns tick down:
//      this.state.players.forEach((player) => {
//          const event = this.skillingSystem.updateSkilling(player, dtSec);
//          if (event) { ... send to client ... }
//      });
//   4. Add to gameLoop (once per tick, outside player loop):
//      const nodeEvents = this.skillingSystem.updateResourceNodes(dtSec);
//      nodeEvents.forEach(evt => this.broadcast('node_update', evt));
//   5. On player join, send node data:
//      client.send('resource_nodes', this.skillingSystem.getNodeStates());
//   6. In save/restore, use serializeSkills / restoreSkills
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { ITEMS, BUILDINGS, levelFromXP } from '../config';
import { InventorySystem } from './InventorySystem';

// ============================================================
// Events
// ============================================================

export interface SkillingEvent {
    type: string; // harvest_complete | train_complete | gather_complete | started | cooldown | level_req | node_depleted | node_not_found | too_far
    playerId: string;
    message: string;
    skill?: string;
    xpGains?: { skill: string; amount: number }[];
    itemGained?: { id: string; qty: number };
    levelUp?: { skill: string; newLevel: number };
}

// ============================================================
// Resource Node Definitions
// ============================================================

interface ResourceLoot {
    itemId: string;
    weight: number;
    minQty: number;
    maxQty: number;
}

export interface ResourceDef {
    id: string;
    name: string;
    icon: string;
    skill: 'woodcutting' | 'mining' | 'fishing';
    levelReq: number;
    xpReward: number;
    actionTime: number;       // seconds per gather attempt
    respawnTime: number;      // seconds after depletion (0 = never depletes)
    depletionChance: number;  // 0-1 chance per action
    loot: ResourceLoot[];
    locations: { x: number; z: number }[];
}

interface ResourceNodeState {
    defId: string;
    x: number;
    z: number;
    depleted: boolean;
    respawnTimer: number;
}

interface SkillDataEntry {
    woodcuttingXP: number;
    miningXP: number;
    fishingXP: number;
}

// ============================================================
// Resource Definitions — uses existing config.ts items
// ============================================================

const RESOURCE_DEFS: ResourceDef[] = [
    // ========== WOODCUTTING ==========
    {
        id: 'normal_tree',
        name: 'Tree',
        icon: '\u{1F333}',
        skill: 'woodcutting',
        levelReq: 1,
        xpReward: 25,
        actionTime: 3,
        respawnTime: 15,
        depletionChance: 0.25,
        loot: [{ itemId: 'logs', weight: 100, minQty: 1, maxQty: 1 }],
        locations: [
            // Forest zone (z1:5 → z2:50)
            { x: 80, z: 25 }, { x: 95, z: 18 }, { x: 110, z: 30 },
            { x: 125, z: 22 }, { x: 70, z: 35 }, { x: 140, z: 28 },
            { x: 155, z: 15 }, { x: 60, z: 20 },
            // City — near Farm (130, 100)
            { x: 128, z: 95 }, { x: 133, z: 105 }, { x: 136, z: 98 },
        ],
    },
    {
        id: 'code_tree',
        name: 'Code Tree',
        icon: '\u{1F332}',
        skill: 'woodcutting',
        levelReq: 15,
        xpReward: 60,
        actionTime: 5,
        respawnTime: 30,
        depletionChance: 0.35,
        loot: [
            { itemId: 'logs', weight: 40, minQty: 1, maxQty: 1 },
            { itemId: 'code_fragment', weight: 60, minQty: 1, maxQty: 2 },
        ],
        locations: [
            // Forest — deeper areas
            { x: 85, z: 12 }, { x: 100, z: 8 }, { x: 130, z: 15 }, { x: 165, z: 25 },
        ],
    },
    {
        id: 'data_tree',
        name: 'Data Tree',
        icon: '\u{1F384}',
        skill: 'woodcutting',
        levelReq: 30,
        xpReward: 100,
        actionTime: 7,
        respawnTime: 60,
        depletionChance: 0.45,
        loot: [
            { itemId: 'code_fragment', weight: 50, minQty: 1, maxQty: 3 },
            { itemId: 'agent_core', weight: 20, minQty: 1, maxQty: 1 },
            { itemId: 'logs', weight: 30, minQty: 1, maxQty: 2 },
        ],
        locations: [
            // Ruins zone (x1:150 → x2:195, z1:50 → z2:137)
            { x: 160, z: 65 }, { x: 175, z: 80 }, { x: 185, z: 110 },
        ],
    },

    // ========== MINING ==========
    {
        id: 'byte_rock',
        name: 'Byte Rock',
        icon: '\u{1FAA8}',
        skill: 'mining',
        levelReq: 1,
        xpReward: 20,
        actionTime: 3,
        respawnTime: 10,
        depletionChance: 0.3,
        loot: [{ itemId: 'corrupted_byte', weight: 100, minQty: 1, maxQty: 2 }],
        locations: [
            // Forest zone
            { x: 75, z: 15 }, { x: 90, z: 22 }, { x: 105, z: 12 },
            { x: 120, z: 18 }, { x: 145, z: 30 },
        ],
    },
    {
        id: 'link_rock',
        name: 'Link Rock',
        icon: '\u26CF\uFE0F',
        skill: 'mining',
        levelReq: 10,
        xpReward: 40,
        actionTime: 4,
        respawnTime: 20,
        depletionChance: 0.35,
        loot: [
            { itemId: 'broken_link', weight: 70, minQty: 1, maxQty: 2 },
            { itemId: 'corrupted_byte', weight: 30, minQty: 1, maxQty: 1 },
        ],
        locations: [
            // Forest — harder to reach
            { x: 82, z: 10 }, { x: 115, z: 8 }, { x: 135, z: 20 },
        ],
    },
    {
        id: 'shard_rock',
        name: 'Memory Rock',
        icon: '\u{1F4A0}',
        skill: 'mining',
        levelReq: 20,
        xpReward: 65,
        actionTime: 5,
        respawnTime: 35,
        depletionChance: 0.4,
        loot: [
            { itemId: 'memory_shard', weight: 70, minQty: 1, maxQty: 2 },
            { itemId: 'null_fragment', weight: 20, minQty: 1, maxQty: 1 },
        ],
        locations: [
            // Ruins zone
            { x: 160, z: 70 }, { x: 175, z: 85 }, { x: 180, z: 100 }, { x: 170, z: 120 },
        ],
    },
    {
        id: 'essence_rock',
        name: 'Essence Rock',
        icon: '\u{1F300}',
        skill: 'mining',
        levelReq: 30,
        xpReward: 90,
        actionTime: 6,
        respawnTime: 50,
        depletionChance: 0.45,
        loot: [
            { itemId: 'overflow_essence', weight: 60, minQty: 1, maxQty: 2 },
            { itemId: 'null_fragment', weight: 30, minQty: 1, maxQty: 2 },
        ],
        locations: [
            // Ruins — deeper
            { x: 165, z: 60 }, { x: 185, z: 95 }, { x: 190, z: 130 },
        ],
    },
    {
        id: 'firewall_rock',
        name: 'Firewall Rock',
        icon: '\u{1F525}',
        skill: 'mining',
        levelReq: 40,
        xpReward: 150,
        actionTime: 8,
        respawnTime: 120,
        depletionChance: 0.5,
        loot: [
            { itemId: 'firewall_core', weight: 50, minQty: 1, maxQty: 1 },
            { itemId: 'dark_packet', weight: 40, minQty: 1, maxQty: 2 },
        ],
        locations: [
            // Deep Network (x1:25 → x2:175, z1:137 → z2:195)
            { x: 80, z: 160 }, { x: 120, z: 175 }, { x: 100, z: 185 },
        ],
    },

    // ========== FISHING ==========
    {
        id: 'net_spot',
        name: 'Fishing Spot',
        icon: '\u{1F41F}',
        skill: 'fishing',
        levelReq: 1,
        xpReward: 20,
        actionTime: 4,
        respawnTime: 0,       // fishing spots never deplete
        depletionChance: 0,
        loot: [
            { itemId: 'raw_fish', weight: 100, minQty: 1, maxQty: 1 },
        ],
        locations: [
            // Forest/City border (z ~48)
            { x: 85, z: 48 }, { x: 100, z: 48 }, { x: 115, z: 48 },
        ],
    },
    {
        id: 'bait_spot',
        name: 'Bait Fishing Spot',
        icon: '\u{1F3A3}',
        skill: 'fishing',
        levelReq: 15,
        xpReward: 50,
        actionTime: 5,
        respawnTime: 0,
        depletionChance: 0,
        loot: [
            { itemId: 'raw_fish', weight: 60, minQty: 1, maxQty: 2 },
            { itemId: 'cooked_fish', weight: 25, minQty: 1, maxQty: 1 },
            { itemId: 'bones', weight: 15, minQty: 1, maxQty: 1 },
        ],
        locations: [
            // Forest — off the beaten path
            { x: 70, z: 42 }, { x: 145, z: 42 },
        ],
    },
    {
        id: 'harpoon_spot',
        name: 'Deep Fishing Spot',
        icon: '\u{1F988}',
        skill: 'fishing',
        levelReq: 30,
        xpReward: 100,
        actionTime: 7,
        respawnTime: 0,
        depletionChance: 0,
        loot: [
            { itemId: 'raw_fish', weight: 35, minQty: 1, maxQty: 3 },
            { itemId: 'lobster', weight: 25, minQty: 1, maxQty: 1 },
            { itemId: 'shark', weight: 15, minQty: 1, maxQty: 1 },
            { itemId: 'dark_packet', weight: 15, minQty: 1, maxQty: 1 },
        ],
        locations: [
            // Deep Network coast
            { x: 60, z: 142 }, { x: 140, z: 142 },
        ],
    },
];

const GATHER_RANGE = 3; // Manhattan distance in tiles

// ============================================================
// SkillingSystem
// ============================================================

export class SkillingSystem {
    private inventorySystem: InventorySystem;
    private nodes: Map<string, ResourceNodeState> = new Map();
    private defs: Map<string, ResourceDef> = new Map();
    private activeNodes: Map<string, string> = new Map(); // sessionId -> nodeId
    private skillData: Map<string, SkillDataEntry> = new Map();
    private pendingNodeEvents: { nodeId: string; depleted: boolean }[] = [];

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
        this.initNodes();
    }

    private initNodes(): void {
        for (const def of RESOURCE_DEFS) {
            this.defs.set(def.id, def);
            def.locations.forEach((loc, i) => {
                const nodeId = `${def.id}_${i}`;
                this.nodes.set(nodeId, {
                    defId: def.id,
                    x: loc.x,
                    z: loc.z,
                    depleted: false,
                    respawnTimer: 0,
                });
            });
        }
    }

    // ============================================================
    // Skill Data Management (internal until PlayerSchema is extended)
    // ============================================================

    private getPlayerKey(player: PlayerSchema): string {
        return player.supabaseUserId || player.sessionId;
    }

    private getSkillData(player: PlayerSchema): SkillDataEntry {
        const key = this.getPlayerKey(player);
        if (!this.skillData.has(key)) {
            this.skillData.set(key, { woodcuttingXP: 0, miningXP: 0, fishingXP: 0 });
        }
        return this.skillData.get(key)!;
    }

    getSkillLevel(player: PlayerSchema, skill: 'woodcutting' | 'mining' | 'fishing'): number {
        const data = this.getSkillData(player);
        return levelFromXP(data[(skill + 'XP') as keyof SkillDataEntry]);
    }

    getSkillXP(player: PlayerSchema, skill: 'woodcutting' | 'mining' | 'fishing'): number {
        return this.getSkillData(player)[(skill + 'XP') as keyof SkillDataEntry];
    }

    private addSkillXP(
        player: PlayerSchema,
        skill: 'woodcutting' | 'mining' | 'fishing',
        amount: number,
    ): { leveledUp: boolean; newLevel: number } {
        const data = this.getSkillData(player);
        const xpKey = (skill + 'XP') as keyof SkillDataEntry;
        const oldLevel = levelFromXP(data[xpKey]);
        (data as any)[xpKey] += amount;
        const newLevel = levelFromXP(data[xpKey]);
        player.dirty = true;
        return { leveledUp: newLevel > oldLevel, newLevel };
    }

    serializeSkills(player: PlayerSchema): string {
        return JSON.stringify(this.getSkillData(player));
    }

    restoreSkills(player: PlayerSchema, json?: string): void {
        if (!json) return;
        try {
            const data = JSON.parse(json);
            const key = this.getPlayerKey(player);
            this.skillData.set(key, {
                woodcuttingXP: data.woodcuttingXP || 0,
                miningXP: data.miningXP || 0,
                fishingXP: data.fishingXP || 0,
            });
        } catch { /* malformed data, start fresh */ }
    }

    cleanupPlayer(player: PlayerSchema): void {
        this.activeNodes.delete(player.sessionId);
    }

    // ============================================================
    // Resource Gathering — Woodcutting, Mining, Fishing
    // ============================================================

    startGathering(player: PlayerSchema, nodeId: string): SkillingEvent | null {
        if (player.isDead) return null;

        if (player.skillingAction || player.skillingCooldown > 0) {
            return { type: 'cooldown', playerId: player.sessionId, message: 'Please wait...' };
        }

        const node = this.nodes.get(nodeId);
        if (!node) {
            return { type: 'node_not_found', playerId: player.sessionId, message: 'Resource not found.' };
        }

        if (node.depleted) {
            return { type: 'node_depleted', playerId: player.sessionId, message: 'This resource is depleted.' };
        }

        const def = this.defs.get(node.defId);
        if (!def) return null;

        // Proximity check
        const dist = Math.abs(player.tileX - node.x) + Math.abs(player.tileZ - node.z);
        if (dist > GATHER_RANGE) {
            return {
                type: 'too_far',
                playerId: player.sessionId,
                message: `You need to be closer to the ${def.name}.`,
            };
        }

        // Level check
        const playerLevel = this.getSkillLevel(player, def.skill);
        if (playerLevel < def.levelReq) {
            return {
                type: 'level_req',
                playerId: player.sessionId,
                message: `You need level ${def.levelReq} ${def.skill}. (You are level ${playerLevel}.)`,
                skill: def.skill,
            };
        }

        // Start the gathering action
        player.skillingAction = { type: def.skill, timer: 0, maxTime: def.actionTime };
        player.state = 'skilling';
        this.activeNodes.set(player.sessionId, nodeId);

        return {
            type: 'started',
            playerId: player.sessionId,
            message: `You start ${this.getActionVerb(def.skill)}...`,
            skill: def.skill,
        };
    }

    // Convenience wrappers
    startWoodcutting(player: PlayerSchema, nodeId: string): SkillingEvent | null {
        return this.startGathering(player, nodeId);
    }

    startMining(player: PlayerSchema, nodeId: string): SkillingEvent | null {
        return this.startGathering(player, nodeId);
    }

    startFishing(player: PlayerSchema, nodeId: string): SkillingEvent | null {
        return this.startGathering(player, nodeId);
    }

    // ============================================================
    // Original Skills (preserved from v1)
    // ============================================================

    startHarvest(player: PlayerSchema): SkillingEvent | null {
        if (player.isDead) return null;
        if (player.skillingAction || player.skillingCooldown > 0) {
            return { type: 'cooldown', playerId: player.sessionId, message: 'Please wait...' };
        }

        const farm = BUILDINGS.find(b => b.id === 'farm');
        if (farm) {
            const dist = Math.abs(player.tileX - farm.x) + Math.abs(player.tileZ - farm.z);
            if (dist > 5) return { type: 'cooldown', playerId: player.sessionId, message: 'You need to be at the Farm!' };
        }

        player.skillingAction = { type: 'harvest', timer: 0, maxTime: 3 };
        player.state = 'skilling';
        return { type: 'started', playerId: player.sessionId, message: 'Harvesting...' };
    }

    startTraining(player: PlayerSchema): SkillingEvent | null {
        if (player.isDead) return null;
        if (player.skillingAction || player.skillingCooldown > 0) {
            return { type: 'cooldown', playerId: player.sessionId, message: 'Please wait...' };
        }

        const arena = BUILDINGS.find(b => b.id === 'arena');
        if (arena) {
            const dist = Math.abs(player.tileX - arena.x) + Math.abs(player.tileZ - arena.z);
            if (dist > 5) return { type: 'cooldown', playerId: player.sessionId, message: 'You need to be at the Arena!' };
        }

        player.skillingAction = { type: 'train', timer: 0, maxTime: 5 };
        player.state = 'skilling';
        return { type: 'started', playerId: player.sessionId, message: 'Training on the dummy...' };
    }

    // ============================================================
    // Tick Updates
    // ============================================================

    updateSkilling(player: PlayerSchema, dt: number): SkillingEvent | null {
        // Always tick cooldown (even without active action)
        if (player.skillingCooldown > 0) player.skillingCooldown -= dt;

        if (!player.skillingAction) return null;

        // Cancel gathering if player starts moving
        if (player.isMoving) {
            player.skillingAction = null;
            player.state = 'walking';
            this.activeNodes.delete(player.sessionId);
            return null;
        }

        player.skillingAction.timer += dt;

        if (player.skillingAction.timer >= player.skillingAction.maxTime) {
            const action = player.skillingAction;

            // --- Original harvest ---
            if (action.type === 'harvest') {
                player.skillingAction = null;
                player.state = 'idle';
                const foods = ['bread', 'raw_fish'];
                const item = foods[Math.floor(Math.random() * foods.length)];
                this.inventorySystem.addToInventory(player, item, 1);
                player.skillingCooldown = 10;
                return {
                    type: 'harvest_complete',
                    playerId: player.sessionId,
                    message: `You harvest some ${ITEMS[item]?.name || item}. ${ITEMS[item]?.icon || ''}`,
                };
            }

            // --- Original training ---
            if (action.type === 'train') {
                player.skillingAction = null;
                player.state = 'idle';
                const xpGains = [
                    { skill: 'attack', amount: 5 },
                    { skill: 'strength', amount: 5 },
                    { skill: 'defence', amount: 5 },
                ];
                xpGains.forEach(g => this.inventorySystem.gainXP(player, g.skill, g.amount));
                player.skillingCooldown = 5;
                return {
                    type: 'train_complete',
                    playerId: player.sessionId,
                    message: 'You hit the training dummy. +5 XP to combat skills.',
                    xpGains,
                };
            }

            // --- Gathering skills ---
            if (action.type === 'woodcutting' || action.type === 'mining' || action.type === 'fishing') {
                return this.completeGatherAction(player, action.type as 'woodcutting' | 'mining' | 'fishing');
            }
        }

        return null;
    }

    private completeGatherAction(
        player: PlayerSchema,
        skill: 'woodcutting' | 'mining' | 'fishing',
    ): SkillingEvent | null {
        const nodeId = this.activeNodes.get(player.sessionId);
        if (!nodeId) {
            player.skillingAction = null;
            player.state = 'idle';
            return null;
        }

        const node = this.nodes.get(nodeId);
        if (!node || node.depleted) {
            player.skillingAction = null;
            player.state = 'idle';
            this.activeNodes.delete(player.sessionId);
            return {
                type: 'node_depleted',
                playerId: player.sessionId,
                message: 'The resource has been depleted.',
                skill,
            };
        }

        const def = this.defs.get(node.defId);
        if (!def) {
            player.skillingAction = null;
            player.state = 'idle';
            return null;
        }

        // Roll loot from the node's loot table
        const lootResult = this.rollLoot(def.loot);

        if (lootResult) {
            const added = this.inventorySystem.addToInventory(player, lootResult.id, lootResult.qty);
            if (!added) {
                // Inventory full — stop gathering
                player.skillingAction = null;
                player.state = 'idle';
                this.activeNodes.delete(player.sessionId);
                return {
                    type: 'gather_complete',
                    playerId: player.sessionId,
                    message: 'Your inventory is full!',
                    skill,
                };
            }
        }

        // Grant XP
        const xpResult = this.addSkillXP(player, skill, def.xpReward);

        // Build response event
        const itemDef = lootResult ? ITEMS[lootResult.id] : null;
        const itemName = itemDef ? itemDef.name : (lootResult?.id || 'something');
        const itemIcon = itemDef?.icon || '';

        const event: SkillingEvent = {
            type: 'gather_complete',
            playerId: player.sessionId,
            message: `You get ${lootResult ? `${lootResult.qty}x ${itemIcon} ${itemName}` : 'nothing'}. +${def.xpReward} ${skill} XP.`,
            skill,
            xpGains: [{ skill, amount: def.xpReward }],
            itemGained: lootResult ? { id: lootResult.id, qty: lootResult.qty } : undefined,
        };

        if (xpResult.leveledUp) {
            event.levelUp = { skill, newLevel: xpResult.newLevel };
            event.message += ` Level up! ${skill} is now level ${xpResult.newLevel}.`;
        }

        // Roll node depletion
        if (def.depletionChance > 0 && Math.random() < def.depletionChance) {
            node.depleted = true;
            node.respawnTimer = def.respawnTime;
            player.skillingAction = null;
            player.state = 'idle';
            this.activeNodes.delete(player.sessionId);
            this.pendingNodeEvents.push({ nodeId, depleted: true });
        } else {
            // Auto-repeat: reset timer for next gather cycle
            player.skillingAction!.timer = 0;
        }

        return event;
    }

    /**
     * Called once per tick in the game loop (outside the player loop).
     * Handles node respawn timers and returns events to broadcast.
     */
    updateResourceNodes(dt: number): { nodeId: string; depleted: boolean }[] {
        // Drain pending depletion events
        const events = [...this.pendingNodeEvents];
        this.pendingNodeEvents = [];

        // Tick respawn timers
        this.nodes.forEach((node, nodeId) => {
            if (node.depleted) {
                node.respawnTimer -= dt;
                if (node.respawnTimer <= 0) {
                    node.depleted = false;
                    node.respawnTimer = 0;
                    events.push({ nodeId, depleted: false });
                }
            }
        });

        return events;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private rollLoot(lootTable: ResourceLoot[]): { id: string; qty: number } | null {
        if (lootTable.length === 0) return null;
        const totalWeight = lootTable.reduce((sum, l) => sum + l.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const loot of lootTable) {
            roll -= loot.weight;
            if (roll <= 0) {
                const qty = loot.minQty + Math.floor(Math.random() * (loot.maxQty - loot.minQty + 1));
                return { id: loot.itemId, qty };
            }
        }
        // Fallback (floating point edge case)
        const fallback = lootTable[0];
        return { id: fallback.itemId, qty: fallback.minQty };
    }

    private getActionVerb(skill: string): string {
        switch (skill) {
            case 'woodcutting': return 'chopping';
            case 'mining': return 'mining';
            case 'fishing': return 'fishing';
            default: return 'gathering';
        }
    }

    // ============================================================
    // Node State — for client sync / rendering
    // ============================================================

    /** Returns all node states for sending to a newly joined client. */
    getNodeStates(): { id: string; defId: string; x: number; z: number; depleted: boolean }[] {
        const states: { id: string; defId: string; x: number; z: number; depleted: boolean }[] = [];
        this.nodes.forEach((node, id) => {
            states.push({ id, defId: node.defId, x: node.x, z: node.z, depleted: node.depleted });
        });
        return states;
    }

    /** Returns resource definitions for the client to render node visuals. */
    getResourceDefs(): { id: string; name: string; icon: string; skill: string; levelReq: number }[] {
        return RESOURCE_DEFS.map(d => ({
            id: d.id,
            name: d.name,
            icon: d.icon,
            skill: d.skill,
            levelReq: d.levelReq,
        }));
    }
}
