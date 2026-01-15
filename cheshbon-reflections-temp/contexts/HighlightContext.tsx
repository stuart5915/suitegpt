import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import {
    saveMultipleHighlights,
    getHighlightsForChapter,
    deleteHighlight,
    VerseHighlight
} from '../services/highlightService';

// Highlight colors - consistent across all pages
export const HIGHLIGHT_COLORS = [
    { name: 'Yellow', hex: '#FFE082' },
    { name: 'Green', hex: '#A5D6A7' },
    { name: 'Blue', hex: '#90CAF9' },
    { name: 'Pink', hex: '#F48FB1' },
    { name: 'Purple', hex: '#CE93D8' },
];

interface HighlightContextType {
    // Current scripture location
    currentBook: string;
    currentChapter: number;
    setLocation: (book: string, chapter: number) => void;

    // Selection state
    selectedVerses: Set<number>;
    isSelectionMode: boolean;
    toggleVerseSelection: (verse: number) => void;
    clearSelection: () => void;

    // Highlights
    highlights: VerseHighlight[];
    loadHighlights: () => Promise<void>;
    applyHighlight: (color: string) => Promise<void>;
    removeHighlight: (verse: number) => Promise<void>;
    getHighlightColor: (verse: number) => string | null;
}

const HighlightContext = createContext<HighlightContextType | null>(null);

interface HighlightProviderProps {
    children: ReactNode;
    initialBook?: string;
    initialChapter?: number;
}

export function HighlightProvider({
    children,
    initialBook = 'Genesis',
    initialChapter = 1
}: HighlightProviderProps) {
    const [currentBook, setCurrentBook] = useState(initialBook);
    const [currentChapter, setCurrentChapter] = useState(initialChapter);
    const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
    const [highlights, setHighlights] = useState<VerseHighlight[]>([]);

    const isSelectionMode = selectedVerses.size > 0;

    const setLocation = useCallback((book: string, chapter: number) => {
        setCurrentBook(book);
        setCurrentChapter(chapter);
        setSelectedVerses(new Set()); // Clear selection when location changes
    }, []);

    const toggleVerseSelection = useCallback((verse: number) => {
        setSelectedVerses(prev => {
            const next = new Set(prev);
            if (next.has(verse)) {
                next.delete(verse);
            } else {
                next.add(verse);
            }
            return next;
        });
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedVerses(new Set());
    }, []);

    const loadHighlights = useCallback(async () => {
        const loaded = await getHighlightsForChapter(currentBook, currentChapter);
        setHighlights(loaded);
    }, [currentBook, currentChapter]);

    const applyHighlight = useCallback(async (color: string) => {
        if (selectedVerses.size === 0) return;

        const versesArray = Array.from(selectedVerses);
        const success = await saveMultipleHighlights(currentBook, currentChapter, versesArray, color);

        if (success) {
            // Reload highlights to get the updated list
            await loadHighlights();
            clearSelection();
        }
    }, [selectedVerses, currentBook, currentChapter, loadHighlights, clearSelection]);

    const removeHighlight = useCallback(async (verse: number) => {
        const success = await deleteHighlight(currentBook, currentChapter, verse);
        if (success) {
            await loadHighlights();
        }
    }, [currentBook, currentChapter, loadHighlights]);

    const getHighlightColor = useCallback((verse: number): string | null => {
        const highlight = highlights.find(h => h.verse === verse);
        return highlight?.color || null;
    }, [highlights]);

    const value: HighlightContextType = {
        currentBook,
        currentChapter,
        setLocation,
        selectedVerses,
        isSelectionMode,
        toggleVerseSelection,
        clearSelection,
        highlights,
        loadHighlights,
        applyHighlight,
        removeHighlight,
        getHighlightColor,
    };

    return (
        <HighlightContext.Provider value={value}>
            {children}
        </HighlightContext.Provider>
    );
}

export function useHighlight() {
    const context = useContext(HighlightContext);
    if (!context) {
        throw new Error('useHighlight must be used within a HighlightProvider');
    }
    return context;
}
