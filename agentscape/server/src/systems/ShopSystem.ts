// ============================================================
// AgentScape — Server-Authoritative Shop System
// General Store + Resource Shop + sell pricing for gathered materials
// ============================================================
//
// === INTEGRATION NOTES (for AgentScapeRoom.ts) ===
//
// Add action handlers:
//   case 'sell_resource': {
//       const result = this.shopSystem.sellResource(player, action.payload.inventorySlot);
//       client.send('system_message', { message: result.message });
//       break;
//   }
//   case 'buy_resource': {
//       const result = this.shopSystem.buyResource(player, action.payload.itemId, action.payload.quantity, state);
//       client.send('system_message', { message: result.message });
//       break;
//   }
//   case 'get_sell_price': {
//       const price = this.shopSystem.getSellPrice(action.payload.itemId);
//       client.send('sell_price', { itemId: action.payload.itemId, price });
//       break;
//   }
// Existing buy_item / sell_item handlers work unchanged.
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { GameState, ShopStock } from '../schema/GameState';
import { SHOP_ITEMS, ITEMS } from '../config';
import { InventorySystem } from './InventorySystem';

// ============================================================
// Sell Prices — what the shop pays for gathered materials
// (buy prices are 2x sell price for resources available in shop)
// ============================================================

const RESOURCE_SELL_PRICES: Record<string, number> = {
    // Woodcutting resources
    logs:              3,
    code_fragment:     8,
    agent_core:        25,

    // Mining resources
    corrupted_byte:    4,
    broken_link:       7,
    memory_shard:      12,
    null_fragment:     18,
    overflow_essence:  22,
    dark_packet:       30,
    firewall_core:     45,
    dragon_scale:      60,
    network_key:       100,

    // Fishing resources
    raw_fish:          3,

    // Misc drops
    bones:             2,
    rogue_script:      10,

    // Boss trophies — high value collectibles
    rogue_script_trophy: 250,
    golem_heart:         500,
    hallucinator_eye:    1000,
    dragon_heart:        2500,

    // Food (sell back at reduced rate)
    bread:             5,
    cooked_meat:       12,
    cooked_fish:       10,
    lobster:           40,
    shark:             100,
    manta_ray:         250,

    // Potions
    attack_potion:     75,
    strength_potion:   75,
    defence_potion:    75,

    // Equipment (sell at ~40% of shop buy price)
    bronze_sword:      20,
    bronze_helm:       12,
    bronze_shield:     16,
    iron_sword:        60,
    iron_helm:         40,
    iron_shield:       48,
    steel_sword:       160,
    steel_helm:        120,
    steel_shield:      140,
    mithril_sword:     480,
    mithril_helm:      360,
    mithril_shield:    400,
    rune_sword:        800,
    rune_helm:         600,
    rune_shield:       700,
    dragon_sword:      2000,
    dragon_helm:       1500,
    dragon_shield:     1800,

    // Utility items (~40-50% of buy price)
    tinderbox:         2,
    bucket:            1,
    pot:               1,
    jug:               1,
    hammer:            2,
    chisel:            2,
    needle:            1,
    thread:            1,
    shears:            1,
    knife:             3,
};

// ============================================================
// Resource Shop Items — buyable at the General Store
// These supplement the existing SHOP_ITEMS from config
// ============================================================

interface ResourceShopItem {
    id: string;
    price: number;
    stock: number;
    restockRate: number; // items added per restock cycle (60s)
    maxStock: number;
}

const RESOURCE_SHOP_ITEMS: ResourceShopItem[] = [
    // Basic gathering materials (for players who want to skip grinding)
    { id: 'logs', price: 8, stock: 50, restockRate: 10, maxStock: 50 },
    { id: 'raw_fish', price: 8, stock: 30, restockRate: 5, maxStock: 30 },
    { id: 'corrupted_byte', price: 12, stock: 20, restockRate: 3, maxStock: 20 },
    { id: 'broken_link', price: 18, stock: 15, restockRate: 2, maxStock: 15 },
    { id: 'code_fragment', price: 20, stock: 15, restockRate: 2, maxStock: 15 },
    // Mid-tier (limited, expensive)
    { id: 'memory_shard', price: 30, stock: 8, restockRate: 1, maxStock: 8 },
    { id: 'null_fragment', price: 45, stock: 5, restockRate: 1, maxStock: 5 },
    { id: 'overflow_essence', price: 55, stock: 5, restockRate: 1, maxStock: 5 },
    // Bones (for prayer training)
    { id: 'bones', price: 5, stock: 99, restockRate: 20, maxStock: 99 },
];

// ============================================================
// ShopSystem
// ============================================================

