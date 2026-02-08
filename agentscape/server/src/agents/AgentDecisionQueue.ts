// ============================================================
// AgentScape — Agent LLM Decision Queue
// Batches LLM calls, rate limits to 10/sec
// Routine decisions → Haiku, Complex → Sonnet
//
// NOTE: Primary agent behavior is now driven by the behavior
// tree in NPCBehaviorSystem. This class remains as the future
// LLM integration point. Chat generation has been moved to
// the behavior system to avoid duplicates.
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
    private lastDecisionTime = new Map<string, number>();

    // For now, agent decisions are rule-based (same as current NPC AI).
    // LLM integration point: replace getDecision() with API calls to
    // Claude Haiku/Sonnet for intelligent decision-making.
    //
    // Primary behavior is now in NPCBehaviorSystem's behavior trees.
    // This method returns null to avoid duplicate actions.

    getDecision(npc: NPCSchema, state: GameState): AgentDecision | null {
        // Behavior tree in NPCBehaviorSystem handles all agent decisions.
        // This method is kept for backwards compatibility with the room
        // and as the future LLM decision entry point.
        return null;
    }

    cleanup(npcId: string): void {
        this.lastDecisionTime.delete(npcId);
    }
}
