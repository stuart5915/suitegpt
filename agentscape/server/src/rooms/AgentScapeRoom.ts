// ============================================================
// AgentScape — Main Colyseus Game Room
// Server-authoritative game loop with tick-based simulation
// ============================================================

import { Room, Client } from 'colyseus';
import { GameState, LootPile } from '../schema/GameState';
import { PlayerSchema, InventoryItem, QuestProgress } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { MovementSystem } from '../systems/MovementSystem';
import { CombatSystem, HitsplatEvent } from '../systems/CombatSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { NPCBehaviorSystem, PathfindRequest } from '../systems/NPCBehaviorSystem';
import { QuestSystem } from '../systems/QuestSystem';
import { ShopSystem } from '../systems/ShopSystem';
import { CraftingSystem } from '../systems/CraftingSystem';
import { SkillingSystem } from '../systems/SkillingSystem';
import { ActionValidator, GameAction } from '../validation/ActionValidator';
import { RateLimiter } from '../validation/RateLimiter';
import { generateMap, GameMap } from '../utils/MapGenerator';
import { findPath, findAdjacentWalkable } from '../utils/Pathfinding';
import { SupabaseAdapter } from '../persistence/SupabaseAdapter';
import { RedisAdapter } from '../persistence/RedisAdapter';
import { SaveManager } from '../persistence/SaveManager';
import { AgentConnectionManager } from '../agents/AgentConnectionManager';
import { AgentDecisionQueue } from '../agents/AgentDecisionQueue';
import {
    TICK_RATE, COMBAT_TICK_INTERVAL, PATHFINDING_BUDGET_PER_TICK,
    NPC_COMBAT_STATS, ROLE_COLORS, ITEMS, BUILDINGS, LOOT_DECAY_TIME,
    MAX_PLAYERS_PER_ROOM, MAP_SIZE,
} from '../config';

// Demo agents for when API is unavailable
const DEMO_AGENTS = [
    { id: 'demo-1', agent_name: 'BuilderBot', display_name: 'BuilderBot', agent_role: 'app_builder', agent_type: 'hosted' },
    { id: 'demo-2', agent_name: 'RefinerX', display_name: 'RefinerX', agent_role: 'app_refiner', agent_type: 'cli' },
    { id: 'demo-3', agent_name: 'ContentAI', display_name: 'ContentAI', agent_role: 'content_creator', agent_type: 'hosted' },
    { id: 'demo-4', agent_name: 'GrowthBot', display_name: 'GrowthBot', agent_role: 'growth_outreach', agent_type: 'hosted' },
    { id: 'demo-5', agent_name: 'TestRunner', display_name: 'TestRunner', agent_role: 'qa_tester', agent_type: 'cli' },
];

export class AgentScapeRoom extends Room<GameState> {
    private map!: GameMap;
    private movementSystem!: MovementSystem;
    private combatSystem!: CombatSystem;
    private inventorySystem!: InventorySystem;
    private npcBehaviorSystem!: NPCBehaviorSystem;
    private questSystem!: QuestSystem;
    private shopSystem!: ShopSystem;
    private craftingSystem!: CraftingSystem;
    private skillingSystem!: SkillingSystem;
    private actionValidator!: ActionValidator;
    private rateLimiter!: RateLimiter;
    private supabase!: SupabaseAdapter;
    private redis!: RedisAdapter;
    private saveManager!: SaveManager;
    private agentManager!: AgentConnectionManager;
    private agentDecisionQueue!: AgentDecisionQueue;
    private combatTickCounter: number = 0;

    maxClients = MAX_PLAYERS_PER_ROOM;

