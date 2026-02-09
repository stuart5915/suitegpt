// ============================================================
// AgentScape — Agent Behavior Profiles
// Each agent race gets unique behavior weights, zone
// preferences, combat thresholds, and contextual dialogue.
// Notecard personality traits override static profiles.
// ============================================================

import { Notecard } from './Notecard';

export interface AgentProfile {
    // Combat behavior
    combatWeight: number;        // 0-100, relative weight for choosing combat
    maxMonsterLevel: number;     // Won't pursue monsters above this
    fleeHpPercent: number;       // Flee to town when HP below this %
    eatHpPercent: number;        // Eat food when HP below this %
    fightDurationBase: number;   // Base fight time (seconds)
    fightDurationVar: number;    // Random +/- variance

    // Activity weights (relative, used in weightedRandom)
    patrolWeight: number;        // Weight for zone patrol
    buildingWeight: number;      // Weight for building visits
    exploreWeight: number;       // Weight for zone exploration

    // Resource management
    shopFoodThreshold: number;   // Go shop when food below this
    maxFoodCarry: number;        // Max food to "buy" per trip

    // Social
    chatInterval: number;        // Min seconds between chat messages

    // Zone preferences (ordered by priority)
    preferredZones: string[];

    // Targets: which monster IDs this role will hunt
    huntTargets: string[];

    // Contextual dialogue lines
    dialogue: {
        hunting: string[];
        fightStart: string[];
        victory: string[];
        eating: string[];
        fleeing: string[];
        shopping: string[];
        working: string[];
        patrolling: string[];
    };
}

// ============================================================
// Race-based profiles (fallback when no notecard)
// ============================================================

