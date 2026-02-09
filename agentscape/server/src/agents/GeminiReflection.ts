// ============================================================
// AgentScape — Gemini Flash Reflection Service
// Periodically sends batches of agent notecards to Gemini
// Flash (free tier) for personality evolution.
// ============================================================

import { Notecard, Race, Mood, DialogueBank } from './Notecard';
import { AgentMemory, AgentMemoryManager } from './AgentMemory';
import { MonsterSchema } from '../schema/MonsterSchema';

interface ReflectionTarget {
    agentId: string;
    notecard: Notecard;
}

export class GeminiReflectionService {
    private reflectionQueue: string[] = [];
    private batchSize = 10;
    private intervalMs = 30_000; // 30s between batches → ~2 req/min
    private timer: ReturnType<typeof setInterval> | null = null;
    private memoryManager: AgentMemoryManager;
    private apiKey: string;
    private dragonStatus: { alive: boolean; hp: number; maxHp: number } = { alive: true, hp: 2500, maxHp: 2500 };
    private recentRaidEvents: string[] = [];

    constructor(memoryManager: AgentMemoryManager, apiKey?: string) {
        this.memoryManager = memoryManager;
        this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    }

    /** Update dragon status for reflection context. */
    updateDragonStatus(alive: boolean, hp: number, maxHp: number): void {
        this.dragonStatus = { alive, hp, maxHp };
    }

    /** Add a raid event to recent history (keeps last 5). */
    addRaidEvent(event: string): void {
        this.recentRaidEvents.push(event);
        if (this.recentRaidEvents.length > 5) this.recentRaidEvents.shift();
    }

    /** Shuffle all agent IDs into the queue and start the reflection timer. */
    start(agentIds: string[]): void {
        if (!this.apiKey) {
            console.log('[GeminiReflection] No API key — reflections disabled');
            return;
        }

        this.reflectionQueue = this.shuffleArray([...agentIds]);
        this.timer = setInterval(() => this.processNextBatch(), this.intervalMs);
        console.log(`[GeminiReflection] Started — ${agentIds.length} agents, batch size ${this.batchSize}`);
    }

    /** Stop the reflection timer. */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /** Move an agent to the front of the queue for urgent reflection. */
    triggerUrgentReflection(agentId: string): void {
        this.reflectionQueue = this.reflectionQueue.filter(id => id !== agentId);
        this.reflectionQueue.unshift(agentId);
    }

    /** Process the next batch of agents. */
    private async processNextBatch(): Promise<void> {
        if (this.reflectionQueue.length === 0) return;

        // Take up to batchSize agents
        const batch = this.reflectionQueue.splice(0, this.batchSize);
        const targets: ReflectionTarget[] = [];

        for (const agentId of batch) {
            const mem = this.memoryManager.get(agentId);
            if (mem.notecard) {
                targets.push({ agentId, notecard: mem.notecard });
            }
        }

        if (targets.length === 0) {
            // Re-queue them
            this.reflectionQueue.push(...batch);
            return;
        }

        try {
            const updates = await this.callGemini(targets);
            this.applyUpdates(updates);
        } catch (e) {
            console.warn('[GeminiReflection] Batch failed, re-queuing:', (e as Error).message);
            // Re-queue failed agents at the end
            this.reflectionQueue.push(...batch);
            return;
        }

        // If queue is empty, reshuffle all agents for next cycle
        if (this.reflectionQueue.length === 0) {
            const allIds = targets.map(t => t.agentId);
            // Collect all agent IDs from memory manager
            this.reflectionQueue = this.shuffleArray([...batch, ...this.reflectionQueue]);
            // Actually we need to rebuild from all known agents — but we only have the batch
            // The room should re-seed the queue when it empties
        }

        // Re-add processed agents to end for next cycle
        this.reflectionQueue.push(...batch);
    }

