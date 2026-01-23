'use client';

import { create } from 'zustand';

// Asset types supported across all platforms
export type Asset = 'USD' | 'BTC' | 'ETH' | 'USDC';

// Platform identifiers
export type Platform = 'wallet' | 'bank' | 'cex' | 'defi';

// Balance map type
export type Balances = Record<Asset, number>;

// Individual platform state
interface PlatformState {
  balances: Balances;
}

// Transaction record for ledger
export interface Transaction {
  id: string;
  timestamp: number;
  from: Platform;
  to: Platform;
  asset: Asset;
  amount: number;
}

// Full store state
interface SimState {
  // Wallet (browser extension mock)
  wallet: {
    address: string;
    balances: Balances;
    connected: boolean;
  };

  // Platform states
  bank: PlatformState;
  cex: PlatformState;
  defi: PlatformState;

  // Shared ledger
  transactions: Transaction[];

  // Educational tracking
  platformsUsed: string[]; // Track which platforms user has seen modals for

  // Actions
  transfer: (from: Platform, to: Platform, asset: Asset, amount: number) => boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
  resetSimulation: () => void;
  markPlatformUsed: (platformId: string) => void;
}

// Initial balances
const initialWalletBalances: Balances = {
  USD: 0,
  BTC: 0.5,
  ETH: 2.0,
  USDC: 1000,
};

const initialBankBalances: Balances = {
  USD: 10000,
  BTC: 0,
  ETH: 0,
  USDC: 0,
};

const initialCexBalances: Balances = {
  USD: 0,
  BTC: 0,
  ETH: 0,
  USDC: 0,
};

const initialDefiBalances: Balances = {
  USD: 0,
  BTC: 0,
  ETH: 0,
  USDC: 0,
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 15);

// Generate mock wallet address
const generateAddress = () =>
  '0x' + Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

export const useSimStore = create<SimState>((set, get) => ({
  // Initial state
  wallet: {
    address: generateAddress(),
    balances: { ...initialWalletBalances },
    connected: true,
  },
  bank: { balances: { ...initialBankBalances } },
  cex: { balances: { ...initialCexBalances } },
  defi: { balances: { ...initialDefiBalances } },
  transactions: [],
  platformsUsed: [], // Educational tracking starts empty


  // Transfer funds between platforms
  transfer: (from, to, asset, amount) => {
    const state = get();

    // Get source balance
    const sourceBalances = from === 'wallet'
      ? state.wallet.balances
      : state[from].balances;

    // Check sufficient funds
    if (sourceBalances[asset] < amount) {
      return false;
    }

    set((state) => {
      // Create new transaction
      const transaction: Transaction = {
        id: generateId(),
        timestamp: Date.now(),
        from,
        to,
        asset,
        amount,
      };

      // Helper to update balances
      const updateBalances = (
        platform: Platform,
        delta: number
      ): Balances => {
        const current = platform === 'wallet'
          ? state.wallet.balances
          : state[platform].balances;
        return {
          ...current,
          [asset]: current[asset] + delta,
        };
      };

      // Build new state
      const newState: Partial<SimState> = {
        transactions: [...state.transactions, transaction],
      };

      // Update source
      if (from === 'wallet') {
        newState.wallet = {
          ...state.wallet,
          balances: updateBalances('wallet', -amount),
        };
      } else {
        newState[from] = {
          ...state[from],
          balances: updateBalances(from, -amount),
        };
      }

      // Update destination
      if (to === 'wallet') {
        newState.wallet = {
          ...(newState.wallet || state.wallet),
          balances: {
            ...(newState.wallet?.balances || state.wallet.balances),
            [asset]: (newState.wallet?.balances?.[asset] ?? state.wallet.balances[asset]) + amount,
          },
        };
      } else {
        newState[to] = {
          ...state[to],
          balances: {
            ...state[to].balances,
            [asset]: state[to].balances[asset] + amount,
          },
        };
      }

      return newState;
    });

    return true;
  },

  connectWallet: () => set((state) => ({
    wallet: { ...state.wallet, connected: true },
  })),

  disconnectWallet: () => set((state) => ({
    wallet: { ...state.wallet, connected: false },
  })),

  markPlatformUsed: (platformId) => set((state) => ({
    platformsUsed: state.platformsUsed.includes(platformId)
      ? state.platformsUsed
      : [...state.platformsUsed, platformId],
  })),

  resetSimulation: () => set((state) => ({
    wallet: {
      address: generateAddress(),
      balances: { ...initialWalletBalances },
      connected: true,
    },
    bank: { balances: { ...initialBankBalances } },
    cex: { balances: { ...initialCexBalances } },
    defi: { balances: { ...initialDefiBalances } },
    transactions: [],
    platformsUsed: state.platformsUsed, // Preserve educational progress
  })),
}));
