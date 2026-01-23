// Terminology Context - Zustand store for managing term sheet navigation
import { create } from 'zustand';
import { Term, findTerm } from '@/lib/terminology';

interface TermSheetState {
    // Stack of terms being viewed (for back navigation)
    termStack: Term[];

    // Whether the bottom sheet is visible
    isVisible: boolean;

    // Open a term (push to stack)
    openTerm: (termName: string) => void;

    // Go back to previous term
    goBack: () => void;

    // Close the sheet entirely
    close: () => void;

    // Get current term (top of stack)
    currentTerm: () => Term | undefined;
}

export const useTerminologyStore = create<TermSheetState>((set, get) => ({
    termStack: [],
    isVisible: false,

    openTerm: (termName: string) => {
        const term = findTerm(termName);
        if (term) {
            set((state) => ({
                termStack: [...state.termStack, term],
                isVisible: true,
            }));
        }
    },

    goBack: () => {
        set((state) => {
            const newStack = state.termStack.slice(0, -1);
            return {
                termStack: newStack,
                isVisible: newStack.length > 0,
            };
        });
    },

    close: () => {
        set({
            termStack: [],
            isVisible: false,
        });
    },

    currentTerm: () => {
        const stack = get().termStack;
        return stack.length > 0 ? stack[stack.length - 1] : undefined;
    },
}));
