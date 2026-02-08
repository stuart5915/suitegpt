// ============================================================
// AgentScape — Main Colyseus Game Room
// Server-authoritative game loop with tick-based simulation
// ============================================================

import { Room, Client } from 'colyseus';
import { GameState, LootPile } from '../schema/GameState';
import { PlayerSchema, InventoryItem, QuestProgress } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { MonsterSchema } from '../schema/MonsterSchema';
import { MovementSystem } from '../systems/MovementSystem';
import { CombatSystem, HitsplatEvent } from '../systems/CombatSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { NPCBehaviorSystem, PathfindRequest } from '../systems/NPCBehaviorSystem';
import { MonsterBehaviorSystem, MonsterPathfindRequest } from '../systems/MonsterBehaviorSystem';
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
    MAX_PLAYERS_PER_ROOM, MAP_SIZE, MONSTERS, BOSSES, ZONES,
    MONSTER_MOVE_SPEED, MONSTER_AGGRO_RANGE, BOSS_AGGRO_RANGE,
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
    private monsterBehaviorSystem!: MonsterBehaviorSystem;
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
        this.monsterBehaviorSystem = new MonsterBehaviorSystem(this.map);
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

        // Spawn NPCs (in SUITE City) and Monsters (in PvM zones)
        this.spawnNPCs();
        this.spawnMonsters();

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

        // Human auth — verify Supabase token for persistent saves
        if (options?.supabaseToken && !player.supabaseUserId) {
            try {
                const user = await this.supabase.verifyToken(options.supabaseToken);
                if (user) {
                    player.supabaseUserId = user.id;
                    if (!options.name || options.name.startsWith('Player')) {
                        player.name = user.user_metadata?.full_name || user.email?.split('@')[0] || player.name;
                    }
                    // Load saved data
                    const saved = await this.supabase.loadPlayerByUserId(user.id);
                    if (saved) {
                        this.supabase.restorePlayer(player, saved);
                        console.log(`[AgentScapeRoom] Restored save for ${player.name} (${user.id})`);
                    }
                }
            } catch (e) {
                console.warn('[AgentScapeRoom] Token verification failed, continuing as guest');
            }
        }

        // Telegram auth — use tg: prefix for persistent saves
        if (options?.tgId && !player.supabaseUserId) {
            const tgUserId = 'tg:' + options.tgId;
            player.supabaseUserId = tgUserId;
            const saved = await this.supabase.loadPlayerByUserId(tgUserId);
            if (saved) {
                this.supabase.restorePlayer(player, saved);
                console.log(`[AgentScapeRoom] Restored Telegram save for ${player.name} (${tgUserId})`);
            }
        }

        // Find walkable spawn in SUITE City center
        let sx = 100, sz = 95;
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

        // 1b. Process monster behavior
        this.state.monsters.forEach((monster) => {
            const events = this.monsterBehaviorSystem.updateMonster(monster, dtSec, this.state.players);
            events.forEach(evt => {
                this.broadcast('monster_ability', evt);
            });
        });

        // 2. Process pathfinding queue (budget limited) — NPCs + Monsters
        const pathQueue = this.npcBehaviorSystem.getPathfindQueue();
        const monsterPathQueue = this.monsterBehaviorSystem.getPathfindQueue();
        let pathsComputed = 0;
        while (pathQueue.length > 0 && pathsComputed < PATHFINDING_BUDGET_PER_TICK) {
            const req = pathQueue.shift()!;
            this.movementSystem.pathfindForNPC(req.npc, req.targetX, req.targetZ);
            pathsComputed++;
        }
        while (monsterPathQueue.length > 0 && pathsComputed < PATHFINDING_BUDGET_PER_TICK * 2) {
            const req = monsterPathQueue.shift()!;
            this.movementSystem.pathfindForMonster(req.monster, req.targetX, req.targetZ);
            pathsComputed++;
        }

        // 3. Update NPC movement
        this.state.npcs.forEach((npc) => {
            this.movementSystem.updateNPCMovement(npc, dtSec);
        });

        // 3b. Update monster movement
        this.state.monsters.forEach((monster) => {
            this.movementSystem.updateMonsterMovement(monster, dtSec);
            // Check if patrol or leash walk completed
            if (!monster.isDead && monster.path.length === 0) {
                if (monster.state === 'PATROL') {
                    this.monsterBehaviorSystem.onPatrolComplete(monster);
                } else if (monster.state === 'LEASHING') {
                    this.monsterBehaviorSystem.onLeashComplete(monster);
                }
            }
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
                // Auto-engage combat target (NPC)
                if (player.combatTargetNpcId) {
                    const npc = this.state.npcs.get(player.combatTargetNpcId);
                    if (npc && !npc.isDead) {
                        const dist = Math.abs(player.tileX - npc.tileX) + Math.abs(player.tileZ - npc.tileZ);
                        if (dist <= 1) {
                            this.combatSystem.startCombat(player, npc);
                        }
                    }
                }
                // Auto-engage combat target (Monster)
                if (player.combatTargetMonsterId) {
                    const monster = this.state.monsters.get(player.combatTargetMonsterId);
                    if (monster && !monster.isDead) {
                        const dist = Math.abs(player.tileX - monster.tileX) + Math.abs(player.tileZ - monster.tileZ);
                        if (dist <= 1) {
                            this.startMonsterCombat(player, monster);
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

        // 5b. Process monster combat (on combat tick)
        if (isCombatTick) {
            this.state.players.forEach((player) => {
                if (!player.combatTargetMonsterId || player.isDead) return;
                const monster = this.state.monsters.get(player.combatTargetMonsterId);
                if (!monster || monster.isDead) { player.combatTargetMonsterId = null; return; }

                const result = this.processMonsterCombatTick(player, monster, dtSec * COMBAT_TICK_INTERVAL);
                result.hitsplats.forEach(h => this.broadcast('hitsplat', h));
                result.xpGains.forEach(g => {
                    const levelResult = this.inventorySystem.gainXP(player, g.skill, g.amount);
                    if (levelResult.leveledUp) {
                        const client = this.clients.find(c => c.sessionId === player.sessionId);
                        if (client) client.send('level_up', { skill: g.skill, level: levelResult.newLevel });
                    }
                });
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

        // 6b. Respawn dead monsters
        this.state.monsters.forEach((monster) => {
            if (monster.isDead) {
                monster.respawnTimer -= dtSec;
                if (monster.respawnTimer <= 0) {
                    this.respawnMonster(monster);
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

        // 8. Special attack energy regen
        this.state.players.forEach((player) => {
            if (!player.isDead) this.combatSystem.updateEnergyRegen(player, dtSec);
        });

        // 8b. Run energy drain/regen
        this.state.players.forEach((player) => {
            if (player.isDead) return;
            player.runEnergyTimer += dtSec;
            if (player.runEnergyTimer >= 0.6) {
                player.runEnergyTimer -= 0.6;
                if (player.isRunning && player.isMoving) {
                    // Drain while running and moving
                    player.runEnergy = Math.max(0, player.runEnergy - 1);
                    if (player.runEnergy <= 0) {
                        player.isRunning = false;
                    }
                } else if (player.isResting) {
                    // Fast regen while resting
                    player.runEnergy = Math.min(100, player.runEnergy + 3);
                } else if (!player.isMoving) {
                    // Slow regen while standing still
                    player.runEnergy = Math.min(100, player.runEnergy + 1);
                }
            }
            // Cancel rest if player starts moving
            if (player.isResting && player.isMoving) {
                player.isResting = false;
                player.state = 'walking';
            }
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
                // Cancel resting if moving
                if (player.isResting) { player.isResting = false; }
                // Cancel combat if moving away
                if (player.combatTargetNpcId) {
                    const npc = this.state.npcs.get(player.combatTargetNpcId);
                    if (npc) this.combatSystem.disengageCombat(player, npc);
                }
                if (player.combatTargetMonsterId) {
                    this.disengageMonsterCombat(player);
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

            case 'attack_monster': {
                const { monsterId } = action.payload;
                const monster = this.state.monsters.get(monsterId);
                if (!monster || monster.isDead) break;

                // Disengage any existing combat
                if (player.combatTargetNpcId) {
                    const npc = this.state.npcs.get(player.combatTargetNpcId);
                    if (npc) this.combatSystem.disengageCombat(player, npc);
                }

                const dist = Math.abs(player.tileX - monster.tileX) + Math.abs(player.tileZ - monster.tileZ);
                if (dist <= 1) {
                    this.startMonsterCombat(player, monster);
                    client.send('system_message', { message: `You attack ${monster.name}!` });
                } else {
                    const adj = findAdjacentWalkable(this.map.grid, monster.tileX, monster.tileZ);
                    if (adj) {
                        player.combatTargetMonsterId = monster.id;
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

            case 'toggle_run': {
                player.isRunning = !player.isRunning;
                if (player.isRunning) player.isResting = false;
                if (player.isRunning && player.runEnergy <= 0) {
                    player.isRunning = false;
                    client.send('system_message', { message: 'You have no run energy!' });
                }
                break;
            }

            case 'toggle_rest': {
                if (player.isResting) {
                    // Stop resting
                    player.isResting = false;
                    player.state = 'idle';
                } else {
                    // Start resting — stop moving, cancel combat
                    player.isResting = true;
                    player.isRunning = false;
                    this.movementSystem.stopPlayerMove(player);
                    if (player.combatTargetNpcId) {
                        const npc = this.state.npcs.get(player.combatTargetNpcId);
                        if (npc) this.combatSystem.disengageCombat(player, npc);
                    }
                    if (player.combatTargetMonsterId) {
                        this.disengageMonsterCombat(player);
                    }
                    player.state = 'resting';
                }
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

        // Find walkable spawn within SUITE City bounds
        const city = ZONES.suite_city.bounds;
        let startX = 0, startZ = 0;
        for (let a = 0; a < 50; a++) {
            startX = Math.floor(city.x1 + Math.random() * (city.x2 - city.x1));
            startZ = Math.floor(city.z1 + Math.random() * (city.z2 - city.z1));
            if (startX >= 0 && startX < MAP_SIZE && startZ >= 0 && startZ < MAP_SIZE && this.map.grid[startX][startZ] > 0) break;
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

    // ============================================================
    // MONSTER MANAGEMENT
    // ============================================================
    private spawnMonsters() {
        let monsterCount = 0;
        let bossCount = 0;

        // Spawn regular monsters from map spawn points
        for (const [monsterId, spawns] of Object.entries(this.map.monsterSpawns)) {
            const def = MONSTERS[monsterId];
            if (!def) continue;

            spawns.forEach((pos, idx) => {
                const monster = new MonsterSchema();
                monster.id = `${monsterId}-${idx}`;
                monster.monsterId = monsterId;
                monster.name = def.name;
                monster.icon = def.icon;
                monster.level = def.level;
                monster.x = pos.x;
                monster.z = pos.z;
                monster.tileX = pos.x;
                monster.tileZ = pos.z;
                monster.hp = def.hp;
                monster.maxHp = def.hp;
                monster.aggressive = def.aggressive;
                monster.zone = def.zone;
                monster.color = def.color;
                monster.spawnX = pos.x;
                monster.spawnZ = pos.z;
                monster.respawnTime = def.respawnTime;
                monster.aggroRange = MONSTER_AGGRO_RANGE;
                monster.leashRange = 15;
                monster.stateTimer = 2 + Math.random() * 5;
                monster.combatStats = {
                    attack: def.attack,
                    strength: def.strength,
                    defence: def.defence,
                    drops: def.drops,
                    coinDrop: def.coinDrop,
                    xpReward: def.xpReward,
                };

                this.state.monsters.set(monster.id, monster);
                monsterCount++;
            });
        }

        // Spawn bosses
        for (const [bossId, pos] of Object.entries(this.map.bossSpawns)) {
            const def = BOSSES[bossId];
            if (!def) continue;

            const monster = new MonsterSchema();
            monster.id = `boss-${bossId}`;
            monster.monsterId = bossId;
            monster.name = def.name;
            monster.icon = def.icon;
            monster.level = def.level;
            monster.x = pos.x;
            monster.z = pos.z;
            monster.tileX = pos.x;
            monster.tileZ = pos.z;
            monster.hp = def.hp;
            monster.maxHp = def.hp;
            monster.aggressive = true;
            monster.isBoss = true;
            monster.isRaidBoss = def.isRaidBoss;
            monster.zone = def.zone;
            monster.color = def.color;
            monster.spawnX = pos.x;
            monster.spawnZ = pos.z;
            monster.respawnTime = def.respawnTime;
            monster.aggroRange = BOSS_AGGRO_RANGE;
            monster.leashRange = 20;
            monster.stateTimer = 2;
            monster.combatStats = {
                attack: def.attack,
                strength: def.strength,
                defence: def.defence,
                drops: def.drops,
                coinDrop: def.coinDrop,
                xpReward: def.xpReward,
            };

            // Initialize boss abilities with cooldowns
            monster.abilities = def.abilities.map(a => ({
                ...a,
                currentCooldown: a.cooldown, // start on cooldown
            }));

            this.state.monsters.set(monster.id, monster);
            bossCount++;
        }

        console.log(`[AgentScapeRoom] Spawned ${monsterCount} monsters + ${bossCount} bosses`);
    }

    // ============================================================
    // MONSTER COMBAT
    // ============================================================
    private startMonsterCombat(player: PlayerSchema, monster: MonsterSchema) {
        player.combatTargetMonsterId = monster.id;
        player.combatTargetNpcId = null; // can only fight one target
        monster.inCombat = true;
        monster.combatPlayerId = player.sessionId;
        monster.aggroTargetId = player.sessionId;
        monster.state = 'ATTACKING';
    }

    private disengageMonsterCombat(player: PlayerSchema) {
        const monster = this.state.monsters.get(player.combatTargetMonsterId || '');
        if (monster) {
            monster.inCombat = false;
            monster.combatPlayerId = null;
            // Monster goes back to aggro/leash
            if (!monster.isDead) {
                monster.state = 'LEASHING';
                monster.path = [];
            }
        }
        player.combatTargetMonsterId = null;
    }

    private processMonsterCombatTick(
        player: PlayerSchema,
        monster: MonsterSchema,
        dt: number,
    ): { hitsplats: HitsplatEvent[]; xpGains: { skill: string; amount: number }[]; deaths: any[] } {
        const hitsplats: HitsplatEvent[] = [];
        const xpGains: { skill: string; amount: number }[] = [];
        const deaths: any[] = [];

        if (player.isDead || monster.isDead) return { hitsplats, xpGains, deaths };

        // Player attacks monster
        const playerAtk = this.inventorySystem.getPlayerAttack(player);
        const playerStr = this.inventorySystem.getPlayerStrength(player);
        const monDef = monster.combatStats.defence;

        const playerHit = Math.random() * (playerAtk + 5) > Math.random() * (monDef + 5);
        if (playerHit) {
            const maxHit = Math.floor(playerStr * 0.8 + 2);
            const dmg = Math.floor(Math.random() * maxHit) + 1;
            monster.hp = Math.max(0, monster.hp - dmg);
            hitsplats.push({
                targetType: 'monster',
                targetId: monster.id,
                damage: dmg,
                isMiss: false,
                isSpec: false,
                x: monster.x,
                z: monster.z,
            });
        } else {
            hitsplats.push({
                targetType: 'monster',
                targetId: monster.id,
                damage: 0,
                isMiss: true,
                isSpec: false,
                x: monster.x,
                z: monster.z,
            });
        }

        // Check monster death
        if (monster.hp <= 0) {
            monster.isDead = true;
            monster.inCombat = false;
            monster.combatPlayerId = null;
            monster.respawnTimer = monster.respawnTime;
            monster.state = 'DEAD';
            player.combatTargetMonsterId = null;

            // XP reward
            const xp = monster.combatStats.xpReward;
            xpGains.push({ skill: 'attack', amount: xp.attack });
            xpGains.push({ skill: 'strength', amount: xp.strength });
            xpGains.push({ skill: 'hitpoints', amount: xp.hitpoints });

            // Create loot pile
            this.createMonsterLoot(monster);

            // Quest progress
            this.questSystem.checkMonsterKill(player, monster.monsterId, monster.isBoss);

            deaths.push({
                type: 'monster_death',
                monsterId: monster.id,
                monsterName: monster.name,
                killerId: player.sessionId,
                killerName: player.name,
            });

            return { hitsplats, xpGains, deaths };
        }

        // Monster attacks player
        const monAtk = monster.combatStats.attack * monster.enrageMultiplier;
        const monStr = monster.combatStats.strength * monster.enrageMultiplier;
        const playerDef = this.inventorySystem.getPlayerDefence(player);

        const monHit = Math.random() * (monAtk + 5) > Math.random() * (playerDef + 5);
        if (monHit) {
            const maxHit = Math.floor(monStr * 0.8 + 2);
            const dmg = Math.floor(Math.random() * maxHit) + 1;
            player.hp = Math.max(0, player.hp - dmg);
            hitsplats.push({
                targetType: 'player',
                targetId: player.sessionId,
                damage: dmg,
                isMiss: false,
                isSpec: false,
                x: player.x,
                z: player.z,
            });
        } else {
            hitsplats.push({
                targetType: 'player',
                targetId: player.sessionId,
                damage: 0,
                isMiss: true,
                isSpec: false,
                x: player.x,
                z: player.z,
            });
        }

        // Check player death
        if (player.hp <= 0) {
            player.isDead = true;
            player.respawnTimer = 10;
            player.combatTargetMonsterId = null;
            monster.inCombat = false;
            monster.combatPlayerId = null;
            monster.state = 'LEASHING';

            deaths.push({
                type: 'player_death',
                playerId: player.sessionId,
                playerName: player.name,
                killedBy: monster.name,
            });
        }

        return { hitsplats, xpGains, deaths };
    }

    private createMonsterLoot(monster: MonsterSchema) {
        const lootItems: { id: string; qty: number }[] = [];

        // Roll coin drop
        const coinDrop = monster.combatStats.coinDrop;
        const coins = Math.floor(coinDrop.min + Math.random() * (coinDrop.max - coinDrop.min));
        if (coins > 0) lootItems.push({ id: 'coins', qty: coins });

        // Roll item drops
        for (const drop of monster.combatStats.drops) {
            if (Math.random() * 100 < drop.weight) {
                const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1));
                lootItems.push({ id: drop.id, qty });
            }
        }

        if (lootItems.length === 0) return;

        const pile = new LootPile();
        pile.id = `loot-${monster.id}-${Date.now()}`;
        pile.x = monster.x;
        pile.z = monster.z;
        pile.timer = LOOT_DECAY_TIME;
        pile.itemsJson = JSON.stringify(lootItems);
        this.state.lootPiles.set(pile.id, pile);
    }

    private respawnMonster(monster: MonsterSchema) {
        monster.isDead = false;
        monster.hp = monster.maxHp;
        monster.x = monster.spawnX;
        monster.z = monster.spawnZ;
        monster.tileX = Math.floor(monster.spawnX);
        monster.tileZ = Math.floor(monster.spawnZ);
        monster.state = 'IDLE';
        monster.stateTimer = 2 + Math.random() * 3;
        monster.inCombat = false;
        monster.combatPlayerId = null;
        monster.aggroTargetId = null;
        monster.enraged = false;
        monster.enrageMultiplier = 1;
        monster.path = [];

        // Reset boss ability cooldowns
        for (const ability of monster.abilities) {
            ability.currentCooldown = ability.cooldown;
        }
    }
}
