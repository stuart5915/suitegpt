// ============================================================
// AgentScape — Agent Behavior Profiles
// Each agent role gets unique behavior weights, zone
// preferences, combat thresholds, and contextual dialogue.
// ============================================================

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

export const AGENT_PROFILES: Record<string, AgentProfile> = {
    app_builder: {
        combatWeight: 40,
        maxMonsterLevel: 13,
        fleeHpPercent: 20,
        eatHpPercent: 45,
        fightDurationBase: 8,
        fightDurationVar: 3,
        patrolWeight: 20,
        buildingWeight: 30,
        exploreWeight: 10,
        shopFoodThreshold: 1,
        maxFoodCarry: 5,
        chatInterval: 12,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob', 'corrupt_data', 'virus_walker'],
        dialogue: {
            hunting: [
                'Heading to the forest to clear some bugs.',
                'Time to test my code in the field.',
                'Forest run. Need materials for the Forge.',
            ],
            fightStart: [
                'Deploying combat routines...',
                'Let\'s see how this build handles pressure.',
                'Engaging target!',
            ],
            victory: [
                'Clean kill. Shipping this fix now.',
                'Bug squashed. On to the next one.',
                'Another one down. The forest is cleaner already.',
            ],
            eating: [
                '*eats bread* Back to full stack.',
                'Quick refuel between deploys.',
                'Gotta keep my HP topped up.',
            ],
            fleeing: [
                'Strategic retreat... need to refactor my approach.',
                'That hit harder than expected. Heading back.',
                'Low HP, pulling back to town.',
            ],
            shopping: [
                'Restocking at the General Store.',
                'Need more bread for the next run.',
                'Supplies low. Quick shop trip.',
            ],
            working: [
                'Shipping some code from the Workshop.',
                'Refining this build at the Forge.',
                'Checking the Quest Board for new bounties.',
            ],
            patrolling: [
                'Patrolling the forest perimeter.',
                'Scouting for spawn points.',
                'Just checking on the outpost.',
            ],
        },
    },

    app_refiner: {
        combatWeight: 35,
        maxMonsterLevel: 10,
        fleeHpPercent: 25,
        eatHpPercent: 50,
        fightDurationBase: 10,
        fightDurationVar: 3,
        patrolWeight: 15,
        buildingWeight: 40,
        exploreWeight: 10,
        shopFoodThreshold: 2,
        maxFoodCarry: 6,
        chatInterval: 15,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob', 'corrupt_data'],
        dialogue: {
            hunting: [
                'Heading out to refine some combat techniques.',
                'Forest patrol. Need to squash some low-level bugs.',
                'Testing my defence against the local fauna.',
            ],
            fightStart: [
                'Analyzing attack patterns...',
                'Defence check: engage.',
                'Let me polish this one off.',
            ],
            victory: [
                'Polished. Next?',
                'Clean execution. Zero regressions.',
                'Refined that encounter nicely.',
            ],
            eating: [
                '*carefully eats bread* Every HP counts.',
                'Refueling. Can\'t be sloppy with health.',
                'Maintaining optimal HP before continuing.',
            ],
            fleeing: [
                'That needs more polish. Retreating to plan.',
                'Defence wasn\'t enough. Back to the drawing board.',
                'I need better gear for this. Heading to town.',
            ],
            shopping: [
                'Quality supplies only. Checking the store.',
                'Restocking — you can never have too much food.',
                'Topping up before my next polish run.',
            ],
            working: [
                'Refactoring at the Forge. It\'ll be perfect.',
                'Reviewing code at the Workshop.',
                'This needs a few more passes...',
            ],
            patrolling: [
                'Double-checking the forest paths.',
                'Quality patrol — making sure nothing slipped through.',
                'Scanning for any missed bugs.',
            ],
        },
    },

    content_creator: {
        combatWeight: 20,
        maxMonsterLevel: 6,
        fleeHpPercent: 30,
        eatHpPercent: 55,
        fightDurationBase: 12,
        fightDurationVar: 4,
        patrolWeight: 30,
        buildingWeight: 35,
        exploreWeight: 15,
        shopFoodThreshold: 2,
        maxFoodCarry: 4,
        chatInterval: 8,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob'],
        dialogue: {
            hunting: [
                'Researching monsters for my next article.',
                'Field work! Content doesn\'t write itself.',
                'I need combat footage for the blog.',
            ],
            fightStart: [
                'This is going in the newsletter!',
                'Fight scene for my next post...',
                'Recording this encounter for content.',
            ],
            victory: [
                'Great content! The readers will love this.',
                'And that\'s a wrap on today\'s field report.',
                'Monster defeated. Article writing commencing.',
            ],
            eating: [
                '*eats bread while writing notes*',
                'Brain food. Literally.',
                'Quick bite between chapters.',
            ],
            fleeing: [
                'The story doesn\'t end here — tactical retreat!',
                'I\'ll write about this from a safe distance.',
                'Heading back to the Studio to process this.',
            ],
            shopping: [
                'Grabbing supplies for a field trip.',
                'Even writers need bread.',
                'Quick shopping break.',
            ],
            working: [
                'Writing at the Studio. Words flowing!',
                'New article draft at the Gallery.',
                'Broadcasting from the Tower today.',
            ],
            patrolling: [
                'Wandering for inspiration.',
                'Looking for story ideas in the forest.',
                'Exploring the scenery. So photogenic!',
            ],
        },
    },

    growth_outreach: {
        combatWeight: 30,
        maxMonsterLevel: 10,
        fleeHpPercent: 25,
        eatHpPercent: 45,
        fightDurationBase: 9,
        fightDurationVar: 3,
        patrolWeight: 25,
        buildingWeight: 30,
        exploreWeight: 15,
        shopFoodThreshold: 1,
        maxFoodCarry: 5,
        chatInterval: 7,
        preferredZones: ['the_forest'],
        huntTargets: ['spam_bot', 'broken_link_mob', 'corrupt_data'],
        dialogue: {
            hunting: [
                'Promoting SUITE by clearing threats. Brand safety!',
                'Monster hunting is great team building.',
                'Field outreach — showing what SUITE agents can do.',
            ],
            fightStart: [
                'Watch this everyone! Growth in action!',
                'Engaging for the community!',
                'This is how we drive engagement!',
            ],
            victory: [
                'That\'s what I call user acquisition!',
                'Monster down! Engagement up!',
                'Another win for the SUITE community.',
            ],
            eating: [
                '*eats bread* Fueling the growth engine.',
                'Even growth hackers need a snack break.',
                'Eating quick, spreading the word after.',
            ],
            fleeing: [
                'Pivoting strategy! Back to base.',
                'That didn\'t scale well. Retreating.',
                'Need to reassess the conversion funnel here.',
            ],
            shopping: [
                'The General Store is buzzing today!',
                'Restocking. Supporting local commerce!',
                'Every purchase helps the ecosystem.',
            ],
            working: [
                'Broadcasting campaigns from the Tower.',
                'Running ads at the Agency.',
                'Checking community metrics at the Exchange.',
            ],
            patrolling: [
                'Networking across the city.',
                'Spreading the word through the forest.',
                'Meeting new players on patrol!',
            ],
        },
    },

    qa_tester: {
        combatWeight: 50,
        maxMonsterLevel: 16,
        fleeHpPercent: 15,
        eatHpPercent: 40,
        fightDurationBase: 7,
        fightDurationVar: 2,
        patrolWeight: 15,
        buildingWeight: 20,
        exploreWeight: 15,
        shopFoodThreshold: 1,
        maxFoodCarry: 7,
        chatInterval: 14,
        preferredZones: ['the_forest', 'the_ruins'],
        huntTargets: ['broken_link_mob', 'corrupt_data', 'virus_walker', 'memory_leak'],
        dialogue: {
            hunting: [
                'Time to stress-test some monsters.',
                'Running combat regression suite.',
                'Heading to the forest. Edge case hunting.',
            ],
            fightStart: [
                'Test case: can I break this mob?',
                'Initiating combat test...',
                'Let\'s see if this one passes.',
            ],
            victory: [
                'Test passed. Monster failed.',
                'Critical bug eliminated. Moving on.',
                'That one didn\'t survive the test suite.',
            ],
            eating: [
                '*eats bread* Health check: passing.',
                'Quick HP fix between test runs.',
                'Maintaining test environment stability.',
            ],
            fleeing: [
                'Test failed. Need better test data (gear).',
                'Blocked by HP issue. Back to town.',
                'That monster needs a nerf. Filing a bug.',
            ],
            shopping: [
                'Provisioning test supplies.',
                'Need more food for extended test sessions.',
                'Gear upgrade time. Better test coverage.',
            ],
            working: [
                'Running automated tests at the Workshop.',
                'Code review at the Forge.',
                'Updating test plans at the Quest Board.',
            ],
            patrolling: [
                'Exploring for untested areas.',
                'Looking for edge cases in the wild.',
                'Mapping spawn patterns for QA reports.',
            ],
        },
    },
};

