// AgentScape Daily Evolution Generator
// Vercel cron: generates one world evolution per day

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ── Name pools ──
const PREFIXES = [
    'Glitched', 'Corrupted', 'Phantom', 'Rogue', 'Volatile', 'Fractured',
    'Encrypted', 'Decayed', 'Mutated', 'Spectral', 'Overclocked', 'Recursive',
    'Shadow', 'Binary', 'Quantum', 'Neural', 'Toxic', 'Viral', 'Static',
    'Flickering', 'Hollow', 'Rusted', 'Shattered', 'Twisted', 'Frozen',
    'Blazing', 'Venomous', 'Feral', 'Ancient', 'Drifting', 'Wailing',
    'Scarred', 'Pulsing', 'Cracked', 'Lurking', 'Withered', 'Cloaked',
];
const SUFFIXES = [
    'Spider', 'Crawler', 'Wraith', 'Sentinel', 'Drone', 'Swarm', 'Leech',
    'Golem', 'Stalker', 'Shard', 'Node', 'Worm', 'Wisp', 'Shade',
    'Specter', 'Lurker', 'Hound', 'Serpent', 'Beetle', 'Construct',
    'Revenant', 'Phantom', 'Prowler', 'Devourer', 'Parasite', 'Abomination',
    'Sprite', 'Imp', 'Gargoyle', 'Fiend', 'Harbinger', 'Blight',
    'Scarab', 'Mantis', 'Raptor', 'Hydra', 'Basilisk', 'Chimera',
];
const ICONS = ['🕷️', '👾', '🦂', '🐛', '🦇', '🐍', '🪲', '💀', '👻', '🔮', '⚡', '🌀', '🧊', '🔥', '☠️', '🦠', '🫧', '🪬'];
const COLORS = ['#9333ea', '#dc2626', '#059669', '#d97706', '#2563eb', '#db2777', '#7c3aed', '#0891b2', '#65a30d', '#e11d48', '#6d28d9', '#ea580c'];

// Zone configs for monster generation
const ZONE_CONFIG = {
    the_forest: {
        levelRange: [2, 14], hpScale: 6, atkScale: 0.9, strScale: 0.8, defScale: 0.7,
        drops: ['corrupted_byte', 'broken_link', 'code_fragment', 'logs'],
        xpScale: 1.5,
    },
    the_ruins: {
        levelRange: [16, 29], hpScale: 7, atkScale: 1.0, strScale: 0.9, defScale: 0.85,
        drops: ['memory_shard', 'null_fragment', 'overflow_essence', 'rogue_script'],
        xpScale: 2.0,
    },
    the_deep_network: {
        levelRange: [31, 48], hpScale: 9, atkScale: 1.1, strScale: 1.0, defScale: 0.95,
        drops: ['dark_packet', 'firewall_core', 'dragon_scale'],
        xpScale: 3.0,
    },
};

// Existing monsters for balance tweaks
const TWEAKABLE_MONSTERS = [
    'spam_bot', 'broken_link_mob', 'corrupt_data', 'virus_walker',
    'memory_leak', 'stack_overflow', 'null_pointer', 'segfault_wraith',
    'dark_crawler', 'packet_storm', 'firewall_guardian', 'rootkit_shade', 'zero_day',
];

