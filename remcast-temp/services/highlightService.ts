import { supabase } from './supabase';

export interface VerseHighlight {
    id: string;
    book: string;
    chapter: number;
    verse: number;
    color: string;
    created_at: string;
}

/**
 * Save or update a highlight for a verse
 */
export async function saveHighlight(
    book: string,
    chapter: number,
    verse: number,
    color: string
): Promise<VerseHighlight | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('verse_highlights')
        .upsert({
            user_id: user.id,
            book,
            chapter,
            verse,
            color,
        }, {
            onConflict: 'user_id,book,chapter,verse'
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving highlight:', error);
        return null;
    }

    return data;
}

/**
 * Get all highlights for a specific chapter
 */
export async function getHighlightsForChapter(
    book: string,
    chapter: number
): Promise<VerseHighlight[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('verse_highlights')
        .select('*')
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter);

    if (error) {
        console.error('Error loading highlights:', error);
        return [];
    }

    return data || [];
}

/**
 * Delete a highlight for a specific verse
 */
export async function deleteHighlight(
    book: string,
    chapter: number,
    verse: number
): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
        .from('verse_highlights')
        .delete()
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter)
        .eq('verse', verse);

    if (error) {
        console.error('Error deleting highlight:', error);
        return false;
    }

    return true;
}

/**
 * Save highlights for multiple verses at once
 */
export async function saveMultipleHighlights(
    book: string,
    chapter: number,
    verses: number[],
    color: string
): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const highlights = verses.map(verse => ({
        user_id: user.id,
        book,
        chapter,
        verse,
        color,
    }));

    const { error } = await supabase
        .from('verse_highlights')
        .upsert(highlights, {
            onConflict: 'user_id,book,chapter,verse'
        });

    if (error) {
        console.error('Error saving multiple highlights:', error);
        return false;
    }

    return true;
}

/**
 * Get all highlights for the current user
 */
export async function getAllUserHighlights(): Promise<VerseHighlight[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('verse_highlights')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error loading all highlights:', error);
        return [];
    }

    return data || [];
}

/**
 * Get all highlights for a specific user by ID (for viewing other profiles)
 */
export async function getUserHighlightsById(userId: string): Promise<VerseHighlight[]> {
    console.log('[getUserHighlightsById] Loading highlights for userId:', userId);

    const { data, error } = await supabase
        .from('verse_highlights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[getUserHighlightsById] Error loading user highlights:', error);
        return [];
    }

    console.log('[getUserHighlightsById] Found highlights:', data?.length || 0, data);
    return data || [];
}

/**
 * Delete all highlights for a specific chapter
 */
export async function deleteChapterHighlights(book: string, chapter: number): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
        .from('verse_highlights')
        .delete()
        .eq('user_id', user.id)
        .eq('book', book)
        .eq('chapter', chapter);

    if (error) {
        console.error('Error deleting chapter highlights:', error);
        return false;
    }

    return true;
}

/**
 * Delete all highlights for the current user
 */
export async function deleteAllHighlights(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
        .from('verse_highlights')
        .delete()
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting all highlights:', error);
        return false;
    }

    return true;
}