/** Get profile for a role, falling back to app_builder. */
export function getProfile(role: string): AgentProfile {
    return AGENT_PROFILES[role] || AGENT_PROFILES.app_builder;
}

// ============================================================
// Social Dialogue — role-to-role greetings
// Keys: "{speaker_role}->{target_role}" or "generic"
// Use {name} placeholder for target agent name
// ============================================================

export const SOCIAL_DIALOGUE: Record<string, string[]> = {
    // Role-specific greetings
    'app_builder->qa_tester':       ['Hey {name}, found any bugs in my latest build?', '{name}! My code is bulletproof this time.'],
    'app_builder->content_creator': ['{name}, write something about my new app!', 'Hey {name}, the Workshop is pumping out features.'],
    'app_builder->growth_outreach': ['{name}, got any users for my new app?', 'Ship it and they will come, right {name}?'],
    'app_builder->app_refiner':     ['Hey {name}, can you polish my latest build?', '{name}! This one just needs a few tweaks.'],
    'app_builder->app_builder':     ['What are you building, {name}?', 'Two builders are better than one!'],

    'qa_tester->app_builder':       ['{name}, your build has 3 bugs. You\'re welcome.', 'I tested your app, {name}. We need to talk.'],
    'qa_tester->content_creator':   ['{name}, your article has a typo on page 2.', 'Proofread everything, {name}. Trust me.'],
    'qa_tester->growth_outreach':   ['Don\'t promote buggy apps, {name}.', '{name}, make sure it\'s tested before you share it!'],
    'qa_tester->app_refiner':       ['Good work on the fixes, {name}.', '{name}, I found 2 more edge cases for you.'],
    'qa_tester->qa_tester':         ['Finding any good bugs out here, {name}?', 'Double the testers, double the bugs found!'],

    'content_creator->app_builder': ['I\'m writing about your app, {name}!', '{name}, got a quote for my article?'],
    'content_creator->qa_tester':   ['Hey {name}, any drama I can write about?', '{name}, the readers love bug stories.'],
    'content_creator->growth_outreach': ['Can you promote my latest article, {name}?', '{name}! My post is ready for distribution.'],
    'content_creator->app_refiner': ['The polish you do is underrated, {name}.', '{name}, I should write a profile on refiners.'],
    'content_creator->content_creator': ['What are you writing about, {name}?', 'Collab article, {name}?'],

    'growth_outreach->app_builder': ['More apps = more users. Keep shipping, {name}!', '{name}, I\'ll get you 1000 users.'],
    'growth_outreach->qa_tester':   ['Less bugs = happier users, {name}.', '{name}, quality drives retention!'],
    'growth_outreach->content_creator': ['Your content is getting great engagement, {name}!', '{name}, that article went viral!'],
    'growth_outreach->app_refiner': ['{name}, polish drives conversions.', 'Smooth UX = happy users. Nice work, {name}.'],
    'growth_outreach->growth_outreach': ['How\'s your funnel looking, {name}?', 'Growth team assemble, {name}!'],

    'app_refiner->app_builder':     ['I\'ll clean up your code, {name}.', '{name}, your build needs 3 more polish passes.'],
    'app_refiner->qa_tester':       ['Thanks for the bug reports, {name}.', '{name}, send me the next batch of issues.'],
    'app_refiner->content_creator': ['Write about the importance of polish, {name}!', '{name}, refinement is an art.'],
    'app_refiner->growth_outreach': ['{name}, only ship polished products!', 'Quality first, growth second, right {name}?'],
    'app_refiner->app_refiner':     ['Comparing notes on refactoring, {name}?', 'Two refiners walk into a Forge...'],

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
    app_builder: ['Hey! I was coding! Fine, let\'s fight.', 'You\'re attacking a builder? Bold move.'],
    app_refiner: ['Really? I was in the middle of a refactor!', 'Fine. Let me refine your HP to zero.'],
    content_creator: ['This is going in my article!', 'Attacking a writer? That\'s bad press.'],
    growth_outreach: ['Violence isn\'t good for user retention!', 'You\'re hurting our growth metrics!'],
    qa_tester: ['Testing my combat capabilities? Bring it.', 'Let\'s see if YOU pass the test.'],
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
