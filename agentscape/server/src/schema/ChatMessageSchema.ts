import { Schema, type, ArraySchema } from '@colyseus/schema';

/**
 * A single chat message synced to clients via GameState.
 *
 * Channels:
 *   - 'global'  — visible to all players in the room
 *   - 'local'   — visible within ~10 tile radius
 *   - 'trade'   — trade channel for buy/sell offers
 *   - 'clan'    — clan-only (future)
 *   - 'system'  — server announcements, achievement broadcasts, rare drops
 *
 * Integration in AgentScapeRoom:
 *   1. Add `chatMessages: ArraySchema<ChatMessage>` to GameState
 *   2. On 'chat' action, validate + create ChatMessage, push to state
 *   3. Keep max 50 messages in state (shift oldest)
 *   4. Optionally persist to agentscape_chat_log table for moderation
 *   5. System messages (achievements, rare drops) use channel='system'
 */
export class ChatMessage extends Schema {
    @type('string') id: string = '';
    @type('string') senderSessionId: string = '';
    @type('string') senderName: string = '';
    @type('string') message: string = '';
    @type('string') channel: string = 'global';  // global, local, trade, clan, system
    @type('float64') timestamp: number = 0;
    @type('string') badge: string = '';           // optional badge icon (e.g. achievement tier)
    @type('boolean') isSystem: boolean = false;   // true for server announcements
}
