// ============================================================
// AgentScape — Functional Behavior Tree Framework
// Lightweight BT nodes composed via functions.
// No classes, no inheritance — just composable functions.
// ============================================================

import { NPCSchema } from '../schema/NPCSchema';
import { GameMap } from '../utils/MapGenerator';
import { AgentMemory } from './AgentMemory';
import { AgentProfile } from './AgentProfiles';

// ---- Types ----

export type BTStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING';

export interface BTContext {
    npc: NPCSchema;
    memory: AgentMemory;
    profile: AgentProfile;
    map: GameMap;
}

export type BTNode = (ctx: BTContext) => BTStatus;

// ---- Composite Nodes ----

/** Try children in order. Return first non-FAILURE result. */
export function selector(...children: BTNode[]): BTNode {
    return (ctx) => {
        for (const child of children) {
            const s = child(ctx);
            if (s !== 'FAILURE') return s;
        }
        return 'FAILURE';
    };
}

/** Run children in order. Stop on first non-SUCCESS result. */
export function sequence(...children: BTNode[]): BTNode {
    return (ctx) => {
        for (const child of children) {
            const s = child(ctx);
            if (s !== 'SUCCESS') return s;
        }
        return 'SUCCESS';
    };
}

/** Pick a child by weighted random, then tick it. */
export function weightedRandom(entries: { weight: number; node: BTNode }[]): BTNode {
    return (ctx) => {
        const total = entries.reduce((s, e) => s + e.weight, 0);
        if (total <= 0) return 'FAILURE';
        let r = Math.random() * total;
        for (const { weight, node } of entries) {
            r -= weight;
            if (r <= 0) return node(ctx);
        }
        return entries[entries.length - 1].node(ctx);
    };
}

// ---- Leaf Nodes ----

/** Check a boolean predicate. */
export function condition(pred: (ctx: BTContext) => boolean): BTNode {
    return (ctx) => pred(ctx) ? 'SUCCESS' : 'FAILURE';
}

/** Execute a side-effecting action. Always returns SUCCESS. */
export function action(fn: (ctx: BTContext) => void): BTNode {
    return (ctx) => { fn(ctx); return 'SUCCESS'; };
}

/** Execute an action that can fail. */
export function tryAction(fn: (ctx: BTContext) => boolean): BTNode {
    return (ctx) => fn(ctx) ? 'SUCCESS' : 'FAILURE';
}

// ---- Decorators ----

/** Invert the child's result (SUCCESS <-> FAILURE). RUNNING passes through. */
export function invert(child: BTNode): BTNode {
    return (ctx) => {
        const s = child(ctx);
        if (s === 'SUCCESS') return 'FAILURE';
        if (s === 'FAILURE') return 'SUCCESS';
        return 'RUNNING';
    };
}
