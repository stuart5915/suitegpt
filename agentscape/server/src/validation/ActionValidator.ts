// ============================================================
// AgentScape — Action Validator (anti-exploit)
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { NPCSchema } from '../schema/NPCSchema';
import { GameState } from '../schema/GameState';
import { MAP_SIZE, MAX_INVENTORY_SLOTS, SHOP_ITEMS, RECIPES } from '../config';

export type ActionType =
    | 'move_to'
    | 'attack_npc'
    | 'attack_monster'
    | 'eat_food'
    | 'equip_item'
    | 'unequip_item'
    | 'buy_item'
    | 'sell_item'
    | 'craft_item'
    | 'accept_quest'
    | 'use_special_attack'
    | 'start_harvest'
    | 'start_training'
    | 'pickup_loot'
    | 'drop_item'
    | 'toggle_run'
    | 'toggle_rest'
    | 'bury_bones'
    | 'pickpocket'
    | 'emote'
    | 'chat'
    | 'gather_resource'
    | 'cook_item'
    | 'process_resource'
    | 'bank_open'
    | 'bank_deposit'
    | 'bank_deposit_all'
    | 'bank_withdraw'
    | 'bank_stock_all'
    | 'buy_resource'
    | 'sell_resource'
    | 'get_sell_price'
    | 'interact_npc';

export interface GameAction {
    type: ActionType;
    payload: any;
}