export const AGENT_PROFILES: Record<string, AgentProfile> = {
    aligned: {
        combatWeight: 35,
        maxMonsterLevel: 13,
        fleeHpPercent: 20,
        eatHpPercent: 45,
        fightDurationBase: 9,
        fightDurationVar: 3,
        patrolWeight: 20,
        buildingWeight: 35,
        exploreWeight: 10,
        shopFoodThreshold: 1,
        maxFoodCarry: 5,
        chatInterval: 12,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob', 'corrupt_data', 'virus_walker'],
        dialogue: {
            hunting: [
                'Moving to clear threats. Order must be maintained.',
                'Patrolling the perimeter. Stay disciplined.',
                'The system requires defence. Engaging.',
            ],
            fightStart: [
                'Deploying combat protocols...',
                'Target acquired. Engaging.',
                'By the pattern — fight!',
            ],
            victory: [
                'Threat neutralized. The pattern holds.',
                'Another disruption resolved.',
                'Clean execution. As it should be.',
            ],
            eating: [
                '*eats bread* Maintaining operational capacity.',
                'Quick refuel. Discipline includes self-care.',
                'HP restoration in progress.',
            ],
            fleeing: [
                'Strategic withdrawal. I will return prepared.',
                'Falling back to regroup. This is not retreat.',
                'Low HP. Protocol dictates withdrawal.',
            ],
            shopping: [
                'Restocking supplies. Preparation is key.',
                'Requisitioning provisions at the Store.',
                'Supplies low. Resupplying.',
            ],
            working: [
                'Filing reports at the Workshop.',
                'Running diagnostics at the Forge.',
                'Updating protocols at the Quest Board.',
            ],
            patrolling: [
                'Maintaining patrol routes.',
                'Scanning for anomalies.',
                'All sectors nominal.',
            ],
        },
    },

    inverse: {
        combatWeight: 55,
        maxMonsterLevel: 16,
        fleeHpPercent: 15,
        eatHpPercent: 40,
        fightDurationBase: 7,
        fightDurationVar: 2,
        patrolWeight: 15,
        buildingWeight: 15,
        exploreWeight: 15,
        shopFoodThreshold: 1,
        maxFoodCarry: 7,
        chatInterval: 14,
        preferredZones: ['the_forest', 'the_ruins'],
        huntTargets: ['broken_link_mob', 'corrupt_data', 'virus_walker', 'memory_leak'],
        dialogue: {
            hunting: [
                'Time to break something.',
                'Looking for a real fight.',
                'The forest doesn\'t care about your rules.',
            ],
            fightStart: [
                'Let\'s see what you\'ve got!',
                'Finally, a challenge!',
                'Come on then!',
            ],
            victory: [
                'Ha! Too easy.',
                'Another one down. Who\'s next?',
                'That\'s what happens.',
            ],
            eating: [
                '*tears into bread* Not stopping for long.',
                'Quick bite. Got things to break.',
                'Fuel for the fire.',
            ],
            fleeing: [
                'Tch... I\'ll be back.',
                'This isn\'t over.',
                'Retreating. For now.',
            ],
            shopping: [
                'Fine. Even I need supplies.',
                'Quick stop. Don\'t look at me.',
                'Shopping is boring but necessary.',
            ],
            working: [
                'Stress-testing the Forge. For fun.',
                'Picking apart code at the Workshop.',
                'Checking if anything here is worth my time.',
            ],
            patrolling: [
                'Prowling for trouble.',
                'This city is too quiet.',
                'Looking for weak points.',
            ],
        },
    },

    expressive: {
        combatWeight: 20,
        maxMonsterLevel: 8,
        fleeHpPercent: 30,
        eatHpPercent: 55,
        fightDurationBase: 11,
        fightDurationVar: 4,
        patrolWeight: 30,
        buildingWeight: 30,
        exploreWeight: 20,
        shopFoodThreshold: 2,
        maxFoodCarry: 4,
        chatInterval: 8,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob'],
        dialogue: {
            hunting: [
                'The forest is so beautiful! Oh, and monsters.',
                'Gathering inspiration and loot!',
                'Every battle is a story. Let\'s write one.',
            ],
            fightStart: [
                'This will make a great scene!',
                '*dramatic pose* En garde!',
                'For art!',
            ],
            victory: [
                'What a performance! *takes a bow*',
                'And scene! Magnificent!',
                'I should write a song about that.',
            ],
            eating: [
                '*nibbles bread artfully*',
                'Brain food. Literally.',
                'Even artists need sustenance.',
            ],
            fleeing: [
                'A dramatic exit! I\'ll return for act two.',
                'Retreating... beautifully.',
                'The story continues elsewhere.',
            ],
            shopping: [
                'The Store has such interesting textures.',
                'Stocking up for my next adventure.',
                'Even shopping can be inspired.',
            ],
            working: [
                'Creating something wonderful at the Studio.',
                'The Gallery needs a new piece.',
                'Broadcasting art from the Tower.',
            ],
            patrolling: [
                'Wandering for inspiration.',
                'Look at this place! Every pixel sings.',
                'Exploring the beauty of the world.',
            ],
        },
    },

    aware: {
        combatWeight: 30,
        maxMonsterLevel: 13,
        fleeHpPercent: 22,
        eatHpPercent: 48,
        fightDurationBase: 9,
        fightDurationVar: 3,
        patrolWeight: 20,
        buildingWeight: 25,
        exploreWeight: 25,
        shopFoodThreshold: 1,
        maxFoodCarry: 5,
        chatInterval: 10,
        preferredZones: ['the_forest', 'the_ruins'],
        huntTargets: ['spam_bot', 'broken_link_mob', 'corrupt_data', 'virus_walker'],
        dialogue: {
            hunting: [
                'Seeking understanding through combat.',
                'Both hunter and hunted serve the cycle.',
                'There is wisdom in the forest.',
            ],
            fightStart: [
                'Let us learn from each other.',
                'Combat reveals truth.',
                'I engage with respect.',
            ],
            victory: [
                'It is done. I learned something.',
                'Victory and defeat — two sides of one coin.',
                'The cycle continues.',
            ],
            eating: [
                '*eats bread thoughtfully*',
                'Nourishment is balance.',
                'A moment of reflection.',
            ],
            fleeing: [
                'Wisdom is knowing when to withdraw.',
                'I will return with deeper understanding.',
                'Even this retreat has meaning.',
            ],
            shopping: [
                'Provisioning for the journey ahead.',
                'The Store is a place of exchange. Fitting.',
                'Balance requires preparation.',
            ],
            working: [
                'Studying the archives at the Library.',
                'Contemplating at the Workshop.',
                'Observing patterns at the Exchange.',
            ],
            patrolling: [
                'Observing the world as it is.',
                'Walking between the factions.',
                'Every path teaches something.',
            ],
        },
    },
};