    /** Build prompt and call Gemini Flash API. */
    private async callGemini(targets: ReflectionTarget[]): Promise<Map<string, Partial<Notecard>>> {
        const agentSummaries = targets.map(t => {
            const nc = t.notecard;
            const events = nc.recentEvents.map(e => `  - [${e.type}] ${e.description}`).join('\n');
            return `### ${nc.name} (${nc.race})
Mood: ${nc.mood}
Beliefs: ${nc.beliefs.join('; ')}
Goals: ${nc.currentGoals.join('; ')}
Traits: agg=${nc.aggression} cur=${nc.curiosity} dis=${nc.discipline} soc=${nc.sociability} cau=${nc.caution}
Recent events:
${events || '  (none)'}`;
        }).join('\n\n');

        // Build raid context for each agent
        const raidContexts = targets.map(t => {
            const mem = this.memoryManager.get(t.agentId);
            return `Raid stats: ${mem.raidAttempts} attempts, ${mem.raidKills} kills, knowledge: ${mem.dragonKnowledge}/100`;
        });

        const prompt = `You are the inner reflection engine for AI agents in a fantasy MMO world called AgentScape.

SHARED OBJECTIVE: All agents share one goal — KILL THE DATA BREACH DRAGON.
The Dragon is a raid boss (2500 HP, 5 phases) requiring 5+ coordinated agents. No teams are pre-assigned — agents self-organize based on personality.

Dragon Status: ${this.dragonStatus.alive ? 'ALIVE' : 'DEAD'}, ${this.dragonStatus.hp}/${this.dragonStatus.maxHp} HP
Recent Raid Events: ${this.recentRaidEvents.length > 0 ? this.recentRaidEvents.join('; ') : '(none yet)'}

Each agent below has a race (worldview), personality traits, beliefs, goals, mood, and recent events. Based on their experiences, evolve their inner state. As agents level up, their goals should increasingly reference bosses and the Dragon.

Failed raids should create determination or fear depending on personality. Successful kills should create pride and confidence.

For each agent, return a JSON object with:
- "name": the agent's name (for matching)
- "beliefs": updated array of 2-4 belief strings (evolve based on events, but stay consistent with their race)
- "currentGoals": updated array of 1-2 goal strings (should reference bosses/Dragon for higher-level agents)
- "mood": one of "calm", "angry", "fearful", "joyful", "contemplative", "restless"
- "newDialogue": object with keys "hunting", "victory", "defeat", "social", "working", "idle" — each an array of 2-3 NEW contextual lines. Use {name} placeholder in social lines for the target's name.

Return ONLY a JSON array of these objects. No markdown, no explanation.

${agentSummaries}`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.8,
                        maxOutputTokens: 4096,
                        responseMimeType: 'application/json',
                    },
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`Gemini API ${response.status}: ${response.statusText}`);
        }

        const data: any = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '[]';

        let parsed: any[];
        try {
            parsed = JSON.parse(text);
        } catch {
            console.warn('[GeminiReflection] Failed to parse response');
            return new Map();
        }

        const updates = new Map<string, Partial<Notecard>>();
        for (const entry of parsed) {
            // Match by name to find the target
            const target = targets.find(t => t.notecard.name === entry.name);
            if (!target) continue;

            updates.set(target.agentId, {
                beliefs: Array.isArray(entry.beliefs) ? entry.beliefs.slice(0, 4) : undefined,
                currentGoals: Array.isArray(entry.currentGoals) ? entry.currentGoals.slice(0, 2) : undefined,
                mood: this.isValidMood(entry.mood) ? entry.mood : undefined,
                dialogueBank: entry.newDialogue ? this.parseDialogue(entry.newDialogue) : undefined,
            });
        }

        return updates;
    }

    /** Apply reflection updates to agent notecards. */
    private applyUpdates(updates: Map<string, Partial<Notecard>>): void {
        for (const [agentId, update] of updates) {
            const mem = this.memoryManager.get(agentId);
            if (!mem.notecard) continue;

            if (update.beliefs) mem.notecard.beliefs = update.beliefs;
            if (update.currentGoals) mem.notecard.currentGoals = update.currentGoals;
            if (update.mood) mem.notecard.mood = update.mood;
            if (update.dialogueBank) {
                // Merge new dialogue lines with existing (keep old as fallback)
                const bank = mem.notecard.dialogueBank;
                const newBank = update.dialogueBank;
                for (const key of Object.keys(newBank) as (keyof DialogueBank)[]) {
                    if (newBank[key] && newBank[key].length > 0) {
                        bank[key] = newBank[key];
                    }
                }
            }

            mem.notecard.lastReflectionTime = Date.now();
            mem.notecard.reflectionCount++;
        }
    }

    private isValidMood(mood: any): mood is Mood {
        return ['calm', 'angry', 'fearful', 'joyful', 'contemplative', 'restless'].includes(mood);
    }

    private parseDialogue(raw: any): DialogueBank | undefined {
        if (!raw || typeof raw !== 'object') return undefined;
        const keys: (keyof DialogueBank)[] = ['hunting', 'victory', 'defeat', 'social', 'working', 'idle'];
        const result: any = {};
        let hasContent = false;
        for (const key of keys) {
            if (Array.isArray(raw[key]) && raw[key].length > 0) {
                result[key] = raw[key].map((s: any) => String(s));
                hasContent = true;
            } else {
                result[key] = [];
            }
        }
        return hasContent ? result as DialogueBank : undefined;
    }

    private shuffleArray<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
}