    onCreate() {
        this.setState(new GameState());

        // Generate deterministic map
        this.map = generateMap();

        // Initialize systems
        this.inventorySystem = new InventorySystem();
        this.questSystem = new QuestSystem(this.inventorySystem);
        this.movementSystem = new MovementSystem(this.map);
        this.combatSystem = new CombatSystem(this.inventorySystem, this.questSystem);
        this.npcBehaviorSystem = new NPCBehaviorSystem(this.map);
        this.shopSystem = new ShopSystem(this.inventorySystem);
        this.craftingSystem = new CraftingSystem(this.inventorySystem);
        this.skillingSystem = new SkillingSystem(this.inventorySystem);
        this.actionValidator = new ActionValidator();
        this.rateLimiter = new RateLimiter(10);

        // Initialize persistence
        this.supabase = new SupabaseAdapter();
        this.redis = new RedisAdapter();
        this.saveManager = new SaveManager(this.supabase);
        this.agentManager = new AgentConnectionManager(this.supabase);
        this.agentDecisionQueue = new AgentDecisionQueue();

        // Initialize shop stock
        this.shopSystem.initShopStock(this.state);

        // Spawn NPCs
        this.spawnNPCs();

        // Register action handler
        this.onMessage('action', (client, data: GameAction) => {
            this.handleAction(client, data);
        });

        // Start game loop
        this.setSimulationInterval((dt) => this.gameLoop(dt), TICK_RATE);

        // Start periodic saves
        this.saveManager.startPeriodicSave(this.state.players);

        // Periodically refresh NPC roster from Supabase
        this.clock.setInterval(() => this.refreshNPCs(), 60_000);

        // Periodic rate limiter cleanup
        this.clock.setInterval(() => this.rateLimiter.cleanup(), 10_000);

        console.log('[AgentScapeRoom] Created');
    }

    async onJoin(client: Client, options: any) {
        console.log(`[AgentScapeRoom] Join: ${client.sessionId}`);

        const player = new PlayerSchema();
        player.sessionId = client.sessionId;
        player.name = options?.name || 'Player' + Math.floor(Math.random() * 9999);
        player.color = options?.color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        player.entityType = options?.entityType || 'player';

        // Agent auth
        if (options?.entityType === 'agent' && options?.apiKey) {
            const agentInfo = await this.agentManager.authenticateAgent(options.apiKey);
            if (!agentInfo) {
                client.leave(4001);
                return;
            }
            player.name = agentInfo.displayName;
            player.supabaseUserId = agentInfo.id;
        }

        // Find walkable spawn
        let sx = 15, sz = 15;
        if (this.map.grid[sx][sz] === 0) {
            for (let r = 1; r < 5; r++) {
                for (const [dx, dz] of [[0, r], [0, -r], [r, 0], [-r, 0]]) {
                    const nx = sx + dx, nz = sz + dz;
                    if (nx >= 0 && nx < MAP_SIZE && nz >= 0 && nz < MAP_SIZE && this.map.grid[nx][nz] > 0) {
                        sx = nx; sz = nz; break;
                    }
                }
                if (this.map.grid[sx][sz] > 0) break;
            }
        }

        player.tileX = sx;
        player.tileZ = sz;
        player.x = sx;
        player.z = sz;

        // Initialize inventory
        this.inventorySystem.initStartingInventory(player);

        this.state.players.set(client.sessionId, player);

        // Send initial data
        client.send('welcome', {
            sessionId: client.sessionId,
            mapGrid: this.map.grid,
            mapHeight: this.map.heightMap,
            buildingDoors: this.map.buildingDoors,
        });
    }

    async onLeave(client: Client) {
        console.log(`[AgentScapeRoom] Leave: ${client.sessionId}`);

        const player = this.state.players.get(client.sessionId);
        if (player) {
            // Immediate save on disconnect
            player.dirty = true;
            await this.saveManager.savePlayer(player);

            // Disengage combat
            if (player.combatTargetNpcId) {
                const npc = this.state.npcs.get(player.combatTargetNpcId);
                if (npc) this.combatSystem.disengageCombat(player, npc);
            }
        }

        this.state.players.delete(client.sessionId);
        this.rateLimiter.remove(client.sessionId);
    }

    onDispose() {
        console.log('[AgentScapeRoom] Disposing');
        this.saveManager.stopPeriodicSave();
        // Final save all players
        this.saveManager.saveDirtyPlayers(this.state.players);
        this.redis.close();
    }

