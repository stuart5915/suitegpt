import { Schema, type, ArraySchema } from '@colyseus/schema';

/**
 * An item offered in a trade window.
 */
export class TradeItem extends Schema {
    @type('string') itemId: string = '';
    @type('string') name: string = '';
    @type('string') icon: string = '';
    @type('uint16') quantity: number = 0;
    @type('uint8') inventorySlot: number = 0;  // source slot in player inventory
}

/**
 * Active trade session between two players.
 *
 * Lifecycle:
 *   1. Player A sends trade_request → creates TradeSchema with status 'pending'
 *   2. Player B sends trade_accept → status becomes 'active', both see trade window
 *   3. Both add/remove items and coins via trade_offer_item / trade_remove_item / trade_set_coins
 *   4. Each player sends trade_confirm → sets their accepted flag
 *   5. When both accepted, server validates and swaps items → status 'completed'
 *   6. Either player can trade_cancel at any time → status 'cancelled'
 *
 * Integration in AgentScapeRoom:
 *   - Store active trades in a Map<string, TradeSchema> keyed by tradeId
 *   - Action handlers: trade_request, trade_accept, trade_decline,
 *     trade_offer_item, trade_remove_item, trade_set_coins, trade_confirm, trade_cancel
 *   - On completion, use InventorySystem to swap items between players
 *   - Log to agentscape_transactions with event_type 'trade'
 */
export class TradeSchema extends Schema {
    @type('string') tradeId: string = '';
    @type('string') player1SessionId: string = '';
    @type('string') player2SessionId: string = '';
    @type('string') player1Name: string = '';
    @type('string') player2Name: string = '';
    @type([TradeItem]) player1Offer = new ArraySchema<TradeItem>();
    @type([TradeItem]) player2Offer = new ArraySchema<TradeItem>();
    @type('uint32') player1Coins: number = 0;
    @type('uint32') player2Coins: number = 0;
    @type('boolean') player1Accepted: boolean = false;
    @type('boolean') player2Accepted: boolean = false;
    @type('string') status: string = 'pending'; // pending | active | completed | cancelled
}
