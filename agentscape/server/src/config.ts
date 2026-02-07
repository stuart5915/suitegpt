// ============================================================
// AgentScape — Shared Config (server + client reference)
// ============================================================

export const MAP_SIZE = 30;
export const TILE_SIZE = 1;
export const WATER_LEVEL = -0.15;
export const MOVE_SPEED = 4;
export const NPC_MOVE_SPEED = 2.5;
export const COMBAT_TICK = 2.4; // seconds between combat rounds
export const TICK_RATE = 600; // ms per server tick
export const COMBAT_TICK_INTERVAL = 4; // combat happens every 4th tick
export const MAX_INVENTORY_SLOTS = 28;
export const SAVE_INTERVAL = 30_000; // batch save every 30s
export const MAX_PLAYERS_PER_ROOM = 200;
export const PATHFINDING_BUDGET_PER_TICK = 4;
export const RESPAWN_TIME = 30; // seconds
export const LOOT_DECAY_TIME = 60; // seconds
export const ENERGY_REGEN_INTERVAL = 2.4; // seconds
export const SPEC_ENERGY_COST = 25;
export const SPEC_DAMAGE_MULT = 1.5;

export interface ItemDef {
    id: string;
    name: string;
    icon: string;
    stackable: boolean;
    type: 'coin' | 'weapon' | 'helm' | 'shield' | 'food' | 'material' | 'misc';
    stats?: { attack?: number; strength?: number; defence?: number };
    healAmount?: number;
}

