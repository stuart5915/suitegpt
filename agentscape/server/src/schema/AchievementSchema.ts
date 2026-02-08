import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

/**
 * Definition of a single achievement.
 * Stored in the agentscape_achievements config table and loaded at room start.
 */
export class AchievementDef extends Schema {
    @type('string') id: string = '';
    @type('string') name: string = '';
    @type('string') description: string = '';
    @type('string') icon: string = '';
    @type('string') category: string = 'general'; // combat, skilling, exploration, social, boss, economy
    @type('string') requirementType: string = '';  // kill_count, skill_level, total_level, total_xp, quest_complete, item_collected, coins_earned, boss_kill, trade_count, deaths
    @type('string') requirementParam: string = ''; // e.g. skill name, monster id, quest id
    @type('uint32') threshold: number = 1;         // value to reach
    @type('uint16') points: number = 10;           // achievement points awarded
    @type('string') tier: string = 'bronze';       // bronze, silver, gold, master, legendary
}

/**
 * Per-player progress toward a single achievement.
 */
export class AchievementProgress extends Schema {
    @type('string') achievementId: string = '';
    @type('uint32') progress: number = 0;
    @type('boolean') completed: boolean = false;
    @type('float64') completedAt: number = 0; // timestamp
}

/**
 * Achievement summary synced to the owning player.
 * Attached to PlayerSchema via filter.
 *
 * Integration in AgentScapeRoom:
 *   1. Load achievement defs from Supabase (or hardcoded) on room create
 *   2. On relevant events (kill, level up, quest complete, etc.),
 *      call achievementSystem.checkProgress(player, eventType, eventParam, value)
 *   3. When completed, broadcast 'achievement_unlocked' to room for activity feed
 *   4. Save/restore via SupabaseAdapter
 */
export class PlayerAchievements extends Schema {
    @type({ map: AchievementProgress }) progress = new MapSchema<AchievementProgress>();
    @type('uint16') totalPoints: number = 0;
    @type('uint16') completedCount: number = 0;
}