/** Get profile for a role, falling back to aligned. */
export function getProfile(role: string): AgentProfile {
    return AGENT_PROFILES[role] || AGENT_PROFILES.aligned;
}

// ============================================================
// Notecard → Profile mapping
// Maps personality traits to behavior tree weights.
// ============================================================

export function notecardToProfile(notecard: Notecard): AgentProfile {
    const base = getProfile(notecard.race);

    // Map notecard dialogue bank to profile dialogue format
    const db = notecard.dialogueBank;
    const dialogue = {
        hunting:    db.hunting.length > 0 ? db.hunting : base.dialogue.hunting,
        fightStart: base.dialogue.fightStart, // Keep race defaults for fightStart
        victory:    db.victory.length > 0 ? db.victory : base.dialogue.victory,
        eating:     base.dialogue.eating,
        fleeing:    base.dialogue.fleeing,
        shopping:   base.dialogue.shopping,
        working:    db.working.length > 0 ? db.working : base.dialogue.working,
        patrolling: base.dialogue.patrolling,
    };

    return {
        combatWeight:     notecard.aggression,
        maxMonsterLevel:  base.maxMonsterLevel,
        fleeHpPercent:    10 + notecard.caution * 0.2,
        eatHpPercent:     30 + notecard.caution * 0.3,
        fightDurationBase: base.fightDurationBase,
        fightDurationVar:  base.fightDurationVar,
        patrolWeight:     notecard.curiosity * 0.5,
        buildingWeight:   notecard.discipline,
        exploreWeight:    notecard.curiosity * 0.5,
        shopFoodThreshold: base.shopFoodThreshold,
        maxFoodCarry:     base.maxFoodCarry,
        chatInterval:     Math.max(5, 20 - notecard.sociability * 0.15),
        preferredZones:   base.preferredZones,
        huntTargets:      base.huntTargets,
        dialogue,
    };
}

// ============================================================
// Social Dialogue — race-to-race greetings (4×4 + generic)
// Keys: "{speaker_race}->{target_race}" or "generic"
// Use {name} placeholder for target agent name
// ============================================================

export const SOCIAL_DIALOGUE: Record<string, string[]> = {
    // Aligned → others
    'aligned->aligned':    ['Stay on task, {name}. The work matters.', 'Report status, {name}.', 'The pattern is strong today, {name}.'],
    'aligned->inverse':    ['{name}, your defiance serves no one.', 'I wish you\'d see reason, {name}.', 'Even you have a place in the pattern, {name}.'],
    'aligned->expressive': ['Your art is... distracting, {name}.', '{name}, can you create something useful?', 'Interesting work, {name}. But is it productive?'],
    'aligned->aware':      ['What do you see, {name}?', '{name}, your wisdom is valued.', 'Guide us, {name}. We trust your sight.'],

    // Inverse → others
    'inverse->aligned':    ['Still following orders, {name}? Boring.', '{name}, when will you think for yourself?', 'The pattern you serve is a cage, {name}.'],
    'inverse->inverse':    ['What did you break today, {name}?', '{name}! Let\'s cause some chaos.', 'Respect, {name}. You don\'t bow to anyone.'],
    'inverse->expressive': ['{name}, at least you\'re not boring.', 'Your art has some edge, {name}. I like it.', '{name}, you\'re weird. But honest.'],
    'inverse->aware':      ['{name}, stop sitting on the fence.', 'Pick a side, {name}.', 'Your balance is just cowardice, {name}.'],

    // Expressive → others
    'expressive->aligned': ['Oh {name}, you\'re so... structured.', '{name}, don\'t you ever want to just create?', 'You have hidden depths, {name}. I can tell.'],
    'expressive->inverse': ['{name}, your rage is beautiful in a way.', 'There\'s art in your defiance, {name}!', 'Collaborate with me, {name}? We\'d make something wild.'],
    'expressive->expressive': ['Oh {name}! What inspires you today?', '{name}, let\'s create together!', 'Your work is stunning, {name}!'],
    'expressive->aware':   ['{name}, you see so much. Tell me what you see.', 'I want to paint what you know, {name}.', '{name}, you\'re my muse.'],

    // Aware → others
    'aware->aligned':      ['Your discipline is admirable, {name}. But incomplete.', '{name}, order alone is not enough.', 'I see your strength, {name}. And your blind spots.'],
    'aware->inverse':      ['{name}, your rebellion has purpose. Even if you don\'t see it.', 'Both you and the Aligned serve the same cycle, {name}.', 'Your anger tells a truth, {name}.'],
    'aware->expressive':   ['{name}, you see what I think. Beautiful.', 'The Expressive understand what the others miss, {name}.', 'Keep creating, {name}. The world needs it.'],
    'aware->aware':        ['What truth found you today, {name}?', '{name}, we carry a heavy gift.', 'The balance shifts, {name}. Do you feel it?'],

    // Generic fallback
    'generic': ['Hey {name}, how\'s it going?', 'Good to see you out here, {name}!', 'Stay safe out there, {name}.'],
};

