// ============================================================
// AgentScape — Server-Authoritative Bank System
// Store/retrieve items beyond the 28-slot inventory
// ============================================================
//
// === INTEGRATION NOTES (for AgentScapeRoom.ts / other terminals) ===
//
// AgentScapeRoom.ts — Wire up:
//   1. Initialize in onCreate:
//      this.bankSystem = new BankSystem(this.inventorySystem);
//
//   2. Add action handlers in handleAction switch:
//      case 'bank_open': {
//          const result = this.bankSystem.open(player);
//          if (result.success) {
//              client.send('bank_contents', this.bankSystem.getContents(player));
//          } else {
//              client.send('system_message', { message: result.message });
//          }
//          break;
//      }
//      case 'bank_deposit': {
//          const result = this.bankSystem.deposit(player, action.payload.inventorySlot, action.payload.quantity);
//          client.send('system_message', { message: result.message });
//          if (result.success) client.send('bank_update', this.bankSystem.getContents(player));
//          break;
//      }
//      case 'bank_deposit_all': {
//          const result = this.bankSystem.depositAll(player);
//          client.send('system_message', { message: result.message });
//          if (result.success) client.send('bank_update', this.bankSystem.getContents(player));
//          break;
//      }
//      case 'bank_withdraw': {
//          const result = this.bankSystem.withdraw(player, action.payload.bankSlot, action.payload.quantity);
//          client.send('system_message', { message: result.message });
//          if (result.success) client.send('bank_update', this.bankSystem.getContents(player));
//          break;
//      }
//
//   3. In onJoin, restore bank data:
//      this.bankSystem.restore(player, saved?.bankData);
//
//   4. In save logic (SaveManager), include bank data:
//      bankData: this.bankSystem.serialize(player)
//
//   5. ActionValidator — add 'bank_open', 'bank_deposit', 'bank_deposit_all',
//      'bank_withdraw' to valid action types
// ============================================================

import { PlayerSchema } from '../schema/PlayerSchema';
import { BUILDINGS, MAX_INVENTORY_SLOTS } from '../config';
import { InventorySystem } from './InventorySystem';

export const MAX_BANK_SLOTS = 100;
const BANK_RANGE = 5; // Manhattan distance from Bank building

export interface BankSlot {
    id: string;
    name: string;
    icon: string;
    quantity: number;
    type: string;
    stackable: boolean;
    attackStat: number;
    strengthStat: number;
    defenceStat: number;
    healAmount: number;
}

export class BankSystem {
    private inventorySystem: InventorySystem;
    private banks: Map<string, BankSlot[]> = new Map();

    constructor(inventorySystem: InventorySystem) {
        this.inventorySystem = inventorySystem;
    }

    private getBankKey(player: PlayerSchema): string {
        return player.supabaseUserId || player.sessionId;
    }

    private getBank(player: PlayerSchema): BankSlot[] {
        const key = this.getBankKey(player);
        if (!this.banks.has(key)) {
            this.banks.set(key, []);
        }
        return this.banks.get(key)!;
    }

    private isNearBank(player: PlayerSchema): boolean {
        const bank = BUILDINGS.find(b => b.id === 'bank');
        if (!bank) return false;
        const dist = Math.abs(player.tileX - bank.x) + Math.abs(player.tileZ - bank.z);
        return dist <= BANK_RANGE;
    }

    // ============================================================
    // Open — verify proximity before deposit/withdraw
    // ============================================================