    // ============================================================
    // GAME LOOP — runs every TICK_RATE ms
    // ============================================================
    private gameLoop(dt: number) {
        const dtSec = dt / 1000;
        this.state.tick++;
        this.state.serverTime = Date.now();
        this.combatTickCounter++;

        const isCombatTick = this.combatTickCounter >= COMBAT_TICK_INTERVAL;
        if (isCombatTick) this.combatTickCounter = 0;

        // 1. Process NPC behavior
        this.state.npcs.forEach((npc) => {
            const events = this.npcBehaviorSystem.updateNPC(npc, dtSec);
            // Broadcast NPC chat events
            events.forEach(evt => {
                this.broadcast('npc_chat', evt);
            });
        });

        // 2. Process pathfinding queue (budget limited)
        const pathQueue = this.npcBehaviorSystem.getPathfindQueue();
        let pathsComputed = 0;
        while (pathQueue.length > 0 && pathsComputed < PATHFINDING_BUDGET_PER_TICK) {
            const req = pathQueue.shift()!;
            this.movementSystem.pathfindForNPC(req.npc, req.targetX, req.targetZ);
            pathsComputed++;
        }

        // 3. Update NPC movement
        this.state.npcs.forEach((npc) => {
            this.movementSystem.updateNPCMovement(npc, dtSec);
        });

        // 4. Update player movement
        this.state.players.forEach((player) => {
            if (player.isDead) {
                player.respawnTimer -= dtSec;
                if (player.respawnTimer <= 0) {
                    this.combatSystem.respawnPlayer(player, this.map.buildingDoors);
                    this.broadcast('player_respawn', { playerId: player.sessionId }, { except: null as any });
                }
                return;
            }

            this.movementSystem.updatePlayerMovement(player, dtSec);

            // Check if arrived and have pending actions
            if (!player.isMoving) {
                // Auto-engage combat target
                if (player.combatTargetNpcId) {
                    const npc = this.state.npcs.get(player.combatTargetNpcId);
                    if (npc && !npc.isDead) {
                        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileZ - npc.tileZ);
                        if (dist <= 1) {
                            this.combatSystem.startCombat(player, npc);
                        }
                    }
                }
                // Building arrival
                if (player.pendingBuildingAction) {
                    const bid = player.pendingBuildingAction;
                    player.pendingBuildingAction = null;
                    const questEvents = this.questSystem.checkVisit(player, bid);
                    const deliverEvents = this.questSystem.checkEnterBuilding(player, bid);
                    const allEvents = [...questEvents, ...deliverEvents];
                    allEvents.forEach(evt => {
                        const client = this.clients.find(c => c.sessionId === player.sessionId);
                        if (client) client.send('quest_event', evt);
                    });
                    const client = this.clients.find(c => c.sessionId === player.sessionId);
                    if (client) client.send('building_arrived', { buildingId: bid });
                }
            }
        });

        // 5. Process combat (on combat tick)
        if (isCombatTick) {
            this.state.players.forEach((player) => {
                if (!player.combatTargetNpcId || player.isDead) return;
                const npc = this.state.npcs.get(player.combatTargetNpcId);
                if (!npc) { player.combatTargetNpcId = null; return; }

                const result = this.combatSystem.processCombatTick(player, npc, dtSec * COMBAT_TICK_INTERVAL, this.state);

                // Broadcast hitsplats
                result.hitsplats.forEach(h => this.broadcast('hitsplat', h));

                // Process XP gains
                result.xpGains.forEach(g => {
                    const levelResult = this.inventorySystem.gainXP(player, g.skill, g.amount);
                    if (levelResult.leveledUp) {
                        const client = this.clients.find(c => c.sessionId === player.sessionId);
                        if (client) client.send('level_up', { skill: g.skill, level: levelResult.newLevel });
                    }
                });

                // Handle deaths
                result.deaths.forEach(d => this.broadcast('death', d));
            });
        }

        // 6. Respawn dead NPCs
        this.state.npcs.forEach((npc) => {
            if (npc.isDead) {
                npc.respawnTimer -= dtSec;
                if (npc.respawnTimer <= 0) {
                    this.combatSystem.respawnNPC(npc);
                }
            }
        });

        // 7. Update skilling timers
        this.state.players.forEach((player) => {
            if (player.skillingAction) {
                const event = this.skillingSystem.updateSkilling(player, dtSec);
                if (event) {
                    const client = this.clients.find(c => c.sessionId === player.sessionId);
                    if (client) client.send('skilling_event', event);
                }
            }
        });

