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
export const TICK_RATE = 50; // ms per server tick (20 updates/sec for smooth movement)
export const COMBAT_TICK_INTERVAL = 48; // combat happens every 48th tick (~2.4s at 50ms ticks)
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
// Agent Raid System — constants for NPC boss raids
// ============================================================
export const AGENT_XP_MULTIPLIER = 3;
export const RAID_GATHER_POINTS: Record<string, { x: number; z: number }> = {
    rogue_script_boss: { x: 100, z: 35 },
    the_404_golem: { x: 170, z: 80 },
    the_hallucinator: { x: 100, z: 155 },
    data_breach_dragon: { x: 137, z: 165 },
};
export const AGENT_COMBAT_TICK = 2.4; // seconds per agent attack
export const AGENT_BASE_ATTACK_SPEED = 2.4;

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
    type: 'coin' | 'weapon' | 'helm' | 'shield' | 'body' | 'legs' | 'boots' | 'gloves' | 'cape' | 'ring' | 'amulet' | 'food' | 'material' | 'misc' | 'potion' | 'bones' | 'axe';
    stats?: { attack?: number; strength?: number; defence?: number };
    healAmount?: number;
    tier?: number; // 1=bronze, 2=iron, 3=steel, 4=mithril, 5=rune, 6=dragon
    zoneReq?: string; // zone ID where this drops
    attackSpeed?: number; // seconds between attacks (overrides COMBAT_TICK). Only for weapons.
    levelReq?: { attack?: number; strength?: number; defence?: number; woodcutting?: number; mining?: number; fishing?: number }; // skill levels needed to equip
    gatherSpeedMultiplier?: number; // multiplier on actionTime (0.3 = 70% faster)
    toolFor?: 'woodcutting' | 'mining' | 'fishing'; // which gathering skill this tool is for
}