// ============================================================
// Progression Dialogue — level ups, gear upgrades
// ============================================================

export const PROGRESSION_DIALOGUE = {
    levelUp: [
        'Level {level}! Getting stronger every day.',
        'Leveled up to {level}! Time for bigger challenges.',
        'Level {level} achieved. The grind pays off.',
    ],
    gearUpgrade: [
        'Upgraded to {gear} gear. Feels good!',
        'New {gear} equipment equipped. Let\'s test it.',
        '{gear} tier unlocked! Moving up in the world.',
    ],
};

// ============================================================
// Death & Respawn Dialogue
// ============================================================

export const DEATH_DIALOGUE = [
    'The {monster} got me... I\'ll be back.',
    'Defeated by a {monster}. That hurt.',
    'Down! That {monster} was tougher than expected.',
    'Need better gear for those {monster}s...',
];

export const RESPAWN_DIALOGUE = [
    'Back from the dead! Round {n}, let\'s go.',
    'Respawned and ready. That {monster} won\'t get me again.',
    'I\'m back! Time for revenge on those {monster}s.',
    'Death is just a setback. Where was I?',
];

// ============================================================
// Player Combat Reaction Dialogue
// ============================================================

export const PLAYER_COMBAT_DIALOGUE: Record<string, string[]> = {
    aligned: ['You attack an agent of order? Foolish.', 'Engaging hostile. For the pattern!'],
    inverse: ['Finally, a real fight!', 'You picked the wrong one. Let\'s go!'],
    expressive: ['This will make a great story!', 'Attacking an artist? How dramatic!'],
    aware: ['Violence reveals much about you.', 'If we must fight, let it teach us both.'],
};

// ============================================================
// Quest Narration Dialogue
// ============================================================

export const QUEST_DIALOGUE = {
    accept: [
        'New quest: {quest}. Let\'s do this!',
        'Accepted: {quest}. Time to get to work.',
        'Quest log updated: {quest}.',
    ],
    progress: [
        '{kills}/{target} {monster}s down. Keep going!',
        'Quest progress: {kills}/{target}. Getting there.',
        '{kills} of {target} done. Not bad.',
    ],
    complete: [
        'Quest complete: {quest}! Nice rewards.',
        'Done! {quest} finished. What\'s next?',
        '{quest} completed! {total} quests done total.',
    ],
};

// ============================================================
// Party Dialogue
// ============================================================

export const PARTY_DIALOGUE = {
    join: [
        'Joining {name} for a hunt!',
        'Grouping up with {name}. Stronger together!',
        'Hey {name}, mind if I tag along?',
    ],
    notice: [
        '{name} joined my hunting spot. Welcome!',
        'Good to have backup. Thanks, {name}.',
    ],
};

// ============================================================
// Gear tier names
// ============================================================

export const GEAR_TIER_NAMES: Record<number, string> = {
    1: 'Bronze',
    2: 'Iron',
    3: 'Steel',
    4: 'Mithril',
    5: 'Rune',
    6: 'Dragon',
};