export class ShopSystem {
    private inventorySystem: InventorySystem;
    private resourceStock: Map<string, { stock: number; maxStock: number; restockRate: number }> = new Map();
    private restockTimer: number = 0;

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
        this.initResourceStock();
    }

    // ============================================================
    // Initialization
    // ============================================================

    initShopStock(state: GameState): void {
        for (const si of SHOP_ITEMS) {
            const stock = new ShopStock();
            stock.itemId = si.id;
            stock.stock = si.stock;
            state.shopStock.set(si.id, stock);
        }
    }

    private initResourceStock(): void {
        for (const item of RESOURCE_SHOP_ITEMS) {
            this.resourceStock.set(item.id, {
                stock: item.stock,
                maxStock: item.maxStock,
                restockRate: item.restockRate,
            });
        }
    }

    // ============================================================
    // General Store — Buy/Sell (original + enhanced)
    // ============================================================

    buyItem(player: PlayerSchema, itemId: string, qty: number, state: GameState): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const si = SHOP_ITEMS.find(s => s.id === itemId);
        if (!si) return { success: false, message: 'Item not found.' };

        const stock = state.shopStock.get(itemId);
        if (!stock || stock.stock < qty) return { success: false, message: 'Out of stock!' };

        const cost = si.price * qty;
        if (!this.inventorySystem.deductCoins(player, cost)) {
            return { success: false, message: 'Not enough coins!' };
        }

        if (!this.inventorySystem.addToInventory(player, itemId, qty)) {
            // Refund coins
            this.inventorySystem.addToInventory(player, 'coins', cost);
            return { success: false, message: 'Inventory full!' };
        }

        stock.stock -= qty;
        const item = ITEMS[itemId];
        return { success: true, message: `Bought ${qty}x ${item?.name || itemId} for ${cost} coins.` };
    }

    sellItem(player: PlayerSchema, slot: number, state: GameState): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const item = player.inventory[slot];
        if (!item.id || item.type === 'coin') return { success: false, message: 'Cannot sell that.' };

        // Use resource sell price if available, else fallback to shop price / 2
        const sellPrice = this.getSellPrice(item.id);
        const name = item.name;

        this.inventorySystem.addToInventory(player, 'coins', sellPrice);
        this.inventorySystem.removeFromInventory(player, slot, 1);

        // Restock general store if it carries this item
        const si = SHOP_ITEMS.find(s => s.id === item.id);
        if (si) {
            const stock = state.shopStock.get(item.id);
            if (stock) stock.stock += 1;
        }

        // Restock resource shop if applicable
        const rs = this.resourceStock.get(item.id);
        if (rs && rs.stock < rs.maxStock) {
            rs.stock += 1;
        }

        return { success: true, message: `Sold ${name} for ${sellPrice} coins.` };
    }

    // ============================================================
    // Resource Shop — Buy/Sell gathered materials
    // ============================================================

    buyResource(player: PlayerSchema, itemId: string, qty: number, _state: GameState): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const shopItem = RESOURCE_SHOP_ITEMS.find(r => r.id === itemId);
        if (!shopItem) return { success: false, message: 'Item not available in the resource shop.' };

        const rs = this.resourceStock.get(itemId);
        if (!rs || rs.stock < qty) return { success: false, message: 'Out of stock!' };

        const cost = shopItem.price * qty;
        if (!this.inventorySystem.deductCoins(player, cost)) {
            return { success: false, message: 'Not enough coins!' };
        }

        if (!this.inventorySystem.addToInventory(player, itemId, qty)) {
            this.inventorySystem.addToInventory(player, 'coins', cost);
            return { success: false, message: 'Inventory full!' };
        }

        rs.stock -= qty;
        const item = ITEMS[itemId];
        return { success: true, message: `Bought ${qty}x ${item?.name || itemId} for ${cost} coins.` };
    }

    sellResource(player: PlayerSchema, slot: number): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };

        const item = player.inventory[slot];
        if (!item.id || item.type === 'coin') return { success: false, message: 'Cannot sell that.' };

        const sellPrice = this.getSellPrice(item.id);
        if (sellPrice <= 0) return { success: false, message: 'That item has no sell value.' };

        const name = item.name;
        this.inventorySystem.addToInventory(player, 'coins', sellPrice);
        this.inventorySystem.removeFromInventory(player, slot, 1);

        // Restock resource shop
        const rs = this.resourceStock.get(item.id);
        if (rs && rs.stock < rs.maxStock) {
            rs.stock += 1;
        }

        return { success: true, message: `Sold ${name} for ${sellPrice} coins.` };
    }

    // ============================================================
    // Pricing
    // ============================================================

    getSellPrice(itemId: string): number {
        // Use explicit resource sell price
        if (RESOURCE_SELL_PRICES[itemId] !== undefined) {
            return RESOURCE_SELL_PRICES[itemId];
        }
        // Fallback: half of shop buy price
        const si = SHOP_ITEMS.find(s => s.id === itemId);
        if (si) return Math.floor(si.price / 2);
        // Last resort: 1 coin
        return 1;
    }

    getBuyPrice(itemId: string): number | null {
        // Check general store
        const si = SHOP_ITEMS.find(s => s.id === itemId);
        if (si) return si.price;
        // Check resource shop
        const ri = RESOURCE_SHOP_ITEMS.find(r => r.id === itemId);
        if (ri) return ri.price;
        return null;
    }

    // ============================================================
    // Restock — call periodically from game loop (every 60s)
    // ============================================================

    /**
     * Tick the restock timer. Call every frame with dtSec.
     * Returns true if a restock happened this tick.
     */
    updateRestock(dt: number): boolean {
        this.restockTimer += dt;
        if (this.restockTimer < 60) return false;
        this.restockTimer -= 60;

        this.resourceStock.forEach((rs) => {
            if (rs.stock < rs.maxStock) {
                rs.stock = Math.min(rs.maxStock, rs.stock + rs.restockRate);
            }
        });

        return true;
    }

    // ============================================================
    // Shop State — for client UI
    // ============================================================

    getResourceShopItems(): { id: string; name: string; icon: string; price: number; stock: number }[] {
        return RESOURCE_SHOP_ITEMS.map(item => {
            const rs = this.resourceStock.get(item.id);
            const def = ITEMS[item.id];
            return {
                id: item.id,
                name: def?.name || item.id,
                icon: def?.icon || '',
                price: item.price,
                stock: rs?.stock || 0,
            };
        });
    }

    /** Full price list for all sellable items */
    getSellPriceList(): { id: string; name: string; price: number }[] {
        return Object.entries(RESOURCE_SELL_PRICES).map(([id, price]) => ({
            id,
            name: ITEMS[id]?.name || id,
            price,
        }));
    }
}