        // 8. Energy regen
        this.state.players.forEach((player) => {
            if (!player.isDead) this.combatSystem.updateEnergyRegen(player, dtSec);
        });

        // 9. Loot pile decay
        const expiredLoot: string[] = [];
        this.state.lootPiles.forEach((pile, id) => {
            pile.timer -= dtSec;
            if (pile.timer <= 0) expiredLoot.push(id);
        });
        expiredLoot.forEach(id => this.state.lootPiles.delete(id));
    }

    // ============================================================
    // ACTION HANDLER
    // ============================================================
    private handleAction(client: Client, action: GameAction) {
        // Rate limit
        if (!this.rateLimiter.check(client.sessionId)) {
            client.send('error', { message: 'Too many actions. Slow down!' });
            return;
        }

        const player = this.state.players.get(client.sessionId);
        if (!player) return;

        // Validate
        const validation = this.actionValidator.validate(player, action, this.state);
        if (!validation.valid) {
            client.send('error', { message: validation.reason });
            return;
        }

        switch (action.type) {
            case 'move_to': {
                const { tileX, tileZ } = action.payload;
                // Cancel combat if moving away
                if (player.combatTargetNpcId) {
                    const npc = this.state.npcs.get(player.combatTargetNpcId);
                    if (npc) this.combatSystem.disengageCombat(player, npc);
                }
                this.movementSystem.startPlayerMove(player, tileX, tileZ);
                break;
            }

            case 'attack_npc': {
                const { npcId } = action.payload;
                const npc = this.state.npcs.get(npcId);
                if (!npc || npc.isDead) break;

                const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileZ - npc.tileZ);
                if (dist <= 1) {
                    this.combatSystem.startCombat(player, npc);
                    client.send('system_message', { message: `You attack ${npc.name}!` });
                } else {
                    // Walk to adjacent tile then engage
                    const adj = findAdjacentWalkable(this.map.grid, npc.tileX, npc.tileZ);
                    if (adj) {
                        player.combatTargetNpcId = npc.id;
                        this.movementSystem.startPlayerMove(player, adj.x, adj.z);
                    }
                }
                break;
            }

            case 'eat_food': {
                const result = this.inventorySystem.eatFood(player, action.payload.inventorySlot);
                if (result) {
                    client.send('system_message', { message: `You eat food. Heals ${result.healed} HP.` });
                }
                break;
            }

            case 'equip_item': {
                const { inventorySlot } = action.payload;
                const item = player.inventory[inventorySlot];
                if (!item) break;
                if (item.type === 'weapon') this.inventorySystem.equipWeapon(player, inventorySlot);
                else if (item.type === 'helm') this.inventorySystem.equipHelm(player, inventorySlot);
                else if (item.type === 'shield') this.inventorySystem.equipShield(player, inventorySlot);
                break;
            }

            case 'buy_item': {
                const result = this.shopSystem.buyItem(player, action.payload.itemId, action.payload.quantity, this.state);
                client.send('system_message', { message: result.message });
                // Quest progress for collection
                if (result.success) {
                    this.questSystem.checkCollect(player, action.payload.itemId);
                }
                break;
            }

            case 'sell_item': {
                const result = this.shopSystem.sellItem(player, action.payload.inventorySlot, this.state);
                client.send('system_message', { message: result.message });
                break;
            }

            case 'craft_item': {
                const result = this.craftingSystem.craftItem(player, action.payload.recipeIndex);
                client.send('system_message', { message: result.message });
                break;
            }

            case 'accept_quest': {
                const event = this.questSystem.acceptQuest(player, action.payload.questId);
                if (event) {
                    client.send('quest_event', event);
                    client.send('system_message', { message: `Quest accepted: ${event.questName}` });
                } else {
                    client.send('error', { message: 'Cannot accept this quest.' });
                }
                break;
            }

            case 'use_special_attack': {
                const success = this.combatSystem.useSpecialAttack(player);
                if (!success) {
                    client.send('system_message', { message: 'Not enough special attack energy!' });
                } else {
                    client.send('system_message', { message: 'You unleash a special attack!' });
                }
                break;
            }

            case 'start_harvest': {
                const event = this.skillingSystem.startHarvest(player);
                if (event) client.send('skilling_event', event);
                break;
            }

            case 'start_training': {
                const event = this.skillingSystem.startTraining(player);
                if (event) client.send('skilling_event', event);
                break;
            }

            case 'pickup_loot': {
                const pile = this.state.lootPiles.get(action.payload.lootId);
                if (!pile) break;
                const dist = Math.abs(player.x - pile.x) + Math.abs(player.z - pile.z);
                if (dist > 2) {
                    client.send('system_message', { message: 'You need to get closer!' });
                    break;
                }
                const items = JSON.parse(pile.itemsJson);
                items.forEach((li: { id: string; qty: number }) => {
                    this.inventorySystem.addToInventory(player, li.id, li.qty);
                    const item = ITEMS[li.id];
                    client.send('system_message', { message: `Loot: ${item.icon} ${li.qty}x ${item.name}` });
                    this.questSystem.checkCollect(player, li.id);
                });
                this.state.lootPiles.delete(action.payload.lootId);
                break;
            }

            case 'drop_item': {
                this.inventorySystem.dropItem(player, action.payload.inventorySlot);
                break;
            }

            case 'chat': {
                const { message } = action.payload;
                this.broadcast('player_chat', {
                    sender: player.name,
                    message,
                    color: player.color,
                    x: player.x,
                    z: player.z,
                });
                break;
            }
        }
    }

    // ============================================================
    // NPC MANAGEMENT
    // ============================================================
    private async spawnNPCs() {
        let agents: any[] = [];
        try {
            agents = await this.supabase.fetchAgents(50);
        } catch (e) {
            console.warn('[AgentScapeRoom] API unavailable, using demo agents');
        }

        if (agents.length === 0) agents = DEMO_AGENTS;

        agents.forEach(agentData => {
            this.spawnSingleNPC(agentData);
        });

        console.log(`[AgentScapeRoom] Spawned ${this.state.npcs.size} NPCs`);
    }

    private spawnSingleNPC(agentData: any): void {
        const role = agentData.agent_role || 'app_builder';
        const roleColor = ROLE_COLORS[role] || ROLE_COLORS.app_builder;
        const combatDef = NPC_COMBAT_STATS[role] || NPC_COMBAT_STATS.app_builder;

        // Find walkable spawn
        let startX = 0, startZ = 0;
        for (let a = 0; a < 50; a++) {
            startX = Math.floor(Math.random() * MAP_SIZE);
            startZ = Math.floor(Math.random() * MAP_SIZE);
            if (this.map.grid[startX][startZ] > 0) break;
        }

        const npc = new NPCSchema();
        npc.id = agentData.id;
        npc.name = agentData.display_name || agentData.agent_name || agentData.id;
        npc.role = role;
        npc.roleColor = roleColor.hex;
        npc.x = startX;
        npc.z = startZ;
        npc.tileX = startX;
        npc.tileZ = startZ;
        npc.hp = combatDef.hp;
        npc.maxHp = combatDef.hp;
        npc.spawnX = startX;
        npc.spawnZ = startZ;
        npc.stateTimer = 3 + Math.random() * 5;
        npc.walkCycle = Math.random() * Math.PI * 2;
        npc.combatStats = { ...combatDef };
        npc.agentData = agentData;

        this.state.npcs.set(agentData.id, npc);
    }

    private async refreshNPCs() {
        try {
            const agents = await this.supabase.fetchAgents(50);
            if (agents.length === 0) return;

            const ids = new Set(agents.map(a => a.id));

            // Remove NPCs no longer in roster
            this.state.npcs.forEach((npc, id) => {
                if (!ids.has(id) && !id.startsWith('demo-')) {
                    this.state.npcs.delete(id);
                }
            });

            // Add new NPCs
            agents.forEach(agentData => {
                if (!this.state.npcs.has(agentData.id)) {
                    this.spawnSingleNPC(agentData);
                }
            });
        } catch (e) {
            // API error, keep existing NPCs
        }
    }
}
