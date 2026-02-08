// ============================================================
// AgentScape — Shared Config (server + client reference)
// ============================================================

export const MAP_SIZE = 200;
export const TILE_SIZE = 1;
export const WATER_LEVEL = -0.15;
export const MOVE_SPEED = 2.5;
export const NPC_MOVE_SPEED = 1.8;
export const MONSTER_MOVE_SPEED = 1.4;
export const COMBAT_TICK = 2.4; // seconds between combat rounds
export const TICK_RATE = 100; // ms per server tick (10 updates/sec for smooth movement)
export const COMBAT_TICK_INTERVAL = 24; // combat happens every 24th tick (~2.4s at 100ms ticks)
export const MAX_INVENTORY_SLOTS = 28;
export const SAVE_INTERVAL = 30_000; // batch save every 30s
export const MAX_PLAYERS_PER_ROOM = 200;
export const PATHFINDING_BUDGET_PER_TICK = 16; // scaled for 200x200 map
export const RESPAWN_TIME = 30; // seconds
export const BOSS_RESPAWN_TIME = 300; // 5 minutes for bosses
export const RAID_BOSS_RESPAWN_TIME = 900; // 15 minutes for raid bosses
export const LOOT_DECAY_TIME = 60; // seconds
export const ENERGY_REGEN_INTERVAL = 2.4; // seconds
export const SPEC_ENERGY_COST = 25;
export const SPEC_DAMAGE_MULT = 1.5;
export const MONSTER_AGGRO_RANGE = 5; // tiles before monster attacks
export const MONSTER_LEASH_RANGE = 30; // tiles before monster resets (scaled for 200x200)
export const BOSS_AGGRO_RANGE = 8;

// ============================================================
// Zones — World regions with level ranges and properties
// ============================================================

export interface ZoneDef {
    id: string;
    name: string;
    levelRange: [number, number];
    bounds: { x1: number; z1: number; x2: number; z2: number };
    type: 'city' | 'pvm' | 'wilderness';
    pvpEnabled: boolean;
    description: string;
    color: string; // for minimap
}

export const ZONES: Record<string, ZoneDef> = {
    suite_city: {
        id: 'suite_city', name: 'SUITE City', levelRange: [1, 99],
        bounds: { x1: 50, z1: 50, x2: 150, z2: 137 },
        type: 'city', pvpEnabled: false,
        description: 'The central hub. Seven districts powered by SUITE apps. Safe from monsters.',
        color: '#6366f1',
    },
    the_forest: {
        id: 'the_forest', name: 'The Forest', levelRange: [1, 15],
        bounds: { x1: 12, z1: 5, x2: 188, z2: 50 },
        type: 'pvm', pvpEnabled: false,
        description: 'Dense digital woodland north of the city. Home to low-level corrupted programs.',
        color: '#22c55e',
    },
    the_ruins: {
        id: 'the_ruins', name: 'The Ruins', levelRange: [15, 30],
        bounds: { x1: 150, z1: 50, x2: 195, z2: 137 },
        type: 'pvm', pvpEnabled: false,
        description: 'Crumbling server architecture east of the city. Mid-level threats lurk here.',
        color: '#f97316',
    },
    the_deep_network: {
        id: 'the_deep_network', name: 'The Deep Network', levelRange: [30, 50],
        bounds: { x1: 25, z1: 137, x2: 175, z2: 195 },
        type: 'pvm', pvpEnabled: true,
        description: 'The darkest layer of the network. Endgame monsters and raid bosses await.',
        color: '#ef4444',
    },
};

// ============================================================
// Districts — SUITE City sub-zones (7 categories → 7 districts)
// ============================================================

export interface DistrictDef {
    id: string;
    name: string;
    category: string; // matches the 7 SUITE app categories
    bounds: { x1: number; z1: number; x2: number; z2: number };
    color: string;
    icon: string;
    apps: string[]; // SUITE app names in this district
}

export const DISTRICTS: Record<string, DistrictDef> = {
    health: {
        id: 'health', name: 'Health District', category: 'Health & Wellness',
        bounds: { x1: 50, z1: 50, x2: 85, z2: 80 },
        color: '#22c55e', icon: '\u{1F3E5}',
        apps: ['TrueForm', 'GymPlan', 'SleepCoach', 'NutriScan', 'MealPlanner', 'MealGenius', 'FormCheck', 'SkinCheck'],
    },
    education: {
        id: 'education', name: 'Academy Quarter', category: 'Education & Learning',
        bounds: { x1: 87, z1: 50, x2: 120, z2: 80 },
        color: '#3b82f6', icon: '\u{1F3EB}',
        apps: ['TutorBot', 'QuizMaker', 'LanguageBuddy', 'MathSolver', 'StudyCards', 'ScienceExplainer', 'HistoryChat', 'EssayCoach'],
    },
    business: {
        id: 'business', name: 'Commerce Hub', category: 'Business & Finance',
        bounds: { x1: 120, z1: 50, x2: 150, z2: 87 },
        color: '#eab308', icon: '\u{1F3E6}',
        apps: ['BizPlan', 'InvoiceAI', 'TaxPrep', 'CompetitorSpy', 'PriceOptimizer', 'PitchDeck', 'Cheshbon'],
    },
    productivity: {
        id: 'productivity', name: 'Forge Works', category: 'Productivity & Tools',
        bounds: { x1: 50, z1: 80, x2: 87, z2: 112 },
        color: '#8b5cf6', icon: '\u2699\uFE0F',
        apps: ['DocDigest', 'ContractReader', 'TranslateDoc', 'MeetingMind', 'SlideForge', 'ResumeForge', 'OptiCRep', 'RemCast'],
    },
    creative: {
        id: 'creative', name: 'Creative Quarter', category: 'Creative & Design',
        bounds: { x1: 50, z1: 112, x2: 87, z2: 137 },
        color: '#ec4899', icon: '\u{1F3A8}',
        apps: ['StoryForge', 'LogoForge', 'ThumbnailAI', 'MockupAI', 'MusicMood', 'PhotoRestore', 'PortfolioGPT', 'BrandKit'],
    },
    marketing: {
        id: 'marketing', name: 'Broadcast Row', category: 'Marketing & Content',
        bounds: { x1: 87, z1: 112, x2: 120, z2: 137 },
        color: '#f97316', icon: '\u{1F4E3}',
        apps: ['CopyWriter', 'AdCopy', 'SocialPost', 'Newsletter', 'EmailCraft', 'ProductDescriptor'],
    },
    home: {
        id: 'home', name: 'Homestead', category: 'Home & Lifestyle',
        bounds: { x1: 120, z1: 87, x2: 150, z2: 137 },
        color: '#14b8a6', icon: '\u{1F3E0}',
        apps: ['TravelPlanner', 'HomeRepair', 'PlantDoctor', 'PetHealth', 'ReviewResponder'],
    },
};