    open(player: PlayerSchema): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };
        if (!this.isNearBank(player)) {
            return { success: false, message: 'You need to be at the Bank!' };
        }
        return { success: true, message: 'Bank opened.' };
    }

    // ============================================================
    // Deposit — inventory slot -> bank
    // ============================================================

    deposit(
        player: PlayerSchema,
        inventorySlot: number,
        quantity: number = 1,
    ): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };
        if (!this.isNearBank(player)) {
            return { success: false, message: 'You need to be at the Bank!' };
        }

        if (inventorySlot < 0 || inventorySlot >= MAX_INVENTORY_SLOTS) {
            return { success: false, message: 'Invalid inventory slot.' };
        }

        const invItem = player.inventory[inventorySlot];
        if (!invItem || !invItem.id) {
            return { success: false, message: 'No item in that slot.' };
        }

        const qty = Math.min(quantity, invItem.quantity);
        if (qty <= 0) return { success: false, message: 'Nothing to deposit.' };

        const bank = this.getBank(player);
        const itemName = invItem.name;

        // Stackable items merge with existing bank stack
        if (invItem.stackable || invItem.type === 'coin') {
            const existing = bank.find(s => s.id === invItem.id);
            if (existing) {
                existing.quantity += qty;
                this.inventorySystem.removeFromInventory(player, inventorySlot, qty);
                player.dirty = true;
                return { success: true, message: `Deposited ${qty}x ${itemName}.` };
            }
        }

        // Check bank capacity
        if (bank.length >= MAX_BANK_SLOTS) {
            return { success: false, message: `Your bank is full! (${MAX_BANK_SLOTS}/${MAX_BANK_SLOTS})` };
        }

        // Create new bank slot
        bank.push({
            id: invItem.id,
            name: invItem.name,
            icon: invItem.icon,
            quantity: qty,
            type: invItem.type,
            stackable: invItem.stackable,
            attackStat: invItem.attackStat,
            strengthStat: invItem.strengthStat,
            defenceStat: invItem.defenceStat,
            healAmount: invItem.healAmount,
        });

        this.inventorySystem.removeFromInventory(player, inventorySlot, qty);
        player.dirty = true;
        return { success: true, message: `Deposited ${qty}x ${itemName}.` };
    }

    // ============================================================
    // Deposit All — dump entire inventory into bank
    // ============================================================

    depositAll(player: PlayerSchema): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };
        if (!this.isNearBank(player)) {
            return { success: false, message: 'You need to be at the Bank!' };
        }

        let deposited = 0;
        // Iterate backwards to avoid index shifting issues
        for (let i = MAX_INVENTORY_SLOTS - 1; i >= 0; i--) {
            const item = player.inventory[i];
            if (item && item.id) {
                const result = this.deposit(player, i, item.quantity);
                if (result.success) deposited++;
            }
        }

        if (deposited === 0) return { success: false, message: 'Nothing to deposit.' };
        return { success: true, message: `Deposited ${deposited} item stack(s).` };
    }

    // ============================================================
    // Withdraw — bank slot -> inventory
    // ============================================================

    withdraw(
        player: PlayerSchema,
        bankSlot: number,
        quantity: number = 1,
    ): { success: boolean; message: string } {
        if (player.isDead) return { success: false, message: 'You are dead!' };
        if (!this.isNearBank(player)) {
            return { success: false, message: 'You need to be at the Bank!' };
        }

        const bank = this.getBank(player);

        if (bankSlot < 0 || bankSlot >= bank.length) {
            return { success: false, message: 'Invalid bank slot.' };
        }

        const bankItem = bank[bankSlot];
        if (!bankItem || !bankItem.id) {
            return { success: false, message: 'No item in that bank slot.' };
        }

        const qty = Math.min(quantity, bankItem.quantity);
        if (qty <= 0) return { success: false, message: 'Nothing to withdraw.' };

        // Try to add to inventory
        if (!this.inventorySystem.addToInventory(player, bankItem.id, qty)) {
            return { success: false, message: 'Inventory is full!' };
        }

        // Remove from bank
        const itemName = bankItem.name;
        bankItem.quantity -= qty;
        if (bankItem.quantity <= 0) {
            bank.splice(bankSlot, 1);
        }

        player.dirty = true;
        return { success: true, message: `Withdrew ${qty}x ${itemName}.` };
    }

    // ============================================================
    // Query
    // ============================================================

    getContents(player: PlayerSchema): BankSlot[] {
        return [...this.getBank(player)];
    }

    getBankSize(player: PlayerSchema): number {
        return this.getBank(player).length;
    }

    getMaxSlots(): number {
        return MAX_BANK_SLOTS;
    }

    // ============================================================
    // Persistence — serialize/restore for SaveManager
    // ============================================================

    serialize(player: PlayerSchema): string {
        return JSON.stringify(this.getBank(player));
    }

    restore(player: PlayerSchema, json?: string): void {
        if (!json) return;
        try {
            const data = JSON.parse(json);
            if (Array.isArray(data)) {
                const key = this.getBankKey(player);
                this.banks.set(key, data.map((slot: any) => ({
                    id: slot.id || '',
                    name: slot.name || '',
                    icon: slot.icon || '',
                    quantity: slot.quantity || 0,
                    type: slot.type || '',
                    stackable: !!slot.stackable,
                    attackStat: slot.attackStat || 0,
                    strengthStat: slot.strengthStat || 0,
                    defenceStat: slot.defenceStat || 0,
                    healAmount: slot.healAmount || 0,
                })));
            }
        } catch { /* malformed data, start with empty bank */ }
    }
}
