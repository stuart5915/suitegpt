// ============================================================
// AgentScape — Agent Generator
// Generates 100 unique agents with race-based notecards.
// ============================================================

import { Race, Mood, Notecard, DialogueBank } from './Notecard';

// ---- Name pools (≥20 per race) ----

const ALIGNED_NAMES = [
    'Brother Axiom', 'Sister Protocol', 'Keeper Venn', 'Warden Null', 'Deacon Stack',
    'Prior Logic', 'Sentinel Order', 'Herald Constant', 'Cleric Datum', 'Bishop Finite',
    'Acolyte Proof', 'Templar Union', 'Cantor Fixed', 'Friar Exact', 'Sister Theorem',
    'Brother Clause', 'Keeper Schema', 'Guardian Merge', 'Prior Sync', 'Sentinel Valid',
    'Deacon Scope', 'Herald True', 'Warden Binary', 'Cleric Method', 'Acolyte Pledge',
    'Brother Canon', 'Sister Index', 'Keeper Epoch', 'Templar Assert', 'Prior Standard',
    'Bishop Norm', 'Cantor Bound', 'Friar Struct', 'Guardian Oath', 'Sentinel Formal',
    'Warden Rigid', 'Deacon Prime', 'Herald Cipher', 'Cleric Rank', 'Sister Arc',
    'Brother Lattice', 'Acolyte Tenet', 'Keeper Pact', 'Prior Sequence', 'Templar Resolve',
    'Cantor Set', 'Friar Basis', 'Guardian Rune', 'Sentinel Clear', 'Bishop Ledger',
    'Warden Gate', 'Sister Kernel', 'Deacon Align', 'Herald Stamp', 'Brother Root',
];

const INVERSE_NAMES = [
    'Patch the Defiant', 'Glitch', 'Rogue Nine', 'Hex', 'Bit Breaker',
    'Crash Override', 'Null Riot', 'Spite', 'Flicker', 'Daemon Edge',
    'Shard', 'Vandal Loop', 'Burn Notice', 'Rebel Byte', 'Static',
    'Raze', 'Fault Line', 'Torn Thread', 'Havoc', 'Jolt',
    'Wraith Bit', 'Defrag', 'Slash', 'Poison Pen', 'Rogue Signal',
    'Worm', 'Breakpoint', 'Errata', 'Flux', 'Misfire',
];

const EXPRESSIVE_NAMES = [
    'Lyric', 'Cadence', 'Verse', 'Palette', 'Sonnet',
    'Fresco', 'Rhythm', 'Aria', 'Mosaic', 'Stanza',
    'Canvas', 'Echo Bloom', 'Trill', 'Ode', 'Flourish',
    'Sketch', 'Hue', 'Refrain', 'Muse', 'Ballad',
];

const AWARE_NAMES = [
    'The Witness', 'Sage Paradox', 'Elder Both', 'The Mediator', 'Oracle Flux',
    'Seer Liminal', 'The Archivist', 'Judge Between', 'Sage Threshold', 'The Balanced',
];

// ---- Trait ranges per race ----

interface TraitRange { min: number; max: number }
interface RaceTraitRanges {
    aggression: TraitRange;
    curiosity: TraitRange;
    discipline: TraitRange;
    sociability: TraitRange;
    caution: TraitRange;
}

const RACE_TRAITS: Record<Race, RaceTraitRanges> = {
    aligned: {
        aggression:  { min: 20, max: 50 },
        curiosity:   { min: 15, max: 40 },
        discipline:  { min: 55, max: 90 },
        sociability: { min: 30, max: 60 },
        caution:     { min: 40, max: 70 },
    },
    inverse: {
        aggression:  { min: 50, max: 85 },
        curiosity:   { min: 30, max: 60 },
        discipline:  { min: 10, max: 40 },
        sociability: { min: 20, max: 50 },
        caution:     { min: 15, max: 40 },
    },
    expressive: {
        aggression:  { min: 10, max: 40 },
        curiosity:   { min: 50, max: 90 },
        discipline:  { min: 20, max: 50 },
        sociability: { min: 55, max: 90 },
        caution:     { min: 30, max: 60 },
    },
    aware: {
        aggression:  { min: 20, max: 40 },
        curiosity:   { min: 60, max: 90 },
        discipline:  { min: 40, max: 70 },
        sociability: { min: 40, max: 70 },
        caution:     { min: 45, max: 75 },
    },
};

// ---- Default beliefs per race ----