// World event templates
const EVENT_TYPES = [
    {
        type: 'xp_boost', zones: ['the_forest', 'the_ruins', 'the_deep_network'],
        titles: ['Surge of Knowledge', 'Data Overflow', 'XP Cascade', 'Neural Uplift'],
        descs: [
            'A wave of pure data washes over {zone}. All experience gained is amplified.',
            'Residual energy from a collapsed server floods {zone} with bonus XP.',
            'The network pulses with excess bandwidth. Training in {zone} is supercharged.',
        ],
    },
    {
        type: 'spawn_surge', zones: ['the_forest', 'the_ruins', 'the_deep_network'],
        titles: ['Corruption Spike', 'Monster Swarm', 'System Breach', 'Invasion Wave'],
        descs: [
            'Corrupted programs multiply across {zone}. More monsters roam the area.',
            'A breach in the firewall sends a wave of new threats into {zone}.',
            'Instability in {zone} causes creatures to spawn at an alarming rate.',
        ],
    },
    {
        type: 'rare_drops', zones: ['the_forest', 'the_ruins', 'the_deep_network'],
        titles: ['Loot Surge', 'Cache Unlock', 'Treasure Cascade', 'Fortune Tide'],
        descs: [
            'Hidden data caches surface in {zone}. Rare drops are more common.',
            'A corrupted archive spills its contents across {zone}. Loot tables are enriched.',
            'The network gods smile upon {zone}. Drop rates are boosted.',
        ],
    },
    {
        type: 'boss_enrage', zones: ['the_forest', 'the_ruins', 'the_deep_network'],
        titles: ['Boss Fury', 'Enrage Protocol', 'Alpha Awakening', 'Wrath Unleashed'],
        descs: [
            'Bosses in {zone} grow restless and more dangerous — but drop better loot.',
            'A power surge enrages the bosses of {zone}. Brave challengers are rewarded.',
            'Something stirs deep in {zone}. Boss encounters are deadlier, and more rewarding.',
        ],
    },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateMonster(dayNumber) {
    const zoneId = pick(Object.keys(ZONE_CONFIG));
    const cfg = ZONE_CONFIG[zoneId];
    const level = rand(cfg.levelRange[0], cfg.levelRange[1]);
    const prefix = pick(PREFIXES);
    const suffix = pick(SUFFIXES);
    const name = `${prefix} ${suffix}`;
    const id = name.toLowerCase().replace(/\s+/g, '_');

    const hp = Math.round(level * cfg.hpScale + rand(-5, 10));
    const attack = Math.round(level * cfg.atkScale + rand(-2, 3));
    const strength = Math.round(level * cfg.strScale + rand(-2, 3));
    const defence = Math.round(level * cfg.defScale + rand(-2, 3));

    const xpBase = Math.round(level * cfg.xpScale);
    const drops = [];
    const numDrops = rand(1, 3);
    const usedDrops = new Set();
    for (let i = 0; i < numDrops; i++) {
        let dropId;
        do { dropId = pick(cfg.drops); } while (usedDrops.has(dropId));
        usedDrops.add(dropId);
        drops.push({ id: dropId, weight: rand(20, 60), minQty: 1, maxQty: rand(2, 5) });
    }
    // Small chance of food drop
    if (Math.random() < 0.3) {
        const foods = ['bread', 'cooked_meat', 'cooked_fish'];
        drops.push({ id: pick(foods), weight: rand(10, 25), minQty: 1, maxQty: 1 });
    }

    const zoneNames = { the_forest: 'The Forest', the_ruins: 'The Ruins', the_deep_network: 'The Deep Network' };
    const descriptions = [
        `A ${prefix.toLowerCase()} entity that emerged on Day ${dayNumber}. It haunts ${zoneNames[zoneId]}.`,
        `Born from corrupted data streams, this creature appeared in ${zoneNames[zoneId]} on Day ${dayNumber}.`,
        `A ${suffix.toLowerCase()} warped by ${prefix.toLowerCase()} code. First spotted in ${zoneNames[zoneId]}.`,
        `Day ${dayNumber} brought this ${prefix.toLowerCase()} menace to ${zoneNames[zoneId]}.`,
    ];

    return {
        title: `New Creature: ${name}`,
        description: pick(descriptions),
        data: {
            monster: {
                id, name, icon: pick(ICONS), zone: zoneId, level, hp,
                attack, strength, defence,
                xpReward: { attack: xpBase, strength: Math.round(xpBase * 0.8), hitpoints: Math.round(xpBase * 0.6) },
                drops,
                coinDrop: { min: Math.round(level * 0.8), max: Math.round(level * 2.5) },
                aggressive: level > 10 || Math.random() < 0.3,
                respawnTime: rand(20, 40),
                spawnCount: rand(2, 6),
                color: pick(COLORS),
                description: pick(descriptions),
            },
        },
    };
}

function generateBalanceTweak(dayNumber) {
    const monsterId = pick(TWEAKABLE_MONSTERS);
    const name = monsterId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const stat = pick(['hp', 'attack', 'strength', 'defence']);
    const direction = Math.random() < 0.6 ? 'increase' : 'decrease';
    const pct = rand(10, 30);
    const multiplier = direction === 'increase' ? 1 + pct / 100 : 1 - pct / 100;

    const upDescs = [
        `The ${name} grows stronger. Its ${stat} has increased by ${pct}%.`,
        `Something empowers the ${name}. ${stat.charAt(0).toUpperCase() + stat.slice(1)} surges by ${pct}%.`,
        `Corruption deepens in the ${name}. Its ${stat} swells.`,
    ];
    const downDescs = [
        `The ${name} weakens. Its ${stat} has decreased by ${pct}%.`,
        `A glitch destabilizes the ${name}. ${stat.charAt(0).toUpperCase() + stat.slice(1)} drops by ${pct}%.`,
        `The ${name} falters. Its ${stat} diminishes.`,
    ];

    return {
        title: `${name} ${direction === 'increase' ? 'Empowered' : 'Weakened'}`,
        description: pick(direction === 'increase' ? upDescs : downDescs),
        data: {
            target_id: monsterId,
            stat,
            multiplier: Math.round(multiplier * 100) / 100,
            direction,
            pct,
        },
    };
}

function generateWorldEvent(dayNumber) {
    const template = pick(EVENT_TYPES);
    const zoneId = pick(template.zones);
    const zoneNames = { the_forest: 'The Forest', the_ruins: 'The Ruins', the_deep_network: 'The Deep Network' };
    const zoneName = zoneNames[zoneId];

    const multipliers = { xp_boost: rand(15, 50) / 10, spawn_surge: rand(15, 25) / 10, rare_drops: rand(15, 30) / 10, boss_enrage: rand(12, 20) / 10 };

    return {
        title: pick(template.titles),
        description: pick(template.descs).replace('{zone}', zoneName),
        data: {
            event_type: template.type,
            zone: zoneId,
            multiplier: multipliers[template.type],
            duration_hours: 24,
        },
    };
}

export default async function handler(req, res) {
    // Allow GET (cron) or POST (manual trigger)
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Calculate day number (days since launch)
        const LAUNCH_DATE = new Date('2026-03-12T00:00:00Z');
        const now = new Date();
        const dayNumber = Math.floor((now - LAUNCH_DATE) / 86400000) + 1;

        // Check if today's evolution already exists
        const { data: existing } = await sb
            .from('agentscape_evolutions')
            .select('id')
            .eq('day_number', dayNumber)
            .limit(1);

        if (existing && existing.length > 0) {
            return res.json({ message: 'Evolution already generated for today', day: dayNumber, id: existing[0].id });
        }

        // Pick evolution type (weighted)
        const roll = Math.random();
        let type, evolution;
        if (roll < 0.40) {
            type = 'new_monster';
            evolution = generateMonster(dayNumber);
        } else if (roll < 0.65) {
            type = 'balance_tweak';
            evolution = generateBalanceTweak(dayNumber);
        } else {
            type = 'world_event';
            evolution = generateWorldEvent(dayNumber);
        }

        // Insert into Supabase
        const { data: inserted, error } = await sb
            .from('agentscape_evolutions')
            .insert({
                day_number: dayNumber,
                type,
                title: evolution.title,
                description: evolution.description,
                data: evolution.data,
                active: true,
            })
            .select()
            .single();

        if (error) throw error;

        console.log(`[Evolution] Day ${dayNumber}: ${type} — ${evolution.title}`);
        res.json({ success: true, day: dayNumber, evolution: inserted });
    } catch (err) {
        console.error('[Evolution] Error:', err);
        res.status(500).json({ error: 'Failed to generate evolution', details: err.message });
    }
}
