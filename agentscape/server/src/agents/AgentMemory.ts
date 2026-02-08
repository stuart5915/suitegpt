// ============================================================
// AgentScape — Agent Memory (per-NPC state tracking)
// Tracks simulated inventory, goals, combat, and activity
// so behavior trees can make stateful decisions.
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
    fightTimer: number = 0;         // Seconds remaining in current fight
    fightDamage: number = 0;        // Damage to take when fight ends
    fightMonsterName: string = '';   // Name of monster being fought
    killCount: number = 0;

    // ---- Activity tracking ----
    tripsSinceShop: number = 0;     // Hunts/patrols since last shop visit
    currentZone: string = 'suite_city';

    // ---- Timers / cooldowns ----
    chatCooldown: number = 0;       // Seconds until next chat allowed
    restTimer: number = 0;          // Seconds remaining in rest/eat

    // ---- Lifetime stats (for variety) ----
    totalKills: number = 0;
    totalDeaths: number = 0;
    sessionsHunted: number = 0;     // How many hunting trips total
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