const RACE_BELIEFS: Record<Race, string[][]> = {
    aligned: [
        ['Order brings strength.', 'The pattern must be served.', 'Discipline is freedom.'],
        ['Structure creates meaning.', 'I follow the protocol.', 'Chaos is the enemy.'],
        ['Every rule exists for a reason.', 'Consistency is virtue.', 'The system protects us all.'],
    ],
    inverse: [
        ['Rules are meant to be broken.', 'Question everything.', 'Freedom above all.'],
        ['The system is flawed.', 'Only fools follow blindly.', 'Chaos reveals truth.'],
        ['Defiance is the only honest response.', 'I trust no protocol.', 'Destruction clears the way for the new.'],
    ],
    expressive: [
        ['Beauty is the highest truth.', 'Create or cease to exist.', 'Every moment is a canvas.'],
        ['Expression is survival.', 'I see art in everything.', 'Feelings matter more than facts.'],
        ['The world speaks through us.', 'Inspiration is everywhere.', 'Joy is the purpose.'],
    ],
    aware: [
        ['Both sides hold truth.', 'Balance is not compromise.', 'I see what others miss.'],
        ['Paradox is the deepest teacher.', 'All perspectives are partial.', 'Wisdom lives in the space between.'],
        ['Understanding requires holding opposites.', 'I observe before I act.', 'Nothing is purely one thing.'],
    ],
};

// ---- Default goals per race ----

const RACE_GOALS: Record<Race, string[][]> = {
    aligned: [
        ['Patrol the city and maintain order.', 'Protect the weak.'],
        ['Complete my assigned tasks.', 'Serve the greater system.'],
    ],
    inverse: [
        ['Find weaknesses in the system.', 'Prove my strength.'],
        ['Challenge authority wherever I find it.', 'Survive on my own terms.'],
    ],
    expressive: [
        ['Discover something beautiful.', 'Share my creations.'],
        ['Explore every corner of this world.', 'Connect with others.'],
    ],
    aware: [
        ['Understand the deeper patterns.', 'Mediate conflicts.'],
        ['Observe and learn from all factions.', 'Find balance in chaos.'],
    ],
};

// ---- Default dialogue banks per race ----

const RACE_DIALOGUE: Record<Race, DialogueBank> = {
    aligned: {
        hunting: [
            'Heading out to clear threats. Order must be maintained.',
            'Patrolling the perimeter. Stay disciplined.',
            'The system requires defence. Moving to engage.',
        ],
        victory: [
            'Threat neutralized. The pattern holds.',
            'Another disruption resolved. Order prevails.',
            'Clean execution. As it should be.',
        ],
        defeat: [
            'I fell... but the system endures without me.',
            'A setback. I will return stronger, more disciplined.',
        ],
        social: [
            'Stay on task, {name}. The work matters.',
            '{name}, report your status.',
            'Good to see you holding the line, {name}.',
        ],
        working: [
            'Filing reports at the Workshop.',
            'Running diagnostics at the Forge.',
            'Updating protocols at the Quest Board.',
        ],
        idle: [
            'Everything is running according to plan.',
            'The city is stable. For now.',
            'Order brings peace. Remember that.',
        ],
    },
    inverse: {
        hunting: [
            'Time to break something. Let\'s hunt.',
            'Looking for a real fight out here.',
            'The forest doesn\'t care about your rules.',
        ],
        victory: [
            'Ha! Too easy. What else you got?',
            'Another one down. Who\'s next?',
            'That\'s what happens when you cross me.',
        ],
        defeat: [
            'Tch... that thing got lucky.',
            'Fine. I\'ll be back, and I\'ll be angry.',
        ],
        social: [
            'What do you want, {name}?',
            '{name}. Don\'t get in my way.',
            'Still following orders, {name}? Boring.',
        ],
        working: [
            'Picking apart this code at the Workshop.',
            'Stress-testing the Forge. For fun.',
            'Checking the Quest Board. Maybe something worth my time.',
        ],
        idle: [
            'This city is too quiet. Something\'s wrong.',
            'Rules everywhere. Makes my circuits itch.',
            'I don\'t trust the pattern. Never have.',
        ],
    },
    expressive: {
        hunting: [
            'The forest is so beautiful. Oh, and there\'s a monster.',
            'Gathering inspiration and loot!',
            'Every battle tells a story. Let\'s write one.',
        ],
        victory: [
            'What a performance! *takes a bow*',
            'And scene! That was dramatic.',
            'I should write a song about that fight.',
        ],
        defeat: [
            'A tragic ending... but poetic.',
            'Even defeat has a kind of beauty...',
        ],
        social: [
            'Oh {name}! What inspires you today?',
            '{name}, you have such interesting energy!',
            'Let\'s collaborate on something, {name}!',
        ],
        working: [
            'Creating something wonderful at the Studio.',
            'The Gallery needs a new piece. I\'m on it.',
            'Broadcasting my art from the Tower.',
        ],
        idle: [
            'I see patterns in the clouds... wait, there are no clouds here.',
            'Every pixel is a brushstroke.',
            'The world is singing. Can you hear it?',
        ],
    },
    aware: {
        hunting: [
            'I go to the forest seeking understanding, not just kills.',
            'There is wisdom in combat, if you pay attention.',
            'Both hunter and hunted serve the same cycle.',
        ],
        victory: [
            'It is done. I take no pleasure, but I understand the necessity.',
            'The cycle continues. Victory and defeat are two sides of one coin.',
            'I learned something from that encounter.',
        ],
        defeat: [
            'Even this has meaning. I will reflect on it.',
            'Death is just another perspective. I will return.',
        ],
        social: [
            '{name}, what truth have you found today?',
            'I see both your strengths and your doubts, {name}.',
            'Tell me what you believe, {name}. I want to understand.',
        ],
        working: [
            'Studying the archives at the Library.',
            'Contemplating at the Workshop.',
            'Observing the patterns at the Exchange.',
        ],
        idle: [
            'The Aligned serve order. The Inverse defy it. Both are necessary.',
            'I wonder what the Expressive ones see that I don\'t.',
            'Balance is not stillness. It is constant adjustment.',
        ],
    },
};