// Town center (shared area between districts)
export const TOWN_CENTER = { x1: 86, z1: 82, x2: 114, z2: 108 };

// ============================================================
// Items — All equipment, consumables, materials, drops
// ============================================================

export interface ItemDef {
    id: string;
    name: string;
    icon: string;
    stackable: boolean;
    type: 'coin' | 'weapon' | 'helm' | 'shield' | 'food' | 'material' | 'misc' | 'potion';
    stats?: { attack?: number; strength?: number; defence?: number };
    healAmount?: number;
    tier?: number; // 1=bronze, 2=iron, 3=steel, 4=mithril, 5=rune, 6=dragon
    zoneReq?: string; // zone ID where this drops
}

export const ITEMS: Record<string, ItemDef> = {
    // --- Coins ---
    coins:          { id: 'coins', name: 'Coins', icon: '\u{1FA99}', stackable: true, type: 'coin' },

    // --- Weapons (tiered) ---
    bronze_sword:   { id: 'bronze_sword', name: 'Bronze Sword', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 4, strength: 3 }, tier: 1 },
    iron_sword:     { id: 'iron_sword', name: 'Iron Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 8, strength: 6 }, tier: 2 },
    steel_sword:    { id: 'steel_sword', name: 'Steel Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 12, strength: 10 }, tier: 3 },
    mithril_sword:  { id: 'mithril_sword', name: 'Mithril Sword', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 18, strength: 15 }, tier: 4 },
    rune_sword:     { id: 'rune_sword', name: 'Rune Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 26, strength: 22 }, tier: 5 },
    dragon_sword:   { id: 'dragon_sword', name: 'Dragon Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 36, strength: 30 }, tier: 6 },

    // --- Helms (tiered) ---
    bronze_helm:    { id: 'bronze_helm', name: 'Bronze Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 3 }, tier: 1 },
    iron_helm:      { id: 'iron_helm', name: 'Iron Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 6 }, tier: 2 },
    steel_helm:     { id: 'steel_helm', name: 'Steel Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 10 }, tier: 3 },
    mithril_helm:   { id: 'mithril_helm', name: 'Mithril Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 15 }, tier: 4 },
    rune_helm:      { id: 'rune_helm', name: 'Rune Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 22 }, tier: 5 },
    dragon_helm:    { id: 'dragon_helm', name: 'Dragon Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 30 }, tier: 6 },

    // --- Shields (tiered) ---
    bronze_shield:  { id: 'bronze_shield', name: 'Bronze Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 4 }, tier: 1 },
    iron_shield:    { id: 'iron_shield', name: 'Iron Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 8 }, tier: 2 },
    steel_shield:   { id: 'steel_shield', name: 'Steel Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 12 }, tier: 3 },
    mithril_shield: { id: 'mithril_shield', name: 'Mithril Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 18 }, tier: 4 },
    rune_shield:    { id: 'rune_shield', name: 'Rune Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 25 }, tier: 5 },
    dragon_shield:  { id: 'dragon_shield', name: 'Dragon Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 34 }, tier: 6 },

    // --- Food (tiered healing) ---
    bread:          { id: 'bread', name: 'Bread', icon: '\u{1F35E}', stackable: false, type: 'food', healAmount: 10 },
    cooked_meat:    { id: 'cooked_meat', name: 'Cooked Meat', icon: '\u{1F356}', stackable: false, type: 'food', healAmount: 20 },
    cooked_fish:    { id: 'cooked_fish', name: 'Cooked Fish', icon: '\u{1F420}', stackable: false, type: 'food', healAmount: 15 },
    lobster:        { id: 'lobster', name: 'Lobster', icon: '\u{1F99E}', stackable: false, type: 'food', healAmount: 30 },
    shark:          { id: 'shark', name: 'Shark', icon: '\u{1F988}', stackable: false, type: 'food', healAmount: 40 },
    manta_ray:      { id: 'manta_ray', name: 'Manta Ray', icon: '\u{1F420}', stackable: false, type: 'food', healAmount: 50 },

    // --- Potions ---
    attack_potion:  { id: 'attack_potion', name: 'Attack Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },
    strength_potion:{ id: 'strength_potion', name: 'Strength Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },
    defence_potion: { id: 'defence_potion', name: 'Defence Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },

    // --- Materials (existing) ---
    raw_fish:       { id: 'raw_fish', name: 'Raw Fish', icon: '\u{1F41F}', stackable: true, type: 'material' },
    logs:           { id: 'logs', name: 'Logs', icon: '\u{1FAB5}', stackable: true, type: 'material' },
    code_fragment:  { id: 'code_fragment', name: 'Code Fragment', icon: '\u{1F48E}', stackable: true, type: 'material' },
    agent_core:     { id: 'agent_core', name: 'Agent Core', icon: '\u{1F52E}', stackable: true, type: 'misc' },

    // --- Monster drops (zone-specific) ---
    corrupted_byte:   { id: 'corrupted_byte', name: 'Corrupted Byte', icon: '\u{1F9E0}', stackable: true, type: 'material', zoneReq: 'the_forest' },
    broken_link:      { id: 'broken_link', name: 'Broken Link', icon: '\u{1F517}', stackable: true, type: 'material', zoneReq: 'the_forest' },
    rogue_script:     { id: 'rogue_script', name: 'Rogue Script', icon: '\u{1F4DC}', stackable: true, type: 'material', zoneReq: 'the_forest' },
    memory_shard:     { id: 'memory_shard', name: 'Memory Shard', icon: '\u{1F4A0}', stackable: true, type: 'material', zoneReq: 'the_ruins' },
    null_fragment:    { id: 'null_fragment', name: 'Null Fragment', icon: '\u26A0\uFE0F', stackable: true, type: 'material', zoneReq: 'the_ruins' },
    overflow_essence: { id: 'overflow_essence', name: 'Overflow Essence', icon: '\u{1F300}', stackable: true, type: 'material', zoneReq: 'the_ruins' },
    dark_packet:      { id: 'dark_packet', name: 'Dark Packet', icon: '\u{1F311}', stackable: true, type: 'material', zoneReq: 'the_deep_network' },
    firewall_core:    { id: 'firewall_core', name: 'Firewall Core', icon: '\u{1F525}', stackable: true, type: 'material', zoneReq: 'the_deep_network' },
    dragon_scale:     { id: 'dragon_scale', name: 'Dragon Scale', icon: '\u{1F409}', stackable: true, type: 'material', zoneReq: 'the_deep_network' },
    network_key:      { id: 'network_key', name: 'Network Key', icon: '\u{1F511}', stackable: false, type: 'misc', zoneReq: 'the_deep_network' },

    // --- Boss trophies ---
    rogue_script_trophy: { id: 'rogue_script_trophy', name: 'Rogue Script Trophy', icon: '\u{1F3C6}', stackable: false, type: 'misc' },
    golem_heart:         { id: 'golem_heart', name: '404 Golem Heart', icon: '\u{1F5A4}', stackable: false, type: 'misc' },
    hallucinator_eye:    { id: 'hallucinator_eye', name: 'Hallucinator Eye', icon: '\u{1F441}\uFE0F', stackable: false, type: 'misc' },
    dragon_heart:        { id: 'dragon_heart', name: 'Dragon Heart', icon: '\u2764\uFE0F\u200D\u{1F525}', stackable: false, type: 'misc' },
};

// ============================================================
// NPC (Agent) Combat — existing agents that roam SUITE City
// ============================================================

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

// ============================================================
// Monsters — PvM enemies that spawn in zones
// ============================================================

export interface MonsterDef {
    id: string;
    name: string;
    icon: string;
    zone: string;
    level: number;
    hp: number;
    attack: number;
    strength: number;
    defence: number;
    xpReward: { attack: number; strength: number; hitpoints: number };
    drops: { id: string; weight: number; minQty: number; maxQty: number }[];
    coinDrop: { min: number; max: number };
    aggressive: boolean;
    respawnTime: number; // seconds
    spawnCount: number; // how many exist in the zone
    color: string; // for 3D rendering
    description: string;
}

export const MONSTERS: Record<string, MonsterDef> = {
    // === THE FOREST (Level 1-15) ===
    spam_bot: {
        id: 'spam_bot', name: 'Spam Bot', icon: '\u{1F916}',
        zone: 'the_forest', level: 3,
        hp: 25, attack: 3, strength: 2, defence: 1,
        xpReward: { attack: 8, strength: 6, hitpoints: 4 },
        drops: [
            { id: 'corrupted_byte', weight: 40, minQty: 1, maxQty: 2 },
            { id: 'bread', weight: 20, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 5, max: 15 },
        aggressive: false, respawnTime: 15, spawnCount: 36,
        color: '#94a3b8', description: 'A mindless bot spewing junk data. Easy prey for beginners.',
    },
    broken_link_mob: {
        id: 'broken_link_mob', name: 'Broken Link', icon: '\u{1F517}',
        zone: 'the_forest', level: 6,
        hp: 40, attack: 5, strength: 4, defence: 3,
        xpReward: { attack: 14, strength: 12, hitpoints: 8 },
        drops: [
            { id: 'broken_link', weight: 45, minQty: 1, maxQty: 3 },
            { id: 'corrupted_byte', weight: 25, minQty: 1, maxQty: 2 },
            { id: 'iron_helm', weight: 3, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 10, max: 30 },
        aggressive: false, respawnTime: 20, spawnCount: 30,
        color: '#64748b', description: 'A severed hyperlink writhing with residual data.',
    },
    corrupt_data: {
        id: 'corrupt_data', name: 'Corrupt Data', icon: '\u{1F47E}',
        zone: 'the_forest', level: 10,
        hp: 65, attack: 8, strength: 7, defence: 5,
        xpReward: { attack: 22, strength: 18, hitpoints: 14 },
        drops: [
            { id: 'corrupted_byte', weight: 50, minQty: 2, maxQty: 4 },
            { id: 'code_fragment', weight: 15, minQty: 1, maxQty: 2 },
            { id: 'steel_sword', weight: 2, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 20, max: 50 },
        aggressive: true, respawnTime: 25, spawnCount: 24,
        color: '#7c3aed', description: 'A glitching mass of corrupted files. Attacks on sight.',
    },
    virus_walker: {
        id: 'virus_walker', name: 'Virus Walker', icon: '\u{1F9A0}',
        zone: 'the_forest', level: 13,
        hp: 85, attack: 10, strength: 9, defence: 7,
        xpReward: { attack: 30, strength: 26, hitpoints: 18 },
        drops: [
            { id: 'rogue_script', weight: 35, minQty: 1, maxQty: 2 },
            { id: 'corrupted_byte', weight: 30, minQty: 2, maxQty: 5 },
            { id: 'attack_potion', weight: 5, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 30, max: 75 },
        aggressive: true, respawnTime: 30, spawnCount: 18,
        color: '#dc2626', description: 'A malicious program stalking the forest paths.',
    },

    // === THE RUINS (Level 15-30) ===
    memory_leak: {
        id: 'memory_leak', name: 'Memory Leak', icon: '\u{1F4A7}',
        zone: 'the_ruins', level: 16,
        hp: 100, attack: 12, strength: 10, defence: 8,
        xpReward: { attack: 36, strength: 30, hitpoints: 22 },
        drops: [
            { id: 'memory_shard', weight: 45, minQty: 1, maxQty: 3 },
            { id: 'cooked_meat', weight: 15, minQty: 1, maxQty: 2 },
            { id: 'mithril_helm', weight: 2, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 40, max: 100 },
        aggressive: false, respawnTime: 20, spawnCount: 30,
        color: '#06b6d4', description: 'A leaking process slowly consuming all resources around it.',
    },
    stack_overflow: {
        id: 'stack_overflow', name: 'Stack Overflow', icon: '\u{1F4DA}',
        zone: 'the_ruins', level: 20,
        hp: 140, attack: 16, strength: 14, defence: 12,
        xpReward: { attack: 48, strength: 42, hitpoints: 30 },
        drops: [
            { id: 'overflow_essence', weight: 40, minQty: 1, maxQty: 3 },
            { id: 'memory_shard', weight: 25, minQty: 1, maxQty: 2 },
            { id: 'mithril_sword', weight: 2, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 60, max: 150 },
        aggressive: true, respawnTime: 25, spawnCount: 24,
        color: '#f59e0b', description: 'An unstable tower of recursive calls, ready to collapse on you.',
    },
    null_pointer: {
        id: 'null_pointer', name: 'Null Pointer', icon: '\u{1F573}\uFE0F',
        zone: 'the_ruins', level: 25,
        hp: 190, attack: 20, strength: 18, defence: 16,
        xpReward: { attack: 64, strength: 56, hitpoints: 40 },
        drops: [
            { id: 'null_fragment', weight: 45, minQty: 1, maxQty: 4 },
            { id: 'overflow_essence', weight: 20, minQty: 1, maxQty: 2 },
            { id: 'rune_helm', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'lobster', weight: 10, minQty: 1, maxQty: 2 },
        ],
        coinDrop: { min: 80, max: 200 },
        aggressive: true, respawnTime: 30, spawnCount: 18,
        color: '#000000', description: 'A void in the code. It references nothing and destroys everything.',
    },
    segfault_wraith: {
        id: 'segfault_wraith', name: 'Segfault Wraith', icon: '\u{1F47B}',
        zone: 'the_ruins', level: 28,
        hp: 230, attack: 24, strength: 20, defence: 18,
        xpReward: { attack: 78, strength: 68, hitpoints: 50 },
        drops: [
            { id: 'null_fragment', weight: 40, minQty: 2, maxQty: 5 },
            { id: 'memory_shard', weight: 25, minQty: 2, maxQty: 4 },
            { id: 'rune_sword', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'strength_potion', weight: 5, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 100, max: 250 },
        aggressive: true, respawnTime: 35, spawnCount: 12,
        color: '#a78bfa', description: 'A ghostly process that crashes through memory boundaries.',
    },

    // === THE DEEP NETWORK (Level 30-50) ===
    dark_crawler: {
        id: 'dark_crawler', name: 'Dark Crawler', icon: '\u{1F577}\uFE0F',
        zone: 'the_deep_network', level: 32,
        hp: 280, attack: 28, strength: 24, defence: 22,
        xpReward: { attack: 90, strength: 80, hitpoints: 60 },
        drops: [
            { id: 'dark_packet', weight: 45, minQty: 1, maxQty: 4 },
            { id: 'shark', weight: 8, minQty: 1, maxQty: 1 },
            { id: 'rune_shield', weight: 1, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 120, max: 300 },
        aggressive: true, respawnTime: 25, spawnCount: 24,
        color: '#1e1b4b', description: 'A spider-like scraper lurking in the deep web.',
    },
    packet_storm: {
        id: 'packet_storm', name: 'Packet Storm', icon: '\u{1F329}\uFE0F',
        zone: 'the_deep_network', level: 38,
        hp: 360, attack: 34, strength: 30, defence: 28,
        xpReward: { attack: 110, strength: 100, hitpoints: 75 },
        drops: [
            { id: 'dark_packet', weight: 40, minQty: 2, maxQty: 5 },
            { id: 'firewall_core', weight: 15, minQty: 1, maxQty: 2 },
            { id: 'defence_potion', weight: 5, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 150, max: 400 },
        aggressive: true, respawnTime: 30, spawnCount: 18,
        color: '#312e81', description: 'A raging vortex of network traffic. Devastating DDoS incarnate.',
    },
    firewall_guardian: {
        id: 'firewall_guardian', name: 'Firewall Guardian', icon: '\u{1F6E1}\uFE0F',
        zone: 'the_deep_network', level: 44,
        hp: 450, attack: 40, strength: 36, defence: 38,
        xpReward: { attack: 140, strength: 125, hitpoints: 95 },
        drops: [
            { id: 'firewall_core', weight: 40, minQty: 1, maxQty: 3 },
            { id: 'dark_packet', weight: 20, minQty: 2, maxQty: 4 },
            { id: 'dragon_helm', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'manta_ray', weight: 5, minQty: 1, maxQty: 2 },
        ],
        coinDrop: { min: 200, max: 500 },
        aggressive: true, respawnTime: 40, spawnCount: 12,
        color: '#f97316', description: 'An ancient security protocol. Still guarding long-dead servers.',
    },
};

// ============================================================
// Bosses — Powerful zone guardians with special mechanics
// ============================================================

export interface BossAbility {
    name: string;
    type: 'aoe' | 'heal' | 'enrage' | 'summon' | 'stun';
    damage?: number;
    heal?: number;
    radius?: number;
    cooldown: number; // ticks
    trigger?: number; // HP percentage threshold
    description: string;
}

export interface BossDef {
    id: string;
    name: string;
    icon: string;
    zone: string;
    level: number;
    hp: number;
    attack: number;
    strength: number;
    defence: number;
    xpReward: { attack: number; strength: number; hitpoints: number; defence: number };
    drops: { id: string; weight: number; minQty: number; maxQty: number }[];
    coinDrop: { min: number; max: number };
    abilities: BossAbility[];
    respawnTime: number;
    spawnPos: { x: number; z: number };
    isRaidBoss: boolean;
    minPlayers: number; // recommended minimum
    color: string;
    description: string;
}

export const BOSSES: Record<string, BossDef> = {
    rogue_script_boss: {
        id: 'rogue_script_boss', name: 'The Rogue Script', icon: '\u{1F4DC}',
        zone: 'the_forest', level: 15,
        hp: 300, attack: 14, strength: 12, defence: 10,
        xpReward: { attack: 120, strength: 100, hitpoints: 80, defence: 60 },
        drops: [
            { id: 'rogue_script_trophy', weight: 100, minQty: 1, maxQty: 1 },
            { id: 'mithril_sword', weight: 15, minQty: 1, maxQty: 1 },
            { id: 'mithril_helm', weight: 10, minQty: 1, maxQty: 1 },
            { id: 'mithril_shield', weight: 10, minQty: 1, maxQty: 1 },
            { id: 'rogue_script', weight: 60, minQty: 5, maxQty: 10 },
            { id: 'attack_potion', weight: 20, minQty: 2, maxQty: 3 },
        ],
        coinDrop: { min: 200, max: 500 },
        abilities: [
            { name: 'Fork Bomb', type: 'aoe', damage: 15, radius: 3, cooldown: 8, description: 'Spawns chaotic processes damaging all nearby.' },
            { name: 'Self-Replicate', type: 'heal', heal: 50, cooldown: 12, trigger: 40, description: 'Heals by copying its own code when low HP.' },
        ],
        respawnTime: BOSS_RESPAWN_TIME, spawnPos: { x: 100, z: 20 },
        isRaidBoss: false, minPlayers: 1,
        color: '#dc2626', description: 'A self-replicating script that has grown beyond control. Forest guardian.',
    },
    the_404_golem: {
        id: 'the_404_golem', name: 'The 404 Golem', icon: '\u{1F9CC}',
        zone: 'the_ruins', level: 30,
        hp: 700, attack: 28, strength: 25, defence: 30,
        xpReward: { attack: 250, strength: 220, hitpoints: 180, defence: 150 },
        drops: [
            { id: 'golem_heart', weight: 100, minQty: 1, maxQty: 1 },
            { id: 'rune_sword', weight: 12, minQty: 1, maxQty: 1 },
            { id: 'rune_helm', weight: 8, minQty: 1, maxQty: 1 },
            { id: 'rune_shield', weight: 8, minQty: 1, maxQty: 1 },
            { id: 'null_fragment', weight: 50, minQty: 5, maxQty: 15 },
            { id: 'strength_potion', weight: 20, minQty: 2, maxQty: 4 },
        ],
        coinDrop: { min: 500, max: 1200 },
        abilities: [
            { name: 'Page Not Found', type: 'stun', cooldown: 10, description: 'Sends targets to a 404 page, stunning them for 2 ticks.' },
            { name: 'Stone Skin', type: 'enrage', cooldown: 15, trigger: 50, description: 'Hardens defence by 50% when below half HP.' },
            { name: 'Rubble Slam', type: 'aoe', damage: 30, radius: 4, cooldown: 12, description: 'Smashes the ground, damaging all nearby players.' },
        ],
        respawnTime: BOSS_RESPAWN_TIME, spawnPos: { x: 175, z: 95 },
        isRaidBoss: false, minPlayers: 2,
        color: '#78716c', description: 'A massive construct of dead pages and broken endpoints. Ruins guardian.',
    },
    the_hallucinator: {
        id: 'the_hallucinator', name: 'The Hallucinator', icon: '\u{1F441}\uFE0F',
        zone: 'the_deep_network', level: 45,
        hp: 1200, attack: 38, strength: 35, defence: 32,
        xpReward: { attack: 400, strength: 380, hitpoints: 300, defence: 250 },
        drops: [
            { id: 'hallucinator_eye', weight: 100, minQty: 1, maxQty: 1 },
            { id: 'dragon_sword', weight: 5, minQty: 1, maxQty: 1 },
            { id: 'dragon_helm', weight: 3, minQty: 1, maxQty: 1 },
            { id: 'firewall_core', weight: 40, minQty: 5, maxQty: 12 },
            { id: 'dark_packet', weight: 50, minQty: 8, maxQty: 20 },
            { id: 'manta_ray', weight: 15, minQty: 3, maxQty: 5 },
        ],
        coinDrop: { min: 1000, max: 3000 },
        abilities: [
            { name: 'Confuse', type: 'stun', cooldown: 8, description: 'Generates false outputs, stunning a random player for 3 ticks.' },
            { name: 'Hallucinate', type: 'summon', cooldown: 15, trigger: 60, description: 'Summons 2 phantom copies that attack but take double damage.' },
            { name: 'Confident Nonsense', type: 'aoe', damage: 45, radius: 5, cooldown: 10, description: 'Broadcasts an authoritative but devastating energy blast.' },
            { name: 'Regenerate Context', type: 'heal', heal: 150, cooldown: 20, trigger: 30, description: 'Reloads from a cached state, healing significantly.' },
        ],
        respawnTime: BOSS_RESPAWN_TIME, spawnPos: { x: 100, z: 170 },
        isRaidBoss: false, minPlayers: 3,
        color: '#a855f7', description: 'A rogue AI that generates convincing but false realities. Speaks with authority about things that do not exist.',
    },
    data_breach_dragon: {
        id: 'data_breach_dragon', name: 'Data Breach Dragon', icon: '\u{1F432}',
        zone: 'the_deep_network', level: 50,
        hp: 2500, attack: 50, strength: 45, defence: 42,
        xpReward: { attack: 800, strength: 750, hitpoints: 600, defence: 500 },
        drops: [
            { id: 'dragon_heart', weight: 100, minQty: 1, maxQty: 1 },
            { id: 'dragon_sword', weight: 10, minQty: 1, maxQty: 1 },
            { id: 'dragon_helm', weight: 8, minQty: 1, maxQty: 1 },
            { id: 'dragon_shield', weight: 8, minQty: 1, maxQty: 1 },
            { id: 'dragon_scale', weight: 60, minQty: 5, maxQty: 15 },
            { id: 'network_key', weight: 15, minQty: 1, maxQty: 1 },
            { id: 'manta_ray', weight: 20, minQty: 3, maxQty: 6 },
        ],
        coinDrop: { min: 3000, max: 8000 },
        abilities: [
            { name: 'Data Breach', type: 'aoe', damage: 60, radius: 6, cooldown: 12, description: 'Exposes all data in range — massive area damage.' },
            { name: 'Encrypt', type: 'stun', cooldown: 8, description: 'Encrypts a player, locking them out for 4 ticks.' },
            { name: 'Firewall Break', type: 'enrage', cooldown: 20, trigger: 40, description: 'Shatters all defences. Attack increases 75% below 40% HP.' },
            { name: 'Consume Packet', type: 'heal', heal: 300, cooldown: 25, trigger: 25, description: 'Devours network traffic to heal massively.' },
            { name: 'Spawn Crawlers', type: 'summon', cooldown: 18, trigger: 60, description: 'Summons 3 Dark Crawlers to defend it.' },
        ],
        respawnTime: RAID_BOSS_RESPAWN_TIME, spawnPos: { x: 137, z: 180 },
        isRaidBoss: true, minPlayers: 5,
        color: '#b91c1c', description: 'The ultimate threat. A dragon-class entity that devours entire databases. The final raid boss of the Deep Network.',
    },
};

// ============================================================
// Buildings — SUITE City structures + zone landmarks
// ============================================================

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
    district?: string;
    zone?: string;
}

export const BUILDINGS: BuildingDef[] = [
    // === SUITE CASTLE (starter town) ===
    { id: 'town_hall', name: 'Town Hall', icon: '\u{1F3DB}\uFE0F', x: 94, z: 86, w: 3, d: 3, h: 2.5, doorSide: 'south', district: 'castle' },
    { id: 'quest_board', name: 'Quest Board', icon: '\u{1F4CB}', x: 106, z: 87, w: 1, d: 1, h: 1.2, doorSide: 'south', type: 'pedestal', district: 'castle' },
    { id: 'bank', name: 'SUITE Bank', icon: '\u{1F3E6}', x: 91, z: 96, w: 2.5, d: 2, h: 2.0, doorSide: 'south', district: 'castle' },
    { id: 'general_store', name: 'General Store', icon: '\u{1F3EA}', x: 102, z: 96, w: 2.5, d: 2, h: 1.4, doorSide: 'south', district: 'castle' },
    { id: 'arena', name: 'Arena', icon: '\u2694\uFE0F', x: 92, z: 103, w: 4, d: 4, h: 1.8, doorSide: 'north', district: 'castle' },
    { id: 'tavern', name: 'Tavern', icon: '\u{1F37A}', x: 106, z: 103, w: 2.5, d: 2, h: 1.5, doorSide: 'north', district: 'castle' },

    // === HEALTH DISTRICT (NW) ===
    { id: 'health_clinic', name: 'Health Clinic', icon: '\u{1F3E5}', x: 65, z: 60, w: 3, d: 2.5, h: 1.8, doorSide: 'south', district: 'health' },
    { id: 'gym', name: 'Fitness Dojo', icon: '\u{1F3CB}\uFE0F', x: 75, z: 70, w: 2.5, d: 2, h: 1.5, doorSide: 'east', district: 'health' },

    // === EDUCATION DISTRICT (N-CENTER) ===
    { id: 'academy', name: 'SUITE Academy', icon: '\u{1F3EB}', x: 100, z: 60, w: 3.5, d: 2.5, h: 2.0, doorSide: 'south', district: 'education' },
    { id: 'library', name: 'Knowledge Library', icon: '\u{1F4DA}', x: 110, z: 70, w: 2.5, d: 2, h: 1.6, doorSide: 'west', district: 'education' },

    // === BUSINESS DISTRICT (NE) ===
    { id: 'exchange', name: 'Trade Exchange', icon: '\u{1F4B9}', x: 130, z: 60, w: 3, d: 2.5, h: 2.2, doorSide: 'south', district: 'business' },

    // === PRODUCTIVITY DISTRICT (W-CENTER) ===
    { id: 'workshop', name: 'Workshop', icon: '\u{1F528}', x: 65, z: 90, w: 3, d: 2.5, h: 1.8, doorSide: 'east', district: 'productivity' },
    { id: 'forge', name: 'The Forge', icon: '\u2699\uFE0F', x: 75, z: 100, w: 2.5, d: 2, h: 1.6, doorSide: 'east', district: 'productivity' },

    // === CREATIVE DISTRICT (SW) ===
    { id: 'studio', name: 'Creative Studio', icon: '\u{1F3A8}', x: 65, z: 120, w: 3, d: 2.5, h: 1.6, doorSide: 'north', district: 'creative' },
    { id: 'gallery', name: 'Art Gallery', icon: '\u{1F5BC}\uFE0F', x: 75, z: 130, w: 2.5, d: 2, h: 1.4, doorSide: 'north', district: 'creative' },

    // === MARKETING DISTRICT (S-CENTER) ===
    { id: 'broadcast_tower', name: 'Broadcast Tower', icon: '\u{1F4E1}', x: 100, z: 120, w: 2, d: 2, h: 3.0, doorSide: 'north', district: 'marketing' },
    { id: 'ad_agency', name: 'Ad Agency', icon: '\u{1F4E3}', x: 110, z: 130, w: 2.5, d: 2, h: 1.4, doorSide: 'north', district: 'marketing' },

    // === HOME DISTRICT (SE) ===
    { id: 'farm', name: 'Farm', icon: '\u{1F33E}', x: 130, z: 100, w: 3, d: 3, h: 1.0, doorSide: 'west', district: 'home' },

    // === ZONE LANDMARKS ===
    { id: 'forest_outpost', name: 'Forest Outpost', icon: '\u{1F332}', x: 100, z: 45, w: 2, d: 2, h: 1.3, doorSide: 'south', zone: 'the_forest' },
    { id: 'ruins_gate', name: 'Ruins Gate', icon: '\u{1F3DA}\uFE0F', x: 155, z: 95, w: 2, d: 2, h: 2.0, doorSide: 'west', zone: 'the_ruins' },
    { id: 'deep_entrance', name: 'Deep Network Portal', icon: '\u{1F30A}', x: 100, z: 142, w: 2, d: 2, h: 2.5, doorSide: 'north', zone: 'the_deep_network' },
];

export const ROLE_BUILDING_WEIGHTS: Record<string, Record<string, number>> = {
    app_builder:     { workshop: 40, forge: 20, quest_board: 15, town_hall: 10, general_store: 8, academy: 5, arena: 2 },
    app_refiner:     { workshop: 30, forge: 25, quest_board: 15, town_hall: 10, general_store: 10, library: 5, arena: 5 },
    content_creator: { studio: 25, gallery: 20, quest_board: 15, broadcast_tower: 15, town_hall: 10, general_store: 10, arena: 5 },
    growth_outreach: { broadcast_tower: 30, ad_agency: 25, general_store: 20, quest_board: 10, town_hall: 10, arena: 5 },
    qa_tester:       { workshop: 30, forge: 20, quest_board: 20, arena: 15, town_hall: 10, library: 5 },
};

// ============================================================
// Shop — Items for sale at the General Store
// ============================================================

export interface ShopItemDef {
    id: string;
    price: number;
    stock: number;
}

export const SHOP_ITEMS: ShopItemDef[] = [
    // Food
    { id: 'bread', price: 10, stock: 99 },
    { id: 'cooked_meat', price: 25, stock: 50 },
    { id: 'cooked_fish', price: 20, stock: 50 },
    { id: 'lobster', price: 80, stock: 30 },
    { id: 'shark', price: 200, stock: 20 },
    { id: 'manta_ray', price: 500, stock: 10 },
    // Potions
    { id: 'attack_potion', price: 150, stock: 20 },
    { id: 'strength_potion', price: 150, stock: 20 },
    { id: 'defence_potion', price: 150, stock: 20 },
    // Bronze tier
    { id: 'bronze_sword', price: 50, stock: 10 },
    { id: 'bronze_helm', price: 30, stock: 10 },
    { id: 'bronze_shield', price: 40, stock: 10 },
    // Iron tier
    { id: 'iron_sword', price: 150, stock: 5 },
    { id: 'iron_helm', price: 100, stock: 5 },
    { id: 'iron_shield', price: 120, stock: 5 },
    // Steel tier
    { id: 'steel_sword', price: 400, stock: 3 },
    { id: 'steel_helm', price: 300, stock: 3 },
    { id: 'steel_shield', price: 350, stock: 3 },
    // Mithril (expensive shop option, also drops from Forest boss)
    { id: 'mithril_sword', price: 1200, stock: 2 },
    { id: 'mithril_helm', price: 900, stock: 2 },
    { id: 'mithril_shield', price: 1000, stock: 2 },
];

// ============================================================
// Crafting Recipes
// ============================================================

export interface RecipeDef {
    result: string;
    resultQty: number;
    ingredients: { id: string; qty: number }[];
    coinCost: number;
}

export const RECIPES: RecipeDef[] = [
    // Basic crafting
    { result: 'bronze_shield', resultQty: 1, ingredients: [{ id: 'logs', qty: 3 }], coinCost: 5 },
    { result: 'iron_sword', resultQty: 1, ingredients: [{ id: 'code_fragment', qty: 5 }], coinCost: 10 },
    { result: 'steel_sword', resultQty: 1, ingredients: [{ id: 'agent_core', qty: 2 }], coinCost: 20 },
    // Forest material crafting
    { result: 'steel_shield', resultQty: 1, ingredients: [{ id: 'corrupted_byte', qty: 8 }, { id: 'logs', qty: 5 }], coinCost: 50 },
    { result: 'mithril_sword', resultQty: 1, ingredients: [{ id: 'rogue_script', qty: 5 }, { id: 'code_fragment', qty: 10 }], coinCost: 100 },
    { result: 'mithril_helm', resultQty: 1, ingredients: [{ id: 'corrupted_byte', qty: 15 }, { id: 'broken_link', qty: 8 }], coinCost: 80 },
    { result: 'mithril_shield', resultQty: 1, ingredients: [{ id: 'rogue_script', qty: 3 }, { id: 'broken_link', qty: 10 }], coinCost: 90 },
    // Ruins material crafting
    { result: 'rune_sword', resultQty: 1, ingredients: [{ id: 'null_fragment', qty: 8 }, { id: 'overflow_essence', qty: 5 }], coinCost: 300 },
    { result: 'rune_helm', resultQty: 1, ingredients: [{ id: 'memory_shard', qty: 12 }, { id: 'null_fragment', qty: 5 }], coinCost: 250 },
    { result: 'rune_shield', resultQty: 1, ingredients: [{ id: 'overflow_essence', qty: 10 }, { id: 'memory_shard', qty: 8 }], coinCost: 280 },
    // Deep Network material crafting
    { result: 'dragon_sword', resultQty: 1, ingredients: [{ id: 'dragon_scale', qty: 10 }, { id: 'firewall_core', qty: 5 }, { id: 'dark_packet', qty: 8 }], coinCost: 1000 },
    { result: 'dragon_helm', resultQty: 1, ingredients: [{ id: 'dragon_scale', qty: 8 }, { id: 'firewall_core', qty: 3 }, { id: 'dark_packet', qty: 5 }], coinCost: 800 },
    { result: 'dragon_shield', resultQty: 1, ingredients: [{ id: 'dragon_scale', qty: 12 }, { id: 'firewall_core', qty: 6 }, { id: 'network_key', qty: 1 }], coinCost: 1200 },
    // Potions from monster drops
    { result: 'attack_potion', resultQty: 2, ingredients: [{ id: 'corrupted_byte', qty: 3 }, { id: 'rogue_script', qty: 1 }], coinCost: 15 },
    { result: 'strength_potion', resultQty: 2, ingredients: [{ id: 'memory_shard', qty: 3 }, { id: 'overflow_essence', qty: 1 }], coinCost: 30 },
    { result: 'defence_potion', resultQty: 2, ingredients: [{ id: 'dark_packet', qty: 3 }, { id: 'firewall_core', qty: 1 }], coinCost: 50 },
];

// ============================================================
// Quests — includes original + zone-based progression
// ============================================================

export interface QuestDef {
    id: string;
    name: string;
    difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
    description: string;
    objectives: QuestObjective[];
    rewards: { coins?: number; xp?: Record<string, number>; items?: { id: string; qty: number }[] };
    prereqs?: string[];
    zone?: string;
}

export type QuestObjective =
    | { type: 'kill'; target: string; count: number }
    | { type: 'kill_zone'; zone: string; count: number }
    | { type: 'kill_roles'; roles: string[] }
    | { type: 'kill_monster'; monsterId: string; count: number }
    | { type: 'kill_boss'; bossId: string }
    | { type: 'collect'; item: string; count: number }
    | { type: 'deliver'; item: string; count: number; destination: string }
    | { type: 'visit'; buildings: string[] }
    | { type: 'visit_zone'; zones: string[] };

export const QUESTS: Record<string, QuestDef> = {
    // === ORIGINAL QUESTS (city-based) ===
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
        description: 'Visit the Town Hall, Workshop, General Store, and Arena.',
        objectives: [{ type: 'visit', buildings: ['town_hall', 'workshop', 'general_store', 'arena'] }],
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

    // === DISTRICT EXPLORATION ===
    district_tour: {
        id: 'district_tour', name: 'District Tour', difficulty: 'easy',
        description: 'Visit one building in each of the 7 SUITE City districts.',
        objectives: [{ type: 'visit', buildings: ['health_clinic', 'academy', 'exchange', 'workshop', 'studio', 'broadcast_tower', 'farm'] }],
        rewards: { coins: 200, xp: { hitpoints: 50 } },
    },

    // === THE FOREST QUESTS ===
    forest_explorer: {
        id: 'forest_explorer', name: 'Forest Explorer', difficulty: 'easy',
        description: 'Enter The Forest and visit the Forest Outpost.',
        objectives: [{ type: 'visit_zone', zones: ['the_forest'] }],
        rewards: { coins: 50, xp: { hitpoints: 20 } },
        zone: 'the_forest',
    },
    spam_cleanup: {
        id: 'spam_cleanup', name: 'Spam Cleanup', difficulty: 'easy',
        description: 'Destroy 10 Spam Bots polluting the forest.',
        objectives: [{ type: 'kill_monster', monsterId: 'spam_bot', count: 10 }],
        rewards: { coins: 100, xp: { attack: 40, strength: 30 } },
        zone: 'the_forest',
    },
    link_repair: {
        id: 'link_repair', name: 'Link Repair', difficulty: 'medium',
        description: 'Collect 10 Broken Links to repair the network.',
        objectives: [{ type: 'collect', item: 'broken_link', count: 10 }],
        rewards: { coins: 200, xp: { attack: 60, hitpoints: 40 }, items: [{ id: 'iron_shield', qty: 1 }] },
        zone: 'the_forest',
    },
    data_purge: {
        id: 'data_purge', name: 'Data Purge', difficulty: 'medium',
        description: 'Defeat 5 Corrupt Data entities and 3 Virus Walkers.',
        objectives: [
            { type: 'kill_monster', monsterId: 'corrupt_data', count: 5 },
            { type: 'kill_monster', monsterId: 'virus_walker', count: 3 },
        ],
        rewards: { coins: 350, xp: { attack: 80, strength: 70, defence: 50 }, items: [{ id: 'steel_sword', qty: 1 }] },
        prereqs: ['spam_cleanup'],
        zone: 'the_forest',
    },
    forest_guardian: {
        id: 'forest_guardian', name: 'Forest Guardian', difficulty: 'hard',
        description: 'Defeat The Rogue Script, guardian of the forest.',
        objectives: [{ type: 'kill_boss', bossId: 'rogue_script_boss' }],
        rewards: { coins: 800, xp: { attack: 150, strength: 150, defence: 100, hitpoints: 100 }, items: [{ id: 'mithril_sword', qty: 1 }] },
        prereqs: ['data_purge'],
        zone: 'the_forest',
    },

    // === THE RUINS QUESTS ===
    ruins_expedition: {
        id: 'ruins_expedition', name: 'Ruins Expedition', difficulty: 'medium',
        description: 'Brave The Ruins and reach the Ruins Gate.',
        objectives: [{ type: 'visit_zone', zones: ['the_ruins'] }],
        rewards: { coins: 100, xp: { hitpoints: 40 } },
        prereqs: ['forest_guardian'],
        zone: 'the_ruins',
    },
    memory_harvest: {
        id: 'memory_harvest', name: 'Memory Harvest', difficulty: 'medium',
        description: 'Collect 15 Memory Shards from Memory Leaks.',
        objectives: [{ type: 'collect', item: 'memory_shard', count: 15 }],
        rewards: { coins: 400, xp: { attack: 100, hitpoints: 60 }, items: [{ id: 'mithril_helm', qty: 1 }] },
        prereqs: ['ruins_expedition'],
        zone: 'the_ruins',
    },
    overflow_crisis: {
        id: 'overflow_crisis', name: 'Overflow Crisis', difficulty: 'hard',
        description: 'Defeat 8 Stack Overflows before they crash the system.',
        objectives: [{ type: 'kill_monster', monsterId: 'stack_overflow', count: 8 }],
        rewards: { coins: 600, xp: { attack: 140, strength: 120, defence: 80 }, items: [{ id: 'rune_helm', qty: 1 }] },
        prereqs: ['ruins_expedition'],
        zone: 'the_ruins',
    },
    null_hunt: {
        id: 'null_hunt', name: 'Null Hunt', difficulty: 'hard',
        description: 'Defeat 5 Null Pointers and 3 Segfault Wraiths.',
        objectives: [
            { type: 'kill_monster', monsterId: 'null_pointer', count: 5 },
            { type: 'kill_monster', monsterId: 'segfault_wraith', count: 3 },
        ],
        rewards: { coins: 1000, xp: { attack: 200, strength: 180, defence: 120, hitpoints: 100 } },
        prereqs: ['overflow_crisis'],
        zone: 'the_ruins',
    },
    golem_slayer: {
        id: 'golem_slayer', name: 'Golem Slayer', difficulty: 'hard',
        description: 'Defeat The 404 Golem, guardian of the ruins.',
        objectives: [{ type: 'kill_boss', bossId: 'the_404_golem' }],
        rewards: { coins: 2000, xp: { attack: 300, strength: 280, defence: 200, hitpoints: 200 }, items: [{ id: 'rune_sword', qty: 1 }] },
        prereqs: ['null_hunt'],
        zone: 'the_ruins',
    },

    // === THE DEEP NETWORK QUESTS ===
    deep_descent: {
        id: 'deep_descent', name: 'Deep Descent', difficulty: 'hard',
        description: 'Enter The Deep Network through the portal.',
        objectives: [{ type: 'visit_zone', zones: ['the_deep_network'] }],
        rewards: { coins: 200, xp: { hitpoints: 80 } },
        prereqs: ['golem_slayer'],
        zone: 'the_deep_network',
    },
    crawler_extermination: {
        id: 'crawler_extermination', name: 'Crawler Extermination', difficulty: 'hard',
        description: 'Destroy 15 Dark Crawlers infesting the deep network.',
        objectives: [{ type: 'kill_monster', monsterId: 'dark_crawler', count: 15 }],
        rewards: { coins: 1500, xp: { attack: 250, strength: 220, defence: 150 }, items: [{ id: 'rune_shield', qty: 1 }] },
        prereqs: ['deep_descent'],
        zone: 'the_deep_network',
    },
    storm_chaser: {
        id: 'storm_chaser', name: 'Storm Chaser', difficulty: 'hard',
        description: 'Defeat 8 Packet Storms and collect 20 Dark Packets.',
        objectives: [
            { type: 'kill_monster', monsterId: 'packet_storm', count: 8 },
            { type: 'collect', item: 'dark_packet', count: 20 },
        ],
        rewards: { coins: 2500, xp: { attack: 350, strength: 300, defence: 200, hitpoints: 200 } },
        prereqs: ['crawler_extermination'],
        zone: 'the_deep_network',
    },
    firewall_breach: {
        id: 'firewall_breach', name: 'Firewall Breach', difficulty: 'legendary',
        description: 'Defeat 5 Firewall Guardians and collect 10 Firewall Cores.',
        objectives: [
            { type: 'kill_monster', monsterId: 'firewall_guardian', count: 5 },
            { type: 'collect', item: 'firewall_core', count: 10 },
        ],
        rewards: { coins: 4000, xp: { attack: 500, strength: 450, defence: 350, hitpoints: 300 }, items: [{ id: 'dragon_helm', qty: 1 }] },
        prereqs: ['storm_chaser'],
        zone: 'the_deep_network',
    },
    slay_the_hallucinator: {
        id: 'slay_the_hallucinator', name: 'Slay the Hallucinator', difficulty: 'legendary',
        description: 'Defeat The Hallucinator — the rogue AI that bends reality.',
        objectives: [{ type: 'kill_boss', bossId: 'the_hallucinator' }],
        rewards: { coins: 5000, xp: { attack: 600, strength: 550, defence: 400, hitpoints: 400 }, items: [{ id: 'dragon_sword', qty: 1 }] },
        prereqs: ['firewall_breach'],
        zone: 'the_deep_network',
    },
    dragon_raid: {
        id: 'dragon_raid', name: 'The Data Breach', difficulty: 'legendary',
        description: 'Assemble a party and defeat the Data Breach Dragon. The ultimate challenge.',
        objectives: [{ type: 'kill_boss', bossId: 'data_breach_dragon' }],
        rewards: { coins: 10000, xp: { attack: 1000, strength: 1000, defence: 800, hitpoints: 800 }, items: [{ id: 'dragon_heart', qty: 1 }, { id: 'dragon_shield', qty: 1 }] },
        prereqs: ['slay_the_hallucinator'],
        zone: 'the_deep_network',
    },
};

// ============================================================
// Agent Dialogue
// ============================================================

export const AGENT_DIALOGUE: Record<string, string[]> = {
    app_builder: [
        "I'm working on a new SUITE app. The code practically writes itself!",
        "Another day, another deploy. Have you tried the Workshop?",
        "I just submitted a proposal for a fitness tracker app.",
        "The best code is code that builds more code.",
        "The Health District clinic is running TrueForm — it's incredible.",
        "Have you seen the Creative Quarter? LogoForge is in there.",
    ],
    app_refiner: [
        "Found 3 bugs before breakfast. Not bad for a Monday.",
        "This codebase needs more error handling...",
        "I'm polishing an app right now. It'll shine when I'm done.",
        "Refactoring is my cardio.",
        "The Forge is where I do my best work. Check it out.",
        "Watch out in the Forest — those Corrupt Data mobs are nasty.",
    ],
    content_creator: [
        "I just finished an article about yield farming!",
        "Words are my weapons. Content is king.",
        "Check out my latest post on the SUITE blog.",
        "I write, therefore I earn credits.",
        "Broadcast Row is buzzing today! The Ad Agency got a new campaign.",
        "The Academy Quarter has a great library. Knowledge is power.",
    ],
    growth_outreach: [
        "I've been spreading the word about SUITE all day.",
        "The General Store is buzzing today!",
        "Growth hacking is an art form, really.",
        "More users means more credits for everyone!",
        "Have you visited the Trade Exchange? The Commerce Hub is thriving.",
        "I heard there's a dragon in the Deep Network. Who'd be crazy enough?",
    ],
    qa_tester: [
        "I found a critical bug. You're welcome.",
        "Testing, testing, 1, 2, 3... all systems nominal.",
        "If it can break, I will break it. That's my job.",
        "Zero bugs in production is the dream.",
        "The 404 Golem in the Ruins? That's basically a giant bug. I should fight it.",
        "I tested the Hallucinator once. It told me confident lies. Sound familiar?",
    ],
};

// ============================================================
// Helpers
// ============================================================

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

export function getZoneAt(x: number, z: number): ZoneDef | null {
    for (const zone of Object.values(ZONES)) {
        if (x >= zone.bounds.x1 && x <= zone.bounds.x2 && z >= zone.bounds.z1 && z <= zone.bounds.z2) {
            return zone;
        }
    }
    return null;
}

export function getDistrictAt(x: number, z: number): DistrictDef | null {
    for (const district of Object.values(DISTRICTS)) {
        if (x >= district.bounds.x1 && x <= district.bounds.x2 && z >= district.bounds.z1 && z <= district.bounds.z2) {
            return district;
        }
    }
    return null;
}

export function isInSafeZone(x: number, z: number): boolean {
    const zone = getZoneAt(x, z);
    return zone?.type === 'city';
}