// ============================================================
// Hardcoded achievement definitions (also seeded in migration)
// ============================================================
export const ACHIEVEMENT_DEFS: {
    id: string; name: string; description: string; icon: string;
    category: string; requirementType: string; requirementParam: string;
    threshold: number; points: number; tier: string;
}[] = [
    // ── Combat ──
    { id: 'first_blood', name: 'First Blood', description: 'Defeat your first monster', icon: '🗡️', category: 'combat', requirementType: 'kill_count', requirementParam: '', threshold: 1, points: 5, tier: 'bronze' },
    { id: 'monster_slayer', name: 'Monster Slayer', description: 'Defeat 50 monsters', icon: '⚔️', category: 'combat', requirementType: 'kill_count', requirementParam: '', threshold: 50, points: 15, tier: 'silver' },
    { id: 'centurion', name: 'Centurion', description: 'Defeat 100 monsters', icon: '🛡️', category: 'combat', requirementType: 'kill_count', requirementParam: '', threshold: 100, points: 25, tier: 'gold' },
    { id: 'warlord', name: 'Warlord', description: 'Defeat 500 monsters', icon: '👑', category: 'combat', requirementType: 'kill_count', requirementParam: '', threshold: 500, points: 50, tier: 'master' },
    { id: 'combat_10', name: 'Apprentice Fighter', description: 'Reach combat level 10', icon: '🥊', category: 'combat', requirementType: 'combat_level', requirementParam: '', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'combat_30', name: 'Seasoned Warrior', description: 'Reach combat level 30', icon: '⚔️', category: 'combat', requirementType: 'combat_level', requirementParam: '', threshold: 30, points: 25, tier: 'silver' },
    { id: 'combat_60', name: 'Elite Combatant', description: 'Reach combat level 60', icon: '🏆', category: 'combat', requirementType: 'combat_level', requirementParam: '', threshold: 60, points: 50, tier: 'gold' },
    { id: 'combat_99', name: 'Maxed Fighter', description: 'Reach combat level 99', icon: '💎', category: 'combat', requirementType: 'combat_level', requirementParam: '', threshold: 99, points: 100, tier: 'legendary' },

    // ── Skilling ──
    { id: 'woodcutting_10', name: 'Lumberjack', description: 'Reach Woodcutting level 10', icon: '🪓', category: 'skilling', requirementType: 'skill_level', requirementParam: 'woodcutting', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'mining_10', name: 'Prospector', description: 'Reach Mining level 10', icon: '⛏️', category: 'skilling', requirementType: 'skill_level', requirementParam: 'mining', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'fishing_10', name: 'Angler', description: 'Reach Fishing level 10', icon: '🎣', category: 'skilling', requirementType: 'skill_level', requirementParam: 'fishing', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'cooking_10', name: 'Chef', description: 'Reach Cooking level 10', icon: '🍳', category: 'skilling', requirementType: 'skill_level', requirementParam: 'cooking', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'smithing_10', name: 'Blacksmith', description: 'Reach Smithing level 10', icon: '🔨', category: 'skilling', requirementType: 'skill_level', requirementParam: 'smithing', threshold: 10, points: 10, tier: 'bronze' },
    { id: 'any_skill_50', name: 'Dedicated', description: 'Reach level 50 in any skill', icon: '🌟', category: 'skilling', requirementType: 'skill_level', requirementParam: '*', threshold: 50, points: 35, tier: 'gold' },
    { id: 'any_skill_99', name: 'Master Skiller', description: 'Reach level 99 in any skill', icon: '💫', category: 'skilling', requirementType: 'skill_level', requirementParam: '*', threshold: 99, points: 100, tier: 'legendary' },
    { id: 'total_100', name: 'Well-Rounded', description: 'Reach total level 100', icon: '📊', category: 'skilling', requirementType: 'total_level', requirementParam: '', threshold: 100, points: 20, tier: 'silver' },
    { id: 'total_500', name: 'Jack of All Trades', description: 'Reach total level 500', icon: '📈', category: 'skilling', requirementType: 'total_level', requirementParam: '', threshold: 500, points: 50, tier: 'gold' },
    { id: 'total_1000', name: 'Legendary', description: 'Reach total level 1000', icon: '🏅', category: 'skilling', requirementType: 'total_level', requirementParam: '', threshold: 1000, points: 100, tier: 'legendary' },

    // ── Bosses ──
    { id: 'boss_rogue_script', name: 'Debugger', description: 'Defeat the Rogue Script', icon: '🐛', category: 'boss', requirementType: 'boss_kill', requirementParam: 'rogue_script', threshold: 1, points: 30, tier: 'silver' },
    { id: 'boss_404_golem', name: 'Error Handler', description: 'Defeat the 404 Golem', icon: '🪨', category: 'boss', requirementType: 'boss_kill', requirementParam: '404_golem', threshold: 1, points: 40, tier: 'gold' },
    { id: 'boss_hallucinator', name: 'Truth Seeker', description: 'Defeat the Hallucinator', icon: '🌀', category: 'boss', requirementType: 'boss_kill', requirementParam: 'hallucinator', threshold: 1, points: 50, tier: 'gold' },
    { id: 'boss_dragon', name: 'Dragon Slayer', description: 'Defeat the Data Breach Dragon', icon: '🐉', category: 'boss', requirementType: 'boss_kill', requirementParam: 'data_breach_dragon', threshold: 1, points: 100, tier: 'legendary' },

    // ── Economy ──
    { id: 'coins_1k', name: 'Getting Started', description: 'Earn 1,000 coins', icon: '🪙', category: 'economy', requirementType: 'coins_earned', requirementParam: '', threshold: 1000, points: 10, tier: 'bronze' },
    { id: 'coins_100k', name: 'Wealthy', description: 'Earn 100,000 coins', icon: '💰', category: 'economy', requirementType: 'coins_earned', requirementParam: '', threshold: 100000, points: 35, tier: 'gold' },
    { id: 'coins_1m', name: 'Millionaire', description: 'Earn 1,000,000 coins', icon: '🤑', category: 'economy', requirementType: 'coins_earned', requirementParam: '', threshold: 1000000, points: 75, tier: 'master' },
    { id: 'first_trade', name: 'Trader', description: 'Complete your first trade', icon: '🤝', category: 'economy', requirementType: 'trade_count', requirementParam: '', threshold: 1, points: 10, tier: 'bronze' },

    // ── Exploration ──
    { id: 'visit_forest', name: 'Into the Wild', description: 'Enter The Forest zone', icon: '🌲', category: 'exploration', requirementType: 'zone_visit', requirementParam: 'forest', threshold: 1, points: 5, tier: 'bronze' },
    { id: 'visit_ruins', name: 'Ruin Explorer', description: 'Enter The Ruins zone', icon: '🏛️', category: 'exploration', requirementType: 'zone_visit', requirementParam: 'ruins', threshold: 1, points: 10, tier: 'bronze' },
    { id: 'visit_deep', name: 'Deep Diver', description: 'Enter The Deep Network', icon: '🌀', category: 'exploration', requirementType: 'zone_visit', requirementParam: 'deep_network', threshold: 1, points: 15, tier: 'silver' },

    // ── Social ──
    { id: 'first_death', name: 'Learning Experience', description: 'Die for the first time', icon: '💀', category: 'social', requirementType: 'deaths', requirementParam: '', threshold: 1, points: 5, tier: 'bronze' },
    { id: 'die_50', name: 'Persistent', description: 'Die 50 times', icon: '☠️', category: 'social', requirementType: 'deaths', requirementParam: '', threshold: 50, points: 20, tier: 'silver' },
];