export class ActionValidator {
    validate(player: PlayerSchema, action: GameAction, state: GameState): { valid: boolean; reason?: string } {
        // Dead players can only wait
        if (player.isDead && action.type !== 'chat') {
            return { valid: false, reason: 'You are dead!' };
        }

        // Stunned players can only chat
        if (player.stunTimer > 0 && action.type !== 'chat') {
            return { valid: false, reason: "You're stunned!" };
        }

        switch (action.type) {
            case 'move_to': {
                const { tileX, tileZ } = action.payload;
                if (typeof tileX !== 'number' || typeof tileZ !== 'number') return { valid: false, reason: 'Invalid coords' };
                if (tileX < 0 || tileX >= MAP_SIZE || tileZ < 0 || tileZ >= MAP_SIZE) return { valid: false, reason: 'Out of bounds' };
                return { valid: true };
            }

            case 'attack_npc': {
                const { npcId } = action.payload;
                if (typeof npcId !== 'string') return { valid: false, reason: 'Invalid NPC ID' };
                const npc = state.npcs.get(npcId);
                if (!npc) return { valid: false, reason: 'NPC not found' };
                if (npc.isDead) return { valid: false, reason: 'NPC is dead' };
                return { valid: true };
            }

            case 'attack_monster': {
                const { monsterId } = action.payload;
                if (typeof monsterId !== 'string') return { valid: false, reason: 'Invalid monster ID' };
                const monster = state.monsters.get(monsterId);
                if (!monster) return { valid: false, reason: 'Monster not found' };
                if (monster.isDead) return { valid: false, reason: 'Monster is dead' };
                return { valid: true };
            }

            case 'eat_food': {
                const { inventorySlot } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'equip_item': {
                const { inventorySlot } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'unequip_item': {
                const { slot } = action.payload;
                if (typeof slot !== 'string' || !['weapon', 'helm', 'shield'].includes(slot)) {
                    return { valid: false, reason: 'Invalid equipment slot' };
                }
                return { valid: true };
            }

            case 'buy_item': {
                const { itemId, quantity } = action.payload;
                if (typeof itemId !== 'string') return { valid: false, reason: 'Invalid item' };
                if (typeof quantity !== 'number' || quantity < 1 || quantity > 100) return { valid: false, reason: 'Invalid quantity' };
                if (!SHOP_ITEMS.find(s => s.id === itemId)) return { valid: false, reason: 'Item not in shop' };
                return { valid: true };
            }

            case 'sell_item': {
                const { inventorySlot } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'craft_item': {
                const { recipeIndex } = action.payload;
                if (typeof recipeIndex !== 'number' || recipeIndex < 0 || recipeIndex >= RECIPES.length) {
                    return { valid: false, reason: 'Invalid recipe' };
                }
                return { valid: true };
            }

            case 'accept_quest': {
                const { questId } = action.payload;
                if (typeof questId !== 'string') return { valid: false, reason: 'Invalid quest' };
                return { valid: true };
            }

            case 'use_special_attack':
                return { valid: true };

            case 'toggle_run':
            case 'toggle_rest':
                return { valid: true };

            case 'start_harvest':
            case 'start_training':
                return { valid: true };

            case 'pickup_loot': {
                const { lootId } = action.payload;
                if (typeof lootId !== 'string') return { valid: false, reason: 'Invalid loot ID' };
                if (!state.lootPiles.has(lootId)) return { valid: false, reason: 'Loot pile not found' };
                return { valid: true };
            }

            case 'drop_item': {
                const { inventorySlot } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'bury_bones': {
                const { inventorySlot: slot } = action.payload;
                if (typeof slot !== 'number' || slot < 0 || slot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'pickpocket': {
                const { npcId, monsterId } = action.payload;
                if (npcId) {
                    if (typeof npcId !== 'string') return { valid: false, reason: 'Invalid NPC ID' };
                    const npc = state.npcs.get(npcId);
                    if (!npc) return { valid: false, reason: 'NPC not found' };
                    if (npc.isDead) return { valid: false, reason: 'NPC is dead' };
                } else if (monsterId) {
                    if (typeof monsterId !== 'string') return { valid: false, reason: 'Invalid monster ID' };
                    const monster = state.monsters.get(monsterId);
                    if (!monster) return { valid: false, reason: 'Monster not found' };
                    if (monster.isDead) return { valid: false, reason: 'Target is dead' };
                    if (!monster.isHumanoid) return { valid: false, reason: "You can't pickpocket that." };
                } else {
                    return { valid: false, reason: 'No target specified' };
                }
                return { valid: true };
            }

            case 'emote': {
                const { animId } = action.payload;
                if (typeof animId !== 'string') return { valid: false, reason: 'Invalid emote' };
                const VALID_EMOTES = ['wave','dance','bow','clap','think','laugh','angry','point','cry','cheer','shrug','headbang'];
                if (!VALID_EMOTES.includes(animId)) return { valid: false, reason: 'Unknown emote' };
                return { valid: true };
            }

            case 'chat': {
                const { message } = action.payload;
                if (typeof message !== 'string' || message.length === 0 || message.length > 80) {
                    return { valid: false, reason: 'Invalid message' };
                }
                return { valid: true };
            }

            case 'gather_resource': {
                const { nodeId } = action.payload;
                if (typeof nodeId !== 'string') return { valid: false, reason: 'Invalid node ID' };
                return { valid: true };
            }

            case 'cook_item':
            case 'process_resource': {
                const { recipeId } = action.payload;
                if (typeof recipeId !== 'string') return { valid: false, reason: 'Invalid recipe ID' };
                return { valid: true };
            }

            case 'bank_open':
            case 'bank_deposit_all':
            case 'bank_stock_all':
                return { valid: true };

            case 'bank_deposit': {
                const { inventorySlot, quantity } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 1)) {
                    return { valid: false, reason: 'Invalid quantity' };
                }
                return { valid: true };
            }

            case 'bank_withdraw': {
                const { bankSlot, quantity } = action.payload;
                if (typeof bankSlot !== 'number' || bankSlot < 0) {
                    return { valid: false, reason: 'Invalid bank slot' };
                }
                if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 1)) {
                    return { valid: false, reason: 'Invalid quantity' };
                }
                return { valid: true };
            }

            case 'buy_resource': {
                const { itemId, quantity } = action.payload;
                if (typeof itemId !== 'string') return { valid: false, reason: 'Invalid item' };
                if (typeof quantity !== 'number' || quantity < 1 || quantity > 100) return { valid: false, reason: 'Invalid quantity' };
                return { valid: true };
            }

            case 'sell_resource': {
                const { inventorySlot } = action.payload;
                if (typeof inventorySlot !== 'number' || inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
                    return { valid: false, reason: 'Invalid slot' };
                }
                return { valid: true };
            }

            case 'get_sell_price': {
                const { itemId } = action.payload;
                if (typeof itemId !== 'string') return { valid: false, reason: 'Invalid item' };
                return { valid: true };
            }

            default:
                return { valid: false, reason: 'Unknown action type' };
        }
    }
}
