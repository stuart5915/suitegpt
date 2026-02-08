// ============================================================
// AgentScape — Agent Memory (per-NPC state tracking)
// Tracks simulated inventory, goals, combat, progression,
// quests, social state, and party info.
// ============================================================

export type GoalType = 'hunt' | 'shop' | 'flee' | 'patrol' | 'work' | 'eat' | 'explore';

export interface AgentGoal {
    type: GoalType;
    targetX: number;
    targetZ: number;
    zone?: string;
    buildingId?: string;
    monsterType?: string;
    monsterName?: string;
}

export class AgentMemory {
    // ---- Current goal ----
    currentGoal: AgentGoal | null = null;

    // ---- Simulated resources ----
    foodCount: number = 3;
    coins: number = 50;

    // ---- Combat simulation ----
    fightTimer: number = 0;
    fightDamage: number = 0;
    fightMonsterName: string = '';
    killCount: number = 0;

    // ---- Progression ----
    xp: number = 0;
    effectiveLevel: number = 1;
    gearTier: number = 1;              // 1=bronze, 2=iron, 3=steel, 4=mithril

    // ---- Activity tracking ----
    tripsSinceShop: number = 0;
    currentZone: string = 'suite_city';

    // ---- Timers / cooldowns ----
    chatCooldown: number = 0;
    restTimer: number = 0;
    socialCooldown: number = 0;        // Cooldown for agent-to-agent chat

    // ---- Social / player reactions ----
    wasInPlayerCombat: boolean = false; // Track player combat transition

    // ---- Quest narration ----
    currentQuestId: string | null = null;
    currentQuestName: string = '';
    questKillCount: number = 0;
    questKillTarget: number = 0;
    questMonsterType: string | null = null;
    questsCompleted: number = 0;

    // ---- Hunting party ----
    partyWith: string | null = null;   // NPC ID of party partner

    // ---- Death / respawn ----
    deathAnnounced: boolean = false;
    lastDeathMonster: string = '';

    // ---- Lifetime stats ----
    totalKills: number = 0;
    totalDeaths: number = 0;
    sessionsHunted: number = 0;
}

/** Cached NPC data for social interactions and party finding. */
export interface CachedNPC {
    id: string;
    x: number;
    z: number;
    name: string;
    role: string;
    state: string;
    goalType: string | null;
    goalZone: string | null;
    goalMonsterType: string | null;
    effectiveLevel: number;
}

/** Manages AgentMemory instances for all NPCs. */
export class AgentMemoryManager {
    private memories = new Map<string, AgentMemory>();

    get(npcId: string): AgentMemory {
        let mem = this.memories.get(npcId);
        if (!mem) {
            mem = new AgentMemory();
            this.memories.set(npcId, mem);
        }
        return mem;
    }

    remove(npcId: string): void {
        this.memories.delete(npcId);
    }

    has(npcId: string): boolean {
        return this.memories.has(npcId);
    }
}
