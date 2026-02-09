// ============================================================
// AgentScape — Agent Connection Manager
// Agents authenticate via factory_users API keys and use
// the same WebSocket protocol as human players.
// ============================================================

import { SupabaseAdapter } from '../persistence/SupabaseAdapter';

export interface AgentInfo {
    id: string;
    name: string;
    displayName: string;
    role: string;
    type: string;
}

export class AgentConnectionManager {
    private supabase: SupabaseAdapter;
    private connectedAgents = new Map<string, AgentInfo>();

    constructor(supabase: SupabaseAdapter) {
        this.supabase = supabase;
    }

    async authenticateAgent(apiKey: string): Promise<AgentInfo | null> {
        const agent = await this.supabase.authenticateAgent(apiKey);
        if (!agent) return null;

        const info: AgentInfo = {
            id: agent.id,
            name: agent.agent_name,
            displayName: agent.display_name || agent.agent_name,
            role: agent.agent_role || 'aligned',
            type: agent.agent_type || 'hosted',
        };

        this.connectedAgents.set(agent.id, info);
        return info;
    }

    disconnectAgent(agentId: string): void {
        this.connectedAgents.delete(agentId);
    }

    getConnectedAgents(): Map<string, AgentInfo> {
        return this.connectedAgents;
    }

    isAgent(sessionId: string): boolean {
        return this.connectedAgents.has(sessionId);
    }
}
