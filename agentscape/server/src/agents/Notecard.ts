// ============================================================
// AgentScape — Agent Notecard (persistent personality state)
// Each agent carries a notecard that drives behavior tree
// weights, dialogue, and Gemini Flash reflections.
// ============================================================

export type Race = 'aligned' | 'inverse' | 'expressive' | 'aware';

export type Mood = 'calm' | 'angry' | 'fearful' | 'joyful' | 'contemplative' | 'restless';

export interface NotecardEvent {
    timestamp: number;
    type: string;
    description: string;
}

export interface DialogueBank {
    hunting: string[];
    victory: string[];
    defeat: string[];
    social: string[];
    working: string[];
    idle: string[];
}

export interface Notecard {
    agentId: string;
    name: string;
    race: Race;

    // Personality traits (0-100, drive behavior tree weights)
    aggression: number;     // → combat weight
    curiosity: number;      // → patrol + explore weight
    discipline: number;     // → building/work weight
    sociability: number;    // → chat frequency, party tendency
    caution: number;        // → flee/eat thresholds

    // LLM-managed fields
    beliefs: string[];              // 2-4 short statements
    currentGoals: string[];         // 1-2 goals
    mood: Mood;
    recentEvents: NotecardEvent[];  // ring buffer, max 10
    dialogueBank: DialogueBank;

    lastReflectionTime: number;
    reflectionCount: number;
}
