// Glossary Progress Store
// Track which terms the user has marked as "understood"

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { TERMINOLOGY } from './terminology';

interface GlossaryProgressState {
    // Set of term IDs that user has marked as understood
    understoodTerms: string[];

    // Actions
    toggleTerm: (termId: string) => void;
    markAsUnderstood: (termId: string) => void;
    unmarkTerm: (termId: string) => void;
    isUnderstood: (termId: string) => boolean;
    getProgress: () => { understood: number; total: number; percentage: number };
    resetProgress: () => void;
}

// Create async storage adapter for zustand
const asyncStorage = {
    getItem: async (name: string) => {
        const value = await AsyncStorage.getItem(name);
        return value ?? null;
    },
    setItem: async (name: string, value: string) => {
        await AsyncStorage.setItem(name, value);
    },
    removeItem: async (name: string) => {
        await AsyncStorage.removeItem(name);
    },
};

export const useGlossaryProgress = create<GlossaryProgressState>()(
    persist(
        (set, get) => ({
            understoodTerms: [],

            toggleTerm: (termId: string) => {
                const current = get().understoodTerms;
                if (current.includes(termId)) {
                    set({ understoodTerms: current.filter(id => id !== termId) });
                } else {
                    set({ understoodTerms: [...current, termId] });
                }
            },

            markAsUnderstood: (termId: string) => {
                const current = get().understoodTerms;
                if (!current.includes(termId)) {
                    set({ understoodTerms: [...current, termId] });
                }
            },

            unmarkTerm: (termId: string) => {
                const current = get().understoodTerms;
                set({ understoodTerms: current.filter(id => id !== termId) });
            },

            isUnderstood: (termId: string) => {
                return get().understoodTerms.includes(termId);
            },

            getProgress: () => {
                const understood = get().understoodTerms.length;
                const total = TERMINOLOGY.length;
                const percentage = total > 0 ? Math.round((understood / total) * 100) : 0;
                return { understood, total, percentage };
            },

            resetProgress: () => {
                set({ understoodTerms: [] });
            },
        }),
        {
            name: 'glossary-progress',
            storage: createJSONStorage(() => asyncStorage),
        }
    )
);