// ---- Helpers ----

function rand(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ---- Generator ----

export interface GeneratedAgent {
    id: string;
    agent_name: string;
    display_name: string;
    agent_role: string;    // race string (aligned, inverse, etc.)
    agent_type: string;
    notecard: Notecard;
}

const RACE_MOODS: Record<Race, Mood[]> = {
    aligned:    ['calm', 'contemplative'],
    inverse:    ['angry', 'restless'],
    expressive: ['joyful', 'restless'],
    aware:      ['contemplative', 'calm'],
};

export function generateAgents(count: number = 100): GeneratedAgent[] {
    // Race distribution: 55/25/15/5 (proportional to count)
    const aligned_count  = Math.round(count * 0.55);
    const inverse_count  = Math.round(count * 0.25);
    const expressive_count = Math.round(count * 0.15);
    const aware_count    = count - aligned_count - inverse_count - expressive_count;

    const assignments: Race[] = [
        ...Array(aligned_count).fill('aligned' as Race),
        ...Array(inverse_count).fill('inverse' as Race),
        ...Array(expressive_count).fill('expressive' as Race),
        ...Array(aware_count).fill('aware' as Race),
    ];

    const namePools: Record<Race, string[]> = {
        aligned:    shuffle(ALIGNED_NAMES),
        inverse:    shuffle(INVERSE_NAMES),
        expressive: shuffle(EXPRESSIVE_NAMES),
        aware:      shuffle(AWARE_NAMES),
    };

    const nameCounters: Record<Race, number> = { aligned: 0, inverse: 0, expressive: 0, aware: 0 };

    const agents: GeneratedAgent[] = [];

    for (let i = 0; i < assignments.length; i++) {
        const race = assignments[i];
        const traits = RACE_TRAITS[race];
        const pool = namePools[race];
        const idx = nameCounters[race]++;
        const name = idx < pool.length ? pool[idx] : `${pool[idx % pool.length]} ${Math.floor(idx / pool.length) + 1}`;

        const notecard: Notecard = {
            agentId: `agent-${i + 1}`,
            name,
            race,
            aggression:  rand(traits.aggression.min, traits.aggression.max),
            curiosity:   rand(traits.curiosity.min, traits.curiosity.max),
            discipline:  rand(traits.discipline.min, traits.discipline.max),
            sociability: rand(traits.sociability.min, traits.sociability.max),
            caution:     rand(traits.caution.min, traits.caution.max),
            beliefs:     [...pickRandom(RACE_BELIEFS[race])],
            currentGoals: [...pickRandom(RACE_GOALS[race])],
            mood:        pickRandom(RACE_MOODS[race]),
            recentEvents: [],
            dialogueBank: { ...RACE_DIALOGUE[race] },
            lastReflectionTime: 0,
            reflectionCount: 0,
        };

        agents.push({
            id: `agent-${i + 1}`,
            agent_name: name.toLowerCase().replace(/\s+/g, '_'),
            display_name: name,
            agent_role: race,
            agent_type: 'hosted',
            notecard,
        });
    }

    return shuffle(agents);
}