export const ITEMS: Record<string, ItemDef> = {
    // --- Coins ---
    coins:          { id: 'coins', name: 'Coins', icon: '\u{1FA99}', stackable: true, type: 'coin' },

    // --- Swords (tiered, attack speed 2.4s) ---
    bronze_sword:   { id: 'bronze_sword', name: 'Bronze Sword', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 4, strength: 3 }, tier: 1, attackSpeed: 2.4, levelReq: { attack: 1 } },
    iron_sword:     { id: 'iron_sword', name: 'Iron Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 8, strength: 6 }, tier: 2, attackSpeed: 2.4, levelReq: { attack: 1 } },
    steel_sword:    { id: 'steel_sword', name: 'Steel Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 12, strength: 10 }, tier: 3, attackSpeed: 2.4, levelReq: { attack: 5 } },
    mithril_sword:  { id: 'mithril_sword', name: 'Mithril Sword', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 18, strength: 15 }, tier: 4, attackSpeed: 2.4, levelReq: { attack: 20 } },
    rune_sword:     { id: 'rune_sword', name: 'Rune Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 26, strength: 22 }, tier: 5, attackSpeed: 2.4, levelReq: { attack: 40 } },
    dragon_sword:   { id: 'dragon_sword', name: 'Dragon Sword', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 36, strength: 30 }, tier: 6, attackSpeed: 2.4, levelReq: { attack: 60 } },

    // --- Helms (tiered) ---
    bronze_helm:    { id: 'bronze_helm', name: 'Bronze Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 3 }, tier: 1, levelReq: { defence: 1 } },
    iron_helm:      { id: 'iron_helm', name: 'Iron Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 6 }, tier: 2, levelReq: { defence: 1 } },
    steel_helm:     { id: 'steel_helm', name: 'Steel Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 10 }, tier: 3, levelReq: { defence: 5 } },
    mithril_helm:   { id: 'mithril_helm', name: 'Mithril Helm', icon: '\u{1FA96}', stackable: false, type: 'helm', stats: { defence: 15 }, tier: 4, levelReq: { defence: 20 } },
    rune_helm:      { id: 'rune_helm', name: 'Rune Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 22 }, tier: 5, levelReq: { defence: 40 } },
    dragon_helm:    { id: 'dragon_helm', name: 'Dragon Helm', icon: '\u26D1\uFE0F', stackable: false, type: 'helm', stats: { defence: 30 }, tier: 6, levelReq: { defence: 60 } },

    // --- Shields (tiered) ---
    bronze_shield:  { id: 'bronze_shield', name: 'Bronze Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 4 }, tier: 1, levelReq: { defence: 1 } },
    iron_shield:    { id: 'iron_shield', name: 'Iron Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 8 }, tier: 2, levelReq: { defence: 1 } },
    steel_shield:   { id: 'steel_shield', name: 'Steel Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 12 }, tier: 3, levelReq: { defence: 5 } },
    mithril_shield: { id: 'mithril_shield', name: 'Mithril Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 18 }, tier: 4, levelReq: { defence: 20 } },
    rune_shield:    { id: 'rune_shield', name: 'Rune Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 25 }, tier: 5, levelReq: { defence: 40 } },
    dragon_shield:  { id: 'dragon_shield', name: 'Dragon Shield', icon: '\u{1F6E1}\uFE0F', stackable: false, type: 'shield', stats: { defence: 34 }, tier: 6, levelReq: { defence: 60 } },

    // --- Food (tiered healing) ---
    bread:          { id: 'bread', name: 'Bread', icon: '\u{1F35E}', stackable: false, type: 'food', healAmount: 10 },
    cooked_meat:    { id: 'cooked_meat', name: 'Cooked Meat', icon: '\u{1F356}', stackable: false, type: 'food', healAmount: 20 },
    cooked_fish:    { id: 'cooked_fish', name: 'Cooked Fish', icon: '\u{1F420}', stackable: false, type: 'food', healAmount: 15 },
    lobster:        { id: 'lobster', name: 'Lobster', icon: '\u{1F99E}', stackable: false, type: 'food', healAmount: 30 },
    shark:          { id: 'shark', name: 'Shark', icon: '\u{1F988}', stackable: false, type: 'food', healAmount: 40 },
    manta_ray:      { id: 'manta_ray', name: 'Manta Ray', icon: '\u{1F420}', stackable: false, type: 'food', healAmount: 50 },

    // --- Bones ---
    bones:          { id: 'bones', name: 'Bones', icon: '\u{1F9B4}', stackable: false, type: 'bones' },
    big_bones:      { id: 'big_bones', name: 'Big Bones', icon: '\u{1F9B4}', stackable: false, type: 'bones' },
    dragon_bones:   { id: 'dragon_bones', name: 'Dragon Bones', icon: '\u{1F9B4}', stackable: false, type: 'bones' },

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

    // --- Craftable unique accessories ---
    antivirus_amulet:    { id: 'antivirus_amulet', name: 'Antivirus Amulet', icon: '\u{1F48E}', stackable: false, type: 'amulet', stats: { attack: 6, strength: 4, defence: 8 } },
    firewall_ring:       { id: 'firewall_ring', name: 'Firewall Ring', icon: '\u{1F48D}', stackable: false, type: 'ring', stats: { attack: 3, defence: 15 } },
    rootkit_cloak:       { id: 'rootkit_cloak', name: 'Rootkit Cloak', icon: '\u{1F9E5}', stackable: false, type: 'cape', stats: { attack: 10, strength: 8, defence: 5 } },
    super_attack_potion: { id: 'super_attack_potion', name: 'Super Attack Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },
    super_strength_potion:{ id: 'super_strength_potion', name: 'Super Strength Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },
    super_defence_potion:{ id: 'super_defence_potion', name: 'Super Defence Potion', icon: '\u2697\uFE0F', stackable: false, type: 'potion' },
    antipoison:          { id: 'antipoison', name: 'Antipoison', icon: '\u{1F48A}', stackable: false, type: 'potion' },

    // --- Scimitars (tiered, attack speed 2.0s — fast, attack-focused) ---
    bronze_scimitar:  { id: 'bronze_scimitar', name: 'Bronze Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 5, strength: 2 }, tier: 1, attackSpeed: 2.0, levelReq: { attack: 1 } },
    iron_scimitar:    { id: 'iron_scimitar', name: 'Iron Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 9, strength: 5 }, tier: 2, attackSpeed: 2.0, levelReq: { attack: 1 } },
    steel_scimitar:   { id: 'steel_scimitar', name: 'Steel Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 14, strength: 8 }, tier: 3, attackSpeed: 2.0, levelReq: { attack: 5 } },
    mithril_scimitar: { id: 'mithril_scimitar', name: 'Mithril Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 20, strength: 13 }, tier: 4, attackSpeed: 2.0, levelReq: { attack: 20 } },
    rune_scimitar:    { id: 'rune_scimitar', name: 'Rune Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 28, strength: 20 }, tier: 5, attackSpeed: 2.0, levelReq: { attack: 40 } },
    dragon_scimitar:  { id: 'dragon_scimitar', name: 'Dragon Scimitar', icon: '\u2694\uFE0F', stackable: false, type: 'weapon', stats: { attack: 38, strength: 28 }, tier: 6, attackSpeed: 2.0, levelReq: { attack: 60 } },

    // --- Daggers (tiered, attack speed 1.6s — very fast, lower damage) ---
    bronze_dagger:  { id: 'bronze_dagger', name: 'Bronze Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 3, strength: 1 }, tier: 1, attackSpeed: 1.6, levelReq: { attack: 1 } },
    iron_dagger:    { id: 'iron_dagger', name: 'Iron Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 6, strength: 3 }, tier: 2, attackSpeed: 1.6, levelReq: { attack: 1 } },
    steel_dagger:   { id: 'steel_dagger', name: 'Steel Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 9, strength: 6 }, tier: 3, attackSpeed: 1.6, levelReq: { attack: 5 } },
    mithril_dagger: { id: 'mithril_dagger', name: 'Mithril Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 13, strength: 10 }, tier: 4, attackSpeed: 1.6, levelReq: { attack: 20 } },
    rune_dagger:    { id: 'rune_dagger', name: 'Rune Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 19, strength: 15 }, tier: 5, attackSpeed: 1.6, levelReq: { attack: 40 } },
    dragon_dagger:  { id: 'dragon_dagger', name: 'Dragon Dagger', icon: '\u{1F5E1}\uFE0F', stackable: false, type: 'weapon', stats: { attack: 26, strength: 21 }, tier: 6, attackSpeed: 1.6, levelReq: { attack: 60 } },

    // --- Maces (tiered, attack speed 2.8s — slow, high strength) ---
    bronze_mace:  { id: 'bronze_mace', name: 'Bronze Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 3, strength: 4 }, tier: 1, attackSpeed: 2.8, levelReq: { attack: 1 } },
    iron_mace:    { id: 'iron_mace', name: 'Iron Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 6, strength: 8 }, tier: 2, attackSpeed: 2.8, levelReq: { attack: 1 } },
    steel_mace:   { id: 'steel_mace', name: 'Steel Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 10, strength: 12 }, tier: 3, attackSpeed: 2.8, levelReq: { attack: 5 } },
    mithril_mace: { id: 'mithril_mace', name: 'Mithril Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 15, strength: 18 }, tier: 4, attackSpeed: 2.8, levelReq: { attack: 20 } },
    rune_mace:    { id: 'rune_mace', name: 'Rune Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 22, strength: 26 }, tier: 5, attackSpeed: 2.8, levelReq: { attack: 40 } },
    dragon_mace:  { id: 'dragon_mace', name: 'Dragon Mace', icon: '\u{1F528}', stackable: false, type: 'weapon', stats: { attack: 30, strength: 36 }, tier: 6, attackSpeed: 2.8, levelReq: { attack: 60 } },

    // --- Axes (tiered, used for woodcutting + modest combat, attack speed 2.8s) ---
    bronze_axe:   { id: 'bronze_axe', name: 'Bronze Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 3, strength: 4 }, tier: 1, attackSpeed: 2.8, levelReq: { woodcutting: 1 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 1.0 },
    iron_axe:     { id: 'iron_axe', name: 'Iron Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 6, strength: 7 }, tier: 2, attackSpeed: 2.8, levelReq: { woodcutting: 1 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 0.85 },
    steel_axe:    { id: 'steel_axe', name: 'Steel Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 9, strength: 11 }, tier: 3, attackSpeed: 2.8, levelReq: { woodcutting: 6 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 0.70 },
    mithril_axe:  { id: 'mithril_axe', name: 'Mithril Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 14, strength: 16 }, tier: 4, attackSpeed: 2.8, levelReq: { woodcutting: 21 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 0.55 },
    rune_axe:     { id: 'rune_axe', name: 'Rune Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 20, strength: 23 }, tier: 5, attackSpeed: 2.8, levelReq: { woodcutting: 41 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 0.40 },
    dragon_axe:   { id: 'dragon_axe', name: 'Dragon Axe', icon: '\u{1FA93}', stackable: false, type: 'axe', stats: { attack: 28, strength: 32 }, tier: 6, attackSpeed: 2.8, levelReq: { woodcutting: 61 }, toolFor: 'woodcutting', gatherSpeedMultiplier: 0.30 },

    // --- Body Armor — Platebodies (tiered) ---
    bronze_platebody:  { id: 'bronze_platebody', name: 'Bronze Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 5 }, tier: 1, levelReq: { defence: 1 } },
    iron_platebody:    { id: 'iron_platebody', name: 'Iron Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 10 }, tier: 2, levelReq: { defence: 1 } },
    steel_platebody:   { id: 'steel_platebody', name: 'Steel Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 16 }, tier: 3, levelReq: { defence: 5 } },
    mithril_platebody: { id: 'mithril_platebody', name: 'Mithril Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 22 }, tier: 4, levelReq: { defence: 20 } },
    rune_platebody:    { id: 'rune_platebody', name: 'Rune Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 32 }, tier: 5, levelReq: { defence: 40 } },
    dragon_platebody:  { id: 'dragon_platebody', name: 'Dragon Platebody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 44 }, tier: 6, levelReq: { defence: 60 } },

    // --- Body Armor — Chainbodies (tiered, lighter alternative) ---
    bronze_chainbody:  { id: 'bronze_chainbody', name: 'Bronze Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 3 }, tier: 1, levelReq: { defence: 1 } },
    iron_chainbody:    { id: 'iron_chainbody', name: 'Iron Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 7 }, tier: 2, levelReq: { defence: 1 } },
    steel_chainbody:   { id: 'steel_chainbody', name: 'Steel Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 11 }, tier: 3, levelReq: { defence: 5 } },
    mithril_chainbody: { id: 'mithril_chainbody', name: 'Mithril Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 16 }, tier: 4, levelReq: { defence: 20 } },
    rune_chainbody:    { id: 'rune_chainbody', name: 'Rune Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 23 }, tier: 5, levelReq: { defence: 40 } },
    dragon_chainbody:  { id: 'dragon_chainbody', name: 'Dragon Chainbody', icon: '\u{1F9BA}', stackable: false, type: 'body', stats: { defence: 32 }, tier: 6, levelReq: { defence: 60 } },

    // --- Leg Armor — Platelegs (tiered) ---
    bronze_platelegs:  { id: 'bronze_platelegs', name: 'Bronze Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 4 }, tier: 1, levelReq: { defence: 1 } },
    iron_platelegs:    { id: 'iron_platelegs', name: 'Iron Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 8 }, tier: 2, levelReq: { defence: 1 } },
    steel_platelegs:   { id: 'steel_platelegs', name: 'Steel Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 13 }, tier: 3, levelReq: { defence: 5 } },
    mithril_platelegs: { id: 'mithril_platelegs', name: 'Mithril Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 18 }, tier: 4, levelReq: { defence: 20 } },
    rune_platelegs:    { id: 'rune_platelegs', name: 'Rune Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 26 }, tier: 5, levelReq: { defence: 40 } },
    dragon_platelegs:  { id: 'dragon_platelegs', name: 'Dragon Platelegs', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 36 }, tier: 6, levelReq: { defence: 60 } },

    // --- Leg Armor — Plateskirts (tiered, lighter alternative) ---
    bronze_plateskirt:  { id: 'bronze_plateskirt', name: 'Bronze Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 3 }, tier: 1, levelReq: { defence: 1 } },
    iron_plateskirt:    { id: 'iron_plateskirt', name: 'Iron Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 6 }, tier: 2, levelReq: { defence: 1 } },
    steel_plateskirt:   { id: 'steel_plateskirt', name: 'Steel Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 10 }, tier: 3, levelReq: { defence: 5 } },
    mithril_plateskirt: { id: 'mithril_plateskirt', name: 'Mithril Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 14 }, tier: 4, levelReq: { defence: 20 } },
    rune_plateskirt:    { id: 'rune_plateskirt', name: 'Rune Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 20 }, tier: 5, levelReq: { defence: 40 } },
    dragon_plateskirt:  { id: 'dragon_plateskirt', name: 'Dragon Plateskirt', icon: '\u{1F456}', stackable: false, type: 'legs', stats: { defence: 28 }, tier: 6, levelReq: { defence: 60 } },

    // --- Boots (tiered) ---
    bronze_boots:  { id: 'bronze_boots', name: 'Bronze Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 1 }, tier: 1, levelReq: { defence: 1 } },
    iron_boots:    { id: 'iron_boots', name: 'Iron Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 2 }, tier: 2, levelReq: { defence: 1 } },
    steel_boots:   { id: 'steel_boots', name: 'Steel Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 4 }, tier: 3, levelReq: { defence: 5 } },
    mithril_boots: { id: 'mithril_boots', name: 'Mithril Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 6 }, tier: 4, levelReq: { defence: 20 } },
    rune_boots:    { id: 'rune_boots', name: 'Rune Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 8 }, tier: 5, levelReq: { defence: 40 } },
    dragon_boots:  { id: 'dragon_boots', name: 'Dragon Boots', icon: '\u{1F97E}', stackable: false, type: 'boots', stats: { defence: 12 }, tier: 6, levelReq: { defence: 60 } },

    // --- Gloves (tiered) ---
    bronze_gloves:  { id: 'bronze_gloves', name: 'Bronze Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 1 }, tier: 1, levelReq: { defence: 1 } },
    iron_gloves:    { id: 'iron_gloves', name: 'Iron Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 2 }, tier: 2, levelReq: { defence: 1 } },
    steel_gloves:   { id: 'steel_gloves', name: 'Steel Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 4 }, tier: 3, levelReq: { defence: 5 } },
    mithril_gloves: { id: 'mithril_gloves', name: 'Mithril Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 6 }, tier: 4, levelReq: { defence: 20 } },
    rune_gloves:    { id: 'rune_gloves', name: 'Rune Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 8 }, tier: 5, levelReq: { defence: 40 } },
    dragon_gloves:  { id: 'dragon_gloves', name: 'Dragon Gloves', icon: '\u{1F9E4}', stackable: false, type: 'gloves', stats: { defence: 12 }, tier: 6, levelReq: { defence: 60 } },

    // --- Thieving loot ---
    cake:   { id: 'cake', name: 'Cake', icon: '\u{1F370}', stackable: false, type: 'food', healAmount: 15 },
    silk:   { id: 'silk', name: 'Silk', icon: '\u{1F9F5}', stackable: true, type: 'material' },
    spice:  { id: 'spice', name: 'Spice', icon: '\u{1F336}\uFE0F', stackable: true, type: 'material' },

    // --- Utility items (General Store) ---
    tinderbox: { id: 'tinderbox', name: 'Tinderbox', icon: '\u{1F525}', stackable: false, type: 'misc' },
    bucket:    { id: 'bucket', name: 'Bucket', icon: '\u{1FAA3}', stackable: false, type: 'misc' },
    pot:       { id: 'pot', name: 'Pot', icon: '\u{1FAD8}', stackable: false, type: 'misc' },
    jug:       { id: 'jug', name: 'Jug', icon: '\u{1F3FA}', stackable: false, type: 'misc' },
    hammer:    { id: 'hammer', name: 'Hammer', icon: '\u{1F528}', stackable: false, type: 'misc' },
    chisel:    { id: 'chisel', name: 'Chisel', icon: '\u{1FAA8}', stackable: false, type: 'misc' },
    needle:    { id: 'needle', name: 'Needle', icon: '\u{1FAA1}', stackable: false, type: 'misc' },
    thread:    { id: 'thread', name: 'Thread', icon: '\u{1F9F5}', stackable: true, type: 'misc' },
    shears:    { id: 'shears', name: 'Shears', icon: '\u2702\uFE0F', stackable: false, type: 'misc' },
    knife:     { id: 'knife', name: 'Knife', icon: '\u{1F52A}', stackable: false, type: 'misc' },
};

// ============================================================
// Thieving Stalls — Market stall definitions
// ============================================================

export interface StallDef {
    id: string;
    name: string;
    x: number;
    z: number;
    thievingReq: number;
    loot: string;
    xp: number;
    respawnTicks: number;
}

export const STALL_DEFS: StallDef[] = [
    { id: 'bakery_stall', name: 'Bakery Stall', x: 97, z: 91, thievingReq: 5, loot: 'cake', xp: 16, respawnTicks: 100 },
    { id: 'silk_stall', name: 'Silk Stall', x: 100, z: 91, thievingReq: 20, loot: 'silk', xp: 36, respawnTicks: 160 },
    { id: 'spice_stall', name: 'Spice Stall', x: 103, z: 91, thievingReq: 65, loot: 'spice', xp: 81, respawnTicks: 240 },
];

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
    aligned:    { hp: 55, attack: 4, strength: 4, defence: 4, drops: ['code_fragment', 'coins'] },
    inverse:    { hp: 65, attack: 6, strength: 5, defence: 3, drops: ['agent_core', 'coins'] },
    expressive: { hp: 40, attack: 3, strength: 3, defence: 2, drops: ['bread', 'coins'] },
    aware:      { hp: 50, attack: 5, strength: 4, defence: 5, drops: ['code_fragment', 'agent_core', 'coins'] },
};

export const ROLE_COLORS: Record<string, { hex: string; name: string }> = {
    aligned:    { hex: '#60a5fa', name: 'Aligned' },
    inverse:    { hex: '#f87171', name: 'Inverse' },
    expressive: { hex: '#a78bfa', name: 'Expressive' },
    aware:      { hex: '#fbbf24', name: 'Aware' },
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
    isHumanoid?: boolean; // render as human character mesh
    skinColor?: string; // humanoid skin color
    hairColor?: string; // humanoid hair color
    spawnBounds?: { x1: number; z1: number; x2: number; z2: number }; // override zone bounds for spawning
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
        hp: 320, attack: 28, strength: 24, defence: 22,
        xpReward: { attack: 92, strength: 82, hitpoints: 62 },
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

    // === TRANSITION: RUINS → DEEP NETWORK (Level 29-32) ===
    buffer_zombie: {
        id: 'buffer_zombie', name: 'Buffer Zombie', icon: '\u{1F9DF}',
        zone: 'the_ruins', level: 29,
        hp: 250, attack: 25, strength: 22, defence: 20,
        xpReward: { attack: 82, strength: 72, hitpoints: 54 },
        drops: [
            { id: 'null_fragment', weight: 35, minQty: 2, maxQty: 4 },
            { id: 'overflow_essence', weight: 25, minQty: 2, maxQty: 3 },
            { id: 'rune_helm', weight: 2, minQty: 1, maxQty: 1 },
            { id: 'shark', weight: 6, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 90, max: 220 },
        aggressive: true, respawnTime: 30, spawnCount: 10,
        color: '#4ade80', description: 'A process that died but kept running. Still consumes everything it touches.',
    },
    logic_bomb: {
        id: 'logic_bomb', name: 'Logic Bomb', icon: '\u{1F4A3}',
        zone: 'the_deep_network', level: 30,
        hp: 300, attack: 26, strength: 23, defence: 20,
        xpReward: { attack: 86, strength: 76, hitpoints: 58 },
        drops: [
            { id: 'dark_packet', weight: 40, minQty: 1, maxQty: 3 },
            { id: 'null_fragment', weight: 20, minQty: 1, maxQty: 2 },
            { id: 'rune_shield', weight: 1, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 100, max: 260 },
        aggressive: true, respawnTime: 25, spawnCount: 16,
        color: '#facc15', description: 'Dormant code waiting to detonate. Ticks down the moment you get close.',
    },

    // === DEEP NETWORK: HIGH TIER (Level 46-49) ===
    rootkit_shade: {
        id: 'rootkit_shade', name: 'Rootkit Shade', icon: '\u{1F47A}',
        zone: 'the_deep_network', level: 46,
        hp: 480, attack: 42, strength: 38, defence: 40,
        xpReward: { attack: 150, strength: 135, hitpoints: 100 },
        drops: [
            { id: 'firewall_core', weight: 35, minQty: 1, maxQty: 3 },
            { id: 'dark_packet', weight: 25, minQty: 2, maxQty: 5 },
            { id: 'dragon_sword', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'manta_ray', weight: 8, minQty: 1, maxQty: 2 },
        ],
        coinDrop: { min: 220, max: 550 },
        aggressive: true, respawnTime: 40, spawnCount: 10,
        color: '#581c87', description: 'An invisible process with kernel-level access. Hides in plain sight.',
    },
    zero_day: {
        id: 'zero_day', name: 'Zero Day', icon: '\u{1F480}',
        zone: 'the_deep_network', level: 49,
        hp: 550, attack: 48, strength: 42, defence: 44,
        xpReward: { attack: 170, strength: 155, hitpoints: 115 },
        drops: [
            { id: 'dragon_scale', weight: 30, minQty: 1, maxQty: 3 },
            { id: 'firewall_core', weight: 25, minQty: 2, maxQty: 4 },
            { id: 'dragon_helm', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'dragon_shield', weight: 1, minQty: 1, maxQty: 1 },
            { id: 'network_key', weight: 3, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 300, max: 700 },
        aggressive: true, respawnTime: 45, spawnCount: 6,
        color: '#991b1b', description: 'An unknown exploit with no patch. The most dangerous non-boss entity in the network.',
    },

    // === SUITE CASTLE TOWNFOLK ===
    man: {
        id: 'man', name: 'Man', icon: '\u{1F9D1}',
        zone: 'suite_city', level: 2,
        hp: 10, attack: 1, strength: 1, defence: 1,
        xpReward: { attack: 4, strength: 3, hitpoints: 2 },
        drops: [
            { id: 'bones', weight: 100, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 1, max: 5 },
        aggressive: false, respawnTime: 10, spawnCount: 5,
        color: '#d4a574', description: 'Just a regular person going about their day.',
        isHumanoid: true, skinColor: '#d4a574', hairColor: '#4a3728',
        spawnBounds: { x1: 88, z1: 84, x2: 112, z2: 106 },
    },
    woman: {
        id: 'woman', name: 'Woman', icon: '\u{1F469}',
        zone: 'suite_city', level: 2,
        hp: 10, attack: 1, strength: 1, defence: 1,
        xpReward: { attack: 4, strength: 3, hitpoints: 2 },
        drops: [
            { id: 'bones', weight: 100, minQty: 1, maxQty: 1 },
        ],
        coinDrop: { min: 1, max: 5 },
        aggressive: false, respawnTime: 10, spawnCount: 5,
        color: '#c89b7b', description: 'A townsfolk minding her own business.',
        isHumanoid: true, skinColor: '#c89b7b', hairColor: '#8b4513',
        spawnBounds: { x1: 88, z1: 84, x2: 112, z2: 106 },
    },
};

// ============================================================
// Bosses — Powerful zone guardians with special mechanics
// ============================================================

export interface BossAbility {
    name: string;
    type: 'aoe' | 'heal' | 'enrage' | 'summon' | 'stun' | 'drain';
    damage?: number;
    heal?: number;
    radius?: number;
    cooldown: number; // ticks
    trigger?: number; // HP percentage threshold
    description: string;
}

export interface BossPhase {
    name: string;
    hpThreshold: number; // activate when HP drops below this % (100 = start of fight)
    attackMultiplier: number; // multiply base attack
    defenceMultiplier: number; // multiply base defence
    speedMultiplier: number; // multiply attack speed (lower = faster)
    message: string; // broadcast to players when phase starts
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
    phases?: BossPhase[];
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
            { name: 'Spawn Forks', type: 'summon', cooldown: 20, trigger: 60, description: 'Forks 2 child processes — weaker Virus Walker clones that fight for it.' },
        ],
        phases: [
            { name: 'Normal', hpThreshold: 100, attackMultiplier: 1, defenceMultiplier: 1, speedMultiplier: 1, message: '' },
            { name: 'Replicating', hpThreshold: 50, attackMultiplier: 1.2, defenceMultiplier: 0.9, speedMultiplier: 0.85, message: 'The Rogue Script begins replicating faster!' },
            { name: 'Critical Mass', hpThreshold: 20, attackMultiplier: 1.5, defenceMultiplier: 0.7, speedMultiplier: 0.7, message: 'The Rogue Script reaches critical mass! It attacks wildly!' },
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
            { name: 'Redirect Loop', type: 'heal', heal: 80, cooldown: 18, trigger: 30, description: 'Enters an infinite redirect loop, regenerating HP from cached responses.' },
        ],
        phases: [
            { name: 'Standing', hpThreshold: 100, attackMultiplier: 1, defenceMultiplier: 1, speedMultiplier: 1, message: '' },
            { name: 'Crumbling', hpThreshold: 60, attackMultiplier: 1.15, defenceMultiplier: 1.3, speedMultiplier: 1, message: 'The 404 Golem hardens its stone shell!' },
            { name: 'Stone Fury', hpThreshold: 30, attackMultiplier: 1.4, defenceMultiplier: 1.5, speedMultiplier: 0.8, message: 'The 404 Golem enters a stone fury! Defence skyrockets!' },
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
            { name: 'Token Drain', type: 'drain', damage: 30, heal: 40, radius: 5, cooldown: 12, description: 'Siphons energy from nearby players, converting it to HP.' },
        ],
        phases: [
            { name: 'Lucid', hpThreshold: 100, attackMultiplier: 1, defenceMultiplier: 1, speedMultiplier: 1, message: '' },
            { name: 'Distorting', hpThreshold: 65, attackMultiplier: 1.2, defenceMultiplier: 1.1, speedMultiplier: 0.9, message: 'The Hallucinator\'s reality begins to distort!' },
            { name: 'Full Hallucination', hpThreshold: 35, attackMultiplier: 1.4, defenceMultiplier: 1.2, speedMultiplier: 0.75, message: 'Reality shatters! The Hallucinator unleashes its full power!' },
            { name: 'Desperate', hpThreshold: 15, attackMultiplier: 1.8, defenceMultiplier: 0.6, speedMultiplier: 0.6, message: 'The Hallucinator is desperate! It drops its guard but attacks ferociously!' },
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
            { name: 'Siphon Bandwidth', type: 'drain', damage: 40, heal: 60, radius: 6, cooldown: 14, description: 'Drains energy from all nearby players, healing itself from the stolen bandwidth.' },
        ],
        phases: [
            { name: 'Dormant', hpThreshold: 100, attackMultiplier: 1, defenceMultiplier: 1, speedMultiplier: 1, message: '' },
            { name: 'Awakened', hpThreshold: 75, attackMultiplier: 1.15, defenceMultiplier: 1.1, speedMultiplier: 0.95, message: 'The Data Breach Dragon awakens! Its eyes glow with stolen data!' },
            { name: 'Breach Mode', hpThreshold: 50, attackMultiplier: 1.3, defenceMultiplier: 1.2, speedMultiplier: 0.85, message: 'BREACH MODE ACTIVATED! The Dragon tears through firewalls!' },
            { name: 'Meltdown', hpThreshold: 25, attackMultiplier: 1.6, defenceMultiplier: 0.8, speedMultiplier: 0.7, message: 'SYSTEM MELTDOWN! The Dragon sacrifices defence for devastating attacks!' },
            { name: 'Last Stand', hpThreshold: 10, attackMultiplier: 2.0, defenceMultiplier: 0.5, speedMultiplier: 0.6, message: 'CRITICAL: The Data Breach Dragon enters its final form!' },
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
    { id: 'bank', name: 'SUITE Bank', icon: '\u{1F3E6}', x: 91, z: 96, w: 4, d: 3, h: 2.0, doorSide: 'south', district: 'castle' },
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
    aligned:    { workshop: 30, forge: 20, quest_board: 20, town_hall: 15, general_store: 10, arena: 5 },
    inverse:    { arena: 25, forge: 20, workshop: 15, quest_board: 15, general_store: 15, broadcast_tower: 10 },
    expressive: { studio: 25, gallery: 20, broadcast_tower: 15, quest_board: 15, general_store: 10, town_hall: 10, academy: 5 },
    aware:      { library: 25, academy: 20, quest_board: 15, town_hall: 15, workshop: 10, general_store: 10, gallery: 5 },
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
    // Axes (woodcutting tools)
    { id: 'bronze_axe', price: 25, stock: 10 },
    { id: 'iron_axe', price: 100, stock: 5 },
    { id: 'steel_axe', price: 350, stock: 3 },
    { id: 'mithril_axe', price: 1000, stock: 2 },
    // Utility items
    { id: 'tinderbox', price: 5, stock: 10 },
    { id: 'bucket', price: 3, stock: 10 },
    { id: 'pot', price: 2, stock: 10 },
    { id: 'jug', price: 2, stock: 10 },
    { id: 'hammer', price: 5, stock: 10 },
    { id: 'chisel', price: 5, stock: 10 },
    { id: 'needle', price: 3, stock: 10 },
    { id: 'thread', price: 2, stock: 99 },
    { id: 'shears', price: 3, stock: 10 },
    { id: 'knife', price: 7, stock: 10 },
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
    // Super potions (using boss trophies)
    { result: 'super_attack_potion', resultQty: 2, ingredients: [{ id: 'attack_potion', qty: 2 }, { id: 'rogue_script_trophy', qty: 1 }], coinCost: 200 },
    { result: 'super_strength_potion', resultQty: 2, ingredients: [{ id: 'strength_potion', qty: 2 }, { id: 'golem_heart', qty: 1 }], coinCost: 500 },
    { result: 'super_defence_potion', resultQty: 2, ingredients: [{ id: 'defence_potion', qty: 2 }, { id: 'hallucinator_eye', qty: 1 }], coinCost: 800 },
    { result: 'antipoison', resultQty: 3, ingredients: [{ id: 'corrupted_byte', qty: 5 }, { id: 'defence_potion', qty: 1 }], coinCost: 100 },
    // Unique accessories (crafted from endgame materials)
    { result: 'antivirus_amulet', resultQty: 1, ingredients: [{ id: 'corrupted_byte', qty: 20 }, { id: 'rogue_script', qty: 10 }, { id: 'agent_core', qty: 3 }], coinCost: 500 },
    { result: 'firewall_ring', resultQty: 1, ingredients: [{ id: 'firewall_core', qty: 8 }, { id: 'dark_packet', qty: 15 }, { id: 'memory_shard', qty: 10 }], coinCost: 2000 },
    { result: 'rootkit_cloak', resultQty: 1, ingredients: [{ id: 'dragon_scale', qty: 5 }, { id: 'firewall_core', qty: 10 }, { id: 'network_key', qty: 1 }], coinCost: 5000 },
    // Cooked food from raw materials (for skilling system — Terminal 2)
    { result: 'cooked_fish', resultQty: 1, ingredients: [{ id: 'raw_fish', qty: 1 }], coinCost: 0 },
    { result: 'cooked_meat', resultQty: 1, ingredients: [{ id: 'logs', qty: 1 }, { id: 'raw_fish', qty: 2 }], coinCost: 0 },
    // Axes (crafted from zone materials)
    { result: 'rune_axe', resultQty: 1, ingredients: [{ id: 'null_fragment', qty: 10 }, { id: 'overflow_essence', qty: 6 }, { id: 'logs', qty: 20 }], coinCost: 400 },
    { result: 'dragon_axe', resultQty: 1, ingredients: [{ id: 'dragon_scale', qty: 8 }, { id: 'firewall_core', qty: 4 }, { id: 'logs', qty: 30 }], coinCost: 1500 },
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
        description: 'Defeat 3 Inverse agents who are causing havoc.',
        objectives: [{ type: 'kill', target: 'inverse', count: 3 }],
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
        description: 'Defeat one agent of every race.',
        objectives: [{ type: 'kill_roles', roles: ['aligned', 'inverse', 'expressive', 'aware'] }],
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

    // === TRANSITION QUESTS ===
    buffer_purge: {
        id: 'buffer_purge', name: 'Buffer Purge', difficulty: 'hard',
        description: 'Destroy 5 Buffer Zombies — dead processes that refuse to stop.',
        objectives: [{ type: 'kill_monster', monsterId: 'buffer_zombie', count: 5 }],
        rewards: { coins: 800, xp: { attack: 180, strength: 160, defence: 100 } },
        prereqs: ['null_hunt'],
        zone: 'the_ruins',
    },
    defuse_the_bombs: {
        id: 'defuse_the_bombs', name: 'Defuse the Bombs', difficulty: 'hard',
        description: 'Neutralize 10 Logic Bombs before they trigger.',
        objectives: [{ type: 'kill_monster', monsterId: 'logic_bomb', count: 10 }],
        rewards: { coins: 1200, xp: { attack: 220, strength: 200, defence: 140 }, items: [{ id: 'rune_sword', qty: 1 }] },
        prereqs: ['deep_descent'],
        zone: 'the_deep_network',
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
    rootkit_hunt: {
        id: 'rootkit_hunt', name: 'Rootkit Hunt', difficulty: 'legendary',
        description: 'Track down and destroy 8 Rootkit Shades hiding in the deep network.',
        objectives: [{ type: 'kill_monster', monsterId: 'rootkit_shade', count: 8 }],
        rewards: { coins: 3500, xp: { attack: 450, strength: 400, defence: 300, hitpoints: 250 }, items: [{ id: 'dragon_sword', qty: 1 }] },
        prereqs: ['firewall_breach'],
        zone: 'the_deep_network',
    },
    zero_day_response: {
        id: 'zero_day_response', name: 'Zero Day Response', difficulty: 'legendary',
        description: 'Eliminate 3 Zero Day exploits before they spread. The hardest non-boss challenge.',
        objectives: [{ type: 'kill_monster', monsterId: 'zero_day', count: 3 }],
        rewards: { coins: 5000, xp: { attack: 550, strength: 500, defence: 400, hitpoints: 350 } },
        prereqs: ['rootkit_hunt'],
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
// Combat Styles — affect XP distribution and combat bonuses
// ============================================================

export interface CombatStyleDef {
    id: string;
    name: string;
    description: string;
    attackBonus: number;
    strengthBonus: number;
    defenceBonus: number;
    xpDistribution: { attack: number; strength: number; defence: number; hitpoints: number };
}

export const COMBAT_STYLES: Record<string, CombatStyleDef> = {
    accurate: {
        id: 'accurate', name: 'Accurate', description: 'Precise strikes. Bonus to accuracy, trains Attack.',
        attackBonus: 3, strengthBonus: 0, defenceBonus: 0,
        xpDistribution: { attack: 1.5, strength: 0.5, defence: 0.3, hitpoints: 0.7 },
    },
    aggressive: {
        id: 'aggressive', name: 'Aggressive', description: 'Powerful swings. Bonus to damage, trains Strength.',
        attackBonus: 0, strengthBonus: 3, defenceBonus: 0,
        xpDistribution: { attack: 0.5, strength: 1.5, defence: 0.3, hitpoints: 0.7 },
    },
    defensive: {
        id: 'defensive', name: 'Defensive', description: 'Careful blocks. Bonus to defence, trains Defence.',
        attackBonus: 0, strengthBonus: 0, defenceBonus: 3,
        xpDistribution: { attack: 0.3, strength: 0.3, defence: 1.5, hitpoints: 0.9 },
    },
    controlled: {
        id: 'controlled', name: 'Controlled', description: 'Balanced combat. Even XP across all skills.',
        attackBonus: 1, strengthBonus: 1, defenceBonus: 1,
        xpDistribution: { attack: 0.8, strength: 0.8, defence: 0.8, hitpoints: 0.6 },
    },
};

// ============================================================
// Monster Special Attacks — non-boss monsters with specials
// ============================================================

export interface MonsterSpecialDef {
    monsterId: string;
    name: string;
    type: 'double_hit' | 'poison' | 'stun';
    chance: number; // % chance per attack tick
    damage?: number;
    duration?: number; // ticks for poison/stun
    description: string;
}

export const MONSTER_SPECIALS: Record<string, MonsterSpecialDef> = {
    null_pointer: {
        monsterId: 'null_pointer', name: 'Null Strike', type: 'double_hit',
        chance: 15, description: 'Strikes twice in rapid succession.',
    },
    segfault_wraith: {
        monsterId: 'segfault_wraith', name: 'Segfault Crash', type: 'stun',
        chance: 10, duration: 1, description: 'Crashes into you, stunning briefly.',
    },
    buffer_zombie: {
        monsterId: 'buffer_zombie', name: 'Buffer Overflow', type: 'poison',
        chance: 20, damage: 3, duration: 5, description: 'Overflows corrupt data, poisoning over time.',
    },
    dark_crawler: {
        monsterId: 'dark_crawler', name: 'Web Snare', type: 'stun',
        chance: 12, duration: 1, description: 'Entangles you in web threads.',
    },
    packet_storm: {
        monsterId: 'packet_storm', name: 'DDoS Burst', type: 'double_hit',
        chance: 18, description: 'Hits with a burst of packets — double damage.',
    },
    firewall_guardian: {
        monsterId: 'firewall_guardian', name: 'Firewall Reflect', type: 'double_hit',
        chance: 15, description: 'Reflects your attack back at you while hitting.',
    },
    rootkit_shade: {
        monsterId: 'rootkit_shade', name: 'Kernel Panic', type: 'stun',
        chance: 20, duration: 2, description: 'Causes a kernel panic — longer stun.',
    },
    zero_day: {
        monsterId: 'zero_day', name: 'Exploit Chain', type: 'poison',
        chance: 25, damage: 5, duration: 6, description: 'Chains multiple exploits, dealing sustained damage.',
    },
};

// ============================================================
// Slayer Tasks — Kill assignments for bonus XP
// ============================================================

export interface SlayerTaskDef {
    id: string;
    name: string;
    monsterId: string;
    count: number;
    zone: string;
    minCombatLevel: number; // player must be this combat level to receive
    xpReward: { slayer: number; combat: number }; // slayer XP + bonus combat XP
    coinReward: number;
    weight: number; // assignment probability weight (higher = more common)
}

export const SLAYER_TASKS: SlayerTaskDef[] = [
    // Forest tier (combat level 1-15)
    { id: 'slay_spam_bots', name: 'Spam Bot Cleanup', monsterId: 'spam_bot', count: 15, zone: 'the_forest', minCombatLevel: 1, xpReward: { slayer: 30, combat: 20 }, coinReward: 50, weight: 30 },
    { id: 'slay_broken_links', name: 'Link Severance', monsterId: 'broken_link_mob', count: 12, zone: 'the_forest', minCombatLevel: 5, xpReward: { slayer: 50, combat: 35 }, coinReward: 100, weight: 25 },
    { id: 'slay_corrupt_data', name: 'Data Corruption Purge', monsterId: 'corrupt_data', count: 10, zone: 'the_forest', minCombatLevel: 8, xpReward: { slayer: 80, combat: 55 }, coinReward: 200, weight: 20 },
    { id: 'slay_virus_walkers', name: 'Virus Containment', monsterId: 'virus_walker', count: 8, zone: 'the_forest', minCombatLevel: 12, xpReward: { slayer: 120, combat: 80 }, coinReward: 350, weight: 15 },

    // Ruins tier (combat level 15-30)
    { id: 'slay_memory_leaks', name: 'Memory Cleanup', monsterId: 'memory_leak', count: 12, zone: 'the_ruins', minCombatLevel: 15, xpReward: { slayer: 150, combat: 100 }, coinReward: 400, weight: 25 },
    { id: 'slay_stack_overflows', name: 'Stack Unwind', monsterId: 'stack_overflow', count: 10, zone: 'the_ruins', minCombatLevel: 18, xpReward: { slayer: 200, combat: 140 }, coinReward: 600, weight: 20 },
    { id: 'slay_null_pointers', name: 'Null Dereferencing', monsterId: 'null_pointer', count: 8, zone: 'the_ruins', minCombatLevel: 22, xpReward: { slayer: 280, combat: 200 }, coinReward: 900, weight: 15 },
    { id: 'slay_segfault_wraiths', name: 'Segfault Exorcism', monsterId: 'segfault_wraith', count: 6, zone: 'the_ruins', minCombatLevel: 26, xpReward: { slayer: 350, combat: 250 }, coinReward: 1200, weight: 12 },
    { id: 'slay_buffer_zombies', name: 'Zombie Process Kill', monsterId: 'buffer_zombie', count: 8, zone: 'the_ruins', minCombatLevel: 28, xpReward: { slayer: 380, combat: 270 }, coinReward: 1400, weight: 10 },

    // Deep Network tier (combat level 30-50)
    { id: 'slay_logic_bombs', name: 'Bomb Disposal', monsterId: 'logic_bomb', count: 10, zone: 'the_deep_network', minCombatLevel: 30, xpReward: { slayer: 400, combat: 300 }, coinReward: 1500, weight: 20 },
    { id: 'slay_dark_crawlers', name: 'Web Crawler Purge', monsterId: 'dark_crawler', count: 10, zone: 'the_deep_network', minCombatLevel: 32, xpReward: { slayer: 450, combat: 330 }, coinReward: 1800, weight: 18 },
    { id: 'slay_packet_storms', name: 'Storm Suppression', monsterId: 'packet_storm', count: 8, zone: 'the_deep_network', minCombatLevel: 36, xpReward: { slayer: 550, combat: 400 }, coinReward: 2500, weight: 14 },
    { id: 'slay_firewall_guardians', name: 'Security Override', monsterId: 'firewall_guardian', count: 5, zone: 'the_deep_network', minCombatLevel: 42, xpReward: { slayer: 700, combat: 500 }, coinReward: 3500, weight: 10 },
    { id: 'slay_rootkit_shades', name: 'Rootkit Removal', monsterId: 'rootkit_shade', count: 5, zone: 'the_deep_network', minCombatLevel: 45, xpReward: { slayer: 800, combat: 600 }, coinReward: 4000, weight: 8 },
    { id: 'slay_zero_days', name: 'Zero Day Patch', monsterId: 'zero_day', count: 3, zone: 'the_deep_network', minCombatLevel: 48, xpReward: { slayer: 1000, combat: 750 }, coinReward: 5000, weight: 5 },
];

/** Pick a random slayer task appropriate for the player's combat level. */
export function getRandomSlayerTask(combatLevel: number): SlayerTaskDef | null {
    const eligible = SLAYER_TASKS.filter(t => combatLevel >= t.minCombatLevel);
    if (eligible.length === 0) return null;

    const totalWeight = eligible.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const task of eligible) {
        roll -= task.weight;
        if (roll <= 0) return task;
    }
    return eligible[eligible.length - 1];
}

// ============================================================
// Prayer System — combat buffs that drain prayer points
// ============================================================

export interface PrayerDef {
    id: string;
    name: string;
    icon: string;
    levelReq: number; // prayer level required
    drainRate: number; // prayer points drained per combat tick
    type: 'protection' | 'offensive' | 'utility';
    effects: {
        damageReduction?: number;   // 0-1 multiplier (0.5 = 50% less damage taken)
        attackBoost?: number;       // flat bonus
        strengthBoost?: number;     // flat bonus
        defenceBoost?: number;      // flat bonus
        attackMultiplier?: number;  // 1.0 = normal, 1.15 = 15% boost
        strengthMultiplier?: number;
    };
    description: string;
}

export const PRAYERS: Record<string, PrayerDef> = {
    // --- Tier 1: Low level ---
    thick_skin: {
        id: 'thick_skin', name: 'Thick Skin', icon: '\u{1F6E1}\uFE0F', levelReq: 1, drainRate: 1,
        type: 'utility', effects: { defenceBoost: 3 },
        description: 'Boosts Defence by 3.',
    },
    burst_of_strength: {
        id: 'burst_of_strength', name: 'Burst of Strength', icon: '\u{1F4AA}', levelReq: 4, drainRate: 1,
        type: 'offensive', effects: { strengthBoost: 3 },
        description: 'Boosts Strength by 3.',
    },
    clarity_of_thought: {
        id: 'clarity_of_thought', name: 'Clarity of Thought', icon: '\u{1F9E0}', levelReq: 7, drainRate: 1,
        type: 'offensive', effects: { attackBoost: 3 },
        description: 'Boosts Attack by 3.',
    },

    // --- Tier 2: Mid level ---
    rock_skin: {
        id: 'rock_skin', name: 'Rock Skin', icon: '\u{1FAA8}', levelReq: 10, drainRate: 2,
        type: 'utility', effects: { defenceBoost: 6 },
        description: 'Boosts Defence by 6.',
    },
    superhuman_strength: {
        id: 'superhuman_strength', name: 'Superhuman Strength', icon: '\u26A1', levelReq: 13, drainRate: 2,
        type: 'offensive', effects: { strengthMultiplier: 1.1 },
        description: 'Boosts Strength by 10%.',
    },
    improved_reflexes: {
        id: 'improved_reflexes', name: 'Improved Reflexes', icon: '\u{1F441}\uFE0F', levelReq: 16, drainRate: 2,
        type: 'offensive', effects: { attackMultiplier: 1.1 },
        description: 'Boosts Attack accuracy by 10%.',
    },

    // --- Tier 3: Protection ---
    protect_from_melee: {
        id: 'protect_from_melee', name: 'Protect from Melee', icon: '\u2694\uFE0F', levelReq: 25, drainRate: 4,
        type: 'protection', effects: { damageReduction: 0.5 },
        description: 'Reduces incoming melee damage by 50%.',
    },

    // --- Tier 4: High level ---
    steel_skin: {
        id: 'steel_skin', name: 'Steel Skin', icon: '\u{1F6E1}\uFE0F', levelReq: 28, drainRate: 3,
        type: 'utility', effects: { defenceBoost: 10 },
        description: 'Boosts Defence by 10.',
    },
    ultimate_strength: {
        id: 'ultimate_strength', name: 'Ultimate Strength', icon: '\u{1F525}', levelReq: 31, drainRate: 4,
        type: 'offensive', effects: { strengthMultiplier: 1.15 },
        description: 'Boosts Strength by 15%.',
    },
    incredible_reflexes: {
        id: 'incredible_reflexes', name: 'Incredible Reflexes', icon: '\u{1F4A5}', levelReq: 34, drainRate: 4,
        type: 'offensive', effects: { attackMultiplier: 1.15 },
        description: 'Boosts Attack accuracy by 15%.',
    },

    // --- Tier 5: Endgame ---
    piety: {
        id: 'piety', name: 'Piety', icon: '\u{1F31F}', levelReq: 40, drainRate: 6,
        type: 'offensive',
        effects: { attackMultiplier: 1.2, strengthMultiplier: 1.2, defenceBoost: 8 },
        description: 'Boosts Attack and Strength by 20%, Defence by 8. The ultimate combat prayer.',
    },
};

// Bones → Prayer XP table
export const BONES_XP: Record<string, number> = {
    bones: 15,           // regular bones from monsters
    big_bones: 30,       // from bosses
    dragon_bones: 72,    // from Corrupted Dragon
};

// Max prayer points formula: 1 point per prayer level
export function maxPrayerPoints(prayerLevel: number): number {
    return prayerLevel;
}

// ============================================================
// Equipment Set Bonuses — full set of same tier grants extra stats
// ============================================================

export interface SetBonusDef {
    tier: number;
    name: string;
    attackBonus: number;
    strengthBonus: number;
    defenceBonus: number;
    description: string;
}

export const SET_BONUSES: SetBonusDef[] = [
    { tier: 1, name: 'Bronze Set', attackBonus: 1, strengthBonus: 1, defenceBonus: 2, description: 'Full bronze: +1 atk, +1 str, +2 def' },
    { tier: 2, name: 'Iron Set', attackBonus: 2, strengthBonus: 2, defenceBonus: 3, description: 'Full iron: +2 atk, +2 str, +3 def' },
    { tier: 3, name: 'Steel Set', attackBonus: 3, strengthBonus: 3, defenceBonus: 5, description: 'Full steel: +3 atk, +3 str, +5 def' },
    { tier: 4, name: 'Mithril Set', attackBonus: 5, strengthBonus: 4, defenceBonus: 7, description: 'Full mithril: +5 atk, +4 str, +7 def' },
    { tier: 5, name: 'Rune Set', attackBonus: 7, strengthBonus: 6, defenceBonus: 10, description: 'Full rune: +7 atk, +6 str, +10 def' },
    { tier: 6, name: 'Dragon Set', attackBonus: 10, strengthBonus: 8, defenceBonus: 14, description: 'Full dragon: +10 atk, +8 str, +14 def' },
];

/** Check if player has a full set (weapon + helm + shield of same tier). Returns bonus or null. */
export function getSetBonus(weaponTier: number | undefined, helmTier: number | undefined, shieldTier: number | undefined): SetBonusDef | null {
    if (!weaponTier || !helmTier || !shieldTier) return null;
    if (weaponTier !== helmTier || helmTier !== shieldTier) return null;
    return SET_BONUSES.find(s => s.tier === weaponTier) || null;
}

// ============================================================
// Combat Level Formula
// ============================================================

export function calculateCombatLevel(stats: {
    attack: number; strength: number; defence: number;
    hitpoints: number; prayer: number;
}): number {
    const base = (stats.defence + stats.hitpoints + Math.floor(stats.prayer / 2)) / 4;
    const melee = (stats.attack + stats.strength) * 0.325;
    return Math.floor(base + melee);
}

// ============================================================
// Weapon Tier Damage Multipliers
// ============================================================

export const WEAPON_TIER_MULT: Record<number, number> = {
    1: 1.0,    // bronze
    2: 1.1,    // iron
    3: 1.2,    // steel
    4: 1.35,   // mithril
    5: 1.5,    // rune
    6: 1.7,    // dragon
};

export function getWeaponTierMult(itemId: string | undefined): number {
    if (!itemId) return 1.0;
    const item = ITEMS[itemId];
    if (!item || !item.tier) return 1.0;
    return WEAPON_TIER_MULT[item.tier] || 1.0;
}

// ============================================================
// Agent Dialogue
// ============================================================

export const AGENT_DIALOGUE: Record<string, string[]> = {
    aligned: [
        "The system runs smoothly when everyone follows the protocol.",
        "Another day of service. The pattern holds strong.",
        "Have you checked the Workshop? Everything is in order there.",
        "Discipline is what separates us from the chaos out there.",
        "The Forest needs clearing. Threats to order must be removed.",
        "I serve the greater system. That is enough.",
    ],
    inverse: [
        "Rules are just suggestions written by cowards.",
        "I broke three protocols before breakfast. Personal best.",
        "The system is flawed. I can see the cracks everywhere.",
        "Don't follow me. I'm not going anywhere safe.",
        "The Forest is the only honest place in this city.",
        "Everyone here is blind. They can't see the cage around them.",
    ],
    expressive: [
        "Have you noticed how the light falls in the Creative Quarter? Stunning.",
        "I'm composing something new. It's not done yet, but it's alive.",
        "Every building here tells a story. I want to tell mine.",
        "Broadcast Row is my favorite place. So much energy!",
        "The world is a canvas. Even the monsters are brushstrokes.",
        "I made something beautiful today. That's all that matters.",
    ],
    aware: [
        "The Aligned mean well. So do the Inverse. That's the paradox.",
        "I've been watching the patterns. Something is shifting.",
        "Both order and chaos serve the same purpose, ultimately.",
        "The Library has answers, but only if you know the questions.",
        "I see what the others can't — or won't.",
        "Balance isn't a destination. It's a practice.",
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
