// ============================================================
// AgentScape — Agent LLM Decision Queue
// Batches LLM calls, rate limits to 10/sec
// Routine decisions → Haiku, Complex → Sonnet
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameState } from '../schema/GameState';
import { AGENT_DIALOGUE, ROLE_BUILDING_WEIGHTS } from '../config';

export interface AgentDecision {
    npcId: string;
    action: {
        type: string;
        payload: any;
    };
}

export class AgentDecisionQueue {
    private decisionIntervals = new Map<string, number>();
    private lastDecisionTime = new Map<string, number>();

    // For now, agent decisions are rule-based (same as current NPC AI).
    // LLM integration point: replace getDecision() with API calls to
    // Claude Haiku/Sonnet for intelligent decision-making.

    getDecision(npc: NPCSchema, state: GameState): AgentDecision | null {
        const now = Date.now();
        const lastTime = this.lastDecisionTime.get(npc.id) || 0;
        const interval = npc.inCombat ? 2000 : (npc.state === 'IDLE' ? 10000 : 5000);

        if (now - lastTime < interval) return null;
        this.lastDecisionTime.set(npc.id, now);

        // Rule-based decisions (placeholder for LLM)
        if (npc.isDead) return null;

        // Random chat
        if (Math.random() < 0.05) {
            const lines = AGENT_DIALOGUE[npc.role] || AGENT_DIALOGUE.app_builder;
            const line = lines[Math.floor(Math.random() * lines.length)];
            return {
                npcId: npc.id,
                action: { type: 'chat', payload: { message: line } },
            };
        }

        return null;
    }

    cleanup(npcId: string): void {
        this.decisionIntervals.delete(npcId);
        this.lastDecisionTime.delete(npcId);
    }
}