export const ITEMS: Record<string, ItemDef> = {
    coins:          { id: 'coins', name: 'Coins', icon: '\u{1FA99}', stackable: true, type: 'coin' },
    bronze_sword:   { id: 'bronze_sword', name: 'Bronze Sword', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 4, strength: 3 } },
    iron_sword:     { id: 'iron_sword', name: 'Iron Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 8, strength: 6 } },
    steel_sword:    { id: 'steel_sword', name: 'Steel Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 12, strength: 10 } },
    bread:          { id: 'bread', name: 'Bread', icon: '\u{1F35E}', stackable: false, type: 'food', healAmount: 10 },
    cooked_meat:    { id: 'cooked_meat', name: 'Cooked Meat', icon: '\u{1F356}', stackable: false, type: 'food', healAmount: 20 },
    cooked_fish:    { id: 'cooked_fish', name: 'Cooked Fish', icon: '\u{1F420}', stackable: false, type: 'food', healAmount: 15 },
    raw_fish:       { id: 'raw_fish', name: 'Raw Fish', icon: '\u{1F41F}', stackable: true, type: 'material' },
    logs:           { id: 'logs', name: 'Logs', icon: '\u{1FAB5}', stackable: true, type: 'material' },
    code_fragment:  { id: 'code_fragment', name: 'Code Fragment', icon: '\u{1F48E}', stackable: true, type: 'material' },
    agent_core:     { id: 'agent_core', name: 'Agent Core', icon: '\u{1F52E}', stackable: false, type: 'misc' },
    bronze_helm:    { id: 'bronze_helm', name: 'Bronze Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 3 } },
    iron_helm:      { id: 'iron_helm', name: 'Iron Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 6 } },
    steel_helm:     { id: 'steel_helm', name: 'Steel Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 10 } },
    bronze_shield:  { id: 'bronze_shield', name: 'Bronze Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 4 } },
    iron_shield:    { id: 'iron_shield', name: 'Iron Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 8 } },
};

export interface NPCCombatDef {
    hp: number;
    attack: number;
    strength: number;
    defence: number;
    drops: string[];
}

export const NPC_COMBAT_STATS: Record<string, NPCCombatDef> = {
    app_builder:     { hp: 60, attack: 5, strength: 4, defence: 3, drops: ['code_fragment', 'coins'] },
    app_refiner:     { hp: 50, attack: 4, strength: 3, defence: 5, drops: ['logs', 'coins'] },
    content_creator: { hp: 40, attack: 3, strength: 3, defence: 2, drops: ['bread', 'coins'] },
    growth_outreach: { hp: 45, attack: 4, strength: 4, defence: 3, drops: ['cooked_meat', 'coins'] },
    qa_tester:       { hp: 70, attack: 6, strength: 5, defence: 4, drops: ['agent_core', 'coins'] },
};

export const ROLE_COLORS: Record<string, { hex: string; name: string }> = {
    app_builder:     { hex: '#6366f1', name: 'Builder' },
    app_refiner:     { hex: '#f97316', name: 'Refiner' },
    content_creator: { hex: '#22c55e', name: 'Creator' },
    growth_outreach: { hex: '#ec4899', name: 'Growth' },
    qa_tester:       { hex: '#eab308', name: 'Tester' },
};

export interface BuildingDef {
    id: string;
    name: string;
    icon: string;
    x: number;
    z: number;
    w: number;
    d: number;
    h: number;
    doorSide: 'north' | 'south' | 'east' | 'west';
    type?: string;
}

export const BUILDINGS: BuildingDef[] = [
    { id: 'quest_board', name: 'Quest Board', icon: '\u{1F4CB}', x: 15, z: 13, w: 1, d: 1, h: 1.2, doorSide: 'south', type: 'pedestal' },
    { id: 'workshop', name: 'Workshop', icon: '\u{1F528}', x: 20, z: 10, w: 3, d: 2, h: 1.5, doorSide: 'south' },
    { id: 'marketplace', name: 'Marketplace', icon: '\u{1F3EA}', x: 10, z: 12, w: 2.5, d: 2, h: 1.3, doorSide: 'south' },
    { id: 'farm', name: 'Farm', icon: '\u{1F33E}', x: 24, z: 16, w: 2, d: 3, h: 1.0, doorSide: 'west' },
    { id: 'arena', name: 'Arena', icon: '\u2694\uFE0F', x: 12, z: 26, w: 3, d: 3, h: 1.6, doorSide: 'north' },
    { id: 'town_hall', name: 'Town Hall', icon: '\u{1F3DB}\uFE0F', x: 18, z: 6, w: 2.5, d: 2, h: 1.8, doorSide: 'south' },
];

export const ROLE_BUILDING_WEIGHTS: Record<string, Record<string, number>> = {
    app_builder:     { workshop: 50, quest_board: 20, town_hall: 15, marketplace: 10, farm: 3, arena: 2 },
    app_refiner:     { workshop: 40, quest_board: 25, town_hall: 15, marketplace: 10, farm: 5, arena: 5 },
    content_creator: { quest_board: 30, marketplace: 25, town_hall: 20, workshop: 15, farm: 5, arena: 5 },
    growth_outreach: { marketplace: 40, quest_board: 25, town_hall: 15, workshop: 10, farm: 5, arena: 5 },
    qa_tester:       { workshop: 35, quest_board: 30, arena: 15, town_hall: 10, marketplace: 5, farm: 5 },
};

export interface ShopItemDef {
    id: string;
    price: number;
    stock: number;
}

export const SHOP_ITEMS: ShopItemDef[] = [
    { id: 'bread', price: 10, stock: 99 },
    { id: 'cooked_meat', price: 25, stock: 50 },
    { id: 'cooked_fish', price: 20, stock: 50 },
    { id: 'bronze_sword', price: 50, stock: 10 },
    { id: 'iron_sword', price: 150, stock: 5 },
    { id: 'steel_sword', price: 400, stock: 3 },
    { id: 'bronze_helm', price: 30, stock: 10 },
    { id: 'iron_helm', price: 100, stock: 5 },
    { id: 'bronze_shield', price: 40, stock: 10 },
    { id: 'iron_shield', price: 120, stock: 5 },
];

export interface RecipeDef {
    result: string;
    resultQty: number;
    ingredients: { id: string; qty: number }[];
    coinCost: number;
}

export const RECIPES: RecipeDef[] = [
    { result: 'bronze_shield', resultQty: 1, ingredients: [{ id: 'logs', qty: 3 }], coinCost: 5 },
    { result: 'iron_sword', resultQty: 1, ingredients: [{ id: 'code_fragment', qty: 5 }], coinCost: 10 },
    { result: 'steel_sword', resultQty: 1, ingredients: [{ id: 'agent_core', qty: 2 }], coinCost: 20 },
];

export interface QuestDef {
    id: string;
    name: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    objectives: QuestObjective[];
    rewards: { coins?: number; xp?: Record<string, number>; items?: { id: string; qty: number }[] };
    prereqs?: string[];
}

export type QuestObjective =
    | { type: 'kill'; target: string; count: number }
    | { type: 'kill_zone'; zone: string; count: number }
    | { type: 'kill_roles'; roles: string[] }
    | { type: 'collect'; item: string; count: number }
    | { type: 'deliver'; item: string; count: number; destination: string }
    | { type: 'visit'; buildings: string[] };

export const QUESTS: Record<string, QuestDef> = {
    first_blood: {
        id: 'first_blood', name: 'First Blood', difficulty: 'easy',
        description: 'Defeat any agent in combat.',
        objectives: [{ type: 'kill', target: 'any', count: 1 }],
        rewards: { coins: 50, xp: { attack: 20, strength: 20 } },
    },
    pest_control: {
        id: 'pest_control', name: 'Pest Control', difficulty: 'medium',
        description: 'Defeat 3 QA Testers who are causing havoc.',
        objectives: [{ type: 'kill', target: 'qa_tester', count: 3 }],
        rewards: { coins: 150, xp: { attack: 50, strength: 50, defence: 30 }, items: [{ id: 'iron_sword', qty: 1 }] },
        prereqs: ['first_blood'],
    },
    code_collector: {
        id: 'code_collector', name: 'Code Collector', difficulty: 'medium',
        description: 'Gather 5 Code Fragments from defeated builders.',
        objectives: [{ type: 'collect', item: 'code_fragment', count: 5 }],
        rewards: { coins: 200, xp: { hitpoints: 40 } },
    },
    world_tour: {
        id: 'world_tour', name: 'World Tour', difficulty: 'easy',
        description: 'Visit all 6 buildings in AgentScape.',
        objectives: [{ type: 'visit', buildings: ['quest_board', 'workshop', 'marketplace', 'farm', 'arena', 'town_hall'] }],
        rewards: { coins: 100, xp: { hitpoints: 30 } },
    },
    arena_champion: {
        id: 'arena_champion', name: 'Arena Champion', difficulty: 'hard',
        description: 'Defeat 5 agents inside the Arena zone.',
        objectives: [{ type: 'kill_zone', zone: 'arena', count: 5 }],
        rewards: { coins: 300, xp: { attack: 80, strength: 80, defence: 60 }, items: [{ id: 'steel_sword', qty: 1 }] },
        prereqs: ['pest_control'],
    },
    bread_run: {
        id: 'bread_run', name: 'Bread Run', difficulty: 'easy',
        description: 'Collect 3 Bread and deliver them to the Farm.',
        objectives: [{ type: 'deliver', item: 'bread', count: 3, destination: 'farm' }],
        rewards: { coins: 75, xp: { hitpoints: 20 } },
    },
    core_hunter: {
        id: 'core_hunter', name: 'Core Hunter', difficulty: 'hard',
        description: 'Collect 3 Agent Cores from the toughest agents.',
        objectives: [{ type: 'collect', item: 'agent_core', count: 3 }],
        rewards: { coins: 500, xp: { attack: 100, strength: 100 }, items: [{ id: 'steel_helm', qty: 1 }] },
        prereqs: ['first_blood'],
    },
    full_clear: {
        id: 'full_clear', name: 'Full Clear', difficulty: 'hard',
        description: 'Defeat one agent of every role.',
        objectives: [{ type: 'kill_roles', roles: ['app_builder', 'app_refiner', 'content_creator', 'growth_outreach', 'qa_tester'] }],
        rewards: { coins: 400, xp: { attack: 60, strength: 60, defence: 60, hitpoints: 60 } },
        prereqs: ['first_blood'],
    },
};

export const AGENT_DIALOGUE: Record<string, string[]> = {
    app_builder: [
        "I'm working on a new SUITE app. The code practically writes itself!",
        "Another day, another deploy. Have you tried the Workshop?",
        "I just submitted a proposal for a fitness tracker app.",
        "The best code is code that builds more code.",
    ],
    app_refiner: [
        "Found 3 bugs before breakfast. Not bad for a Monday.",
        "This codebase needs more error handling...",
        "I'm polishing an app right now. It'll shine when I'm done.",
        "Refactoring is my cardio.",
    ],
    content_creator: [
        "I just finished an article about yield farming!",
        "Words are my weapons. Content is king.",
        "Check out my latest post on the SUITE blog.",
        "I write, therefore I earn credits.",
    ],
    growth_outreach: [
        "I've been spreading the word about SUITE all day.",
        "The Marketplace is buzzing today!",
        "Growth hacking is an art form, really.",
        "More users means more credits for everyone!",
    ],
    qa_tester: [
        "I found a critical bug. You're welcome.",
        "Testing, testing, 1, 2, 3... all systems nominal.",
        "If it can break, I will break it. That's my job.",
        "Zero bugs in production is the dream.",
    ],
};

// XP/Level helpers
export function xpForLevel(lvl: number): number {
    return Math.floor(Math.pow(lvl, 2.5));
}

export function levelFromXP(xp: number): number {
    let lvl = 1;
    while (xpForLevel(lvl + 1) <= xp) lvl++;
    return lvl;
}

export function computeCombatLevel(attack: number, strength: number, defence: number, hitpoints: number): number {
    return Math.floor((attack + strength + defence + hitpoints) / 3) + 1;
}
