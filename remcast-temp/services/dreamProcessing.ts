/**
 * Dream Processing Service
 * Calls the Supabase Edge Function and polls for completion
 */
import { supabase } from './supabase';

export interface DreamScene {
    scene_number: number;
    duration_seconds: number;
    visual_description: string;
    camera_movement: string;
    mood_lighting: string;
    key_elements: string[];
}

export interface ProcessedDream {
    id: string;
    user_id: string;
    title: string | null;
    transcript: string | null;
    scenes: DreamScene[] | null;
    mood: string | null;
    audio_url: string | null;
    reel_url: string | null;
    thumbnail_url: string | null;
    dream_image_url: string | null;
    is_public: boolean;
    processing_status: 'pending' | 'transcribing' | 'analyzing' | 'complete' | 'error';
    processing_error: string | null;
    generation_status: string | null;
    generation_progress: number;
    generation_error: string | null;
    created_at: string;
    processed_at: string | null;
}

// Supabase Edge Function URL - using direct fetch for reliability in Expo Go
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-dream`;

/**
 * Trigger AI processing for a dream
 * Uses direct fetch() instead of supabase.functions.invoke() for Expo Go compatibility
 */
export async function triggerDreamProcessing(dreamId: string): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('[DreamProcessing] Calling Edge Function directly for:', dreamId);
        console.log('[DreamProcessing] URL:', EDGE_FUNCTION_URL);

        // Use direct fetch - supabase.functions.invoke silently fails in Expo Go
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dreamId }),
        });

        console.log('[DreamProcessing] Response status:', response.status);

        const data = await response.json();
        console.log('[DreamProcessing] Response data:', data);

        if (!response.ok) {
            console.error('[DreamProcessing] Edge function error:', data);
            return { success: false, error: data?.error || `HTTP ${response.status}` };
        }

        if (!data?.success) {
            console.log('[DreamProcessing] Function returned failure:', data);
            return { success: false, error: data?.error || 'Processing failed' };
        }

        console.log('[DreamProcessing] Successfully processed dream:', data.title);
        return { success: true };
    } catch (error: any) {
        console.error('[DreamProcessing] Error triggering processing:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get a dream by ID
 */
export async function getDream(dreamId: string): Promise<ProcessedDream | null> {
    try {
        const { data, error } = await supabase
            .from('dreams')
            .select('*')
            .eq('id', dreamId)
            .single();

        if (error) {
            console.error('[DreamProcessing] Error fetching dream:', error);
            return null;
        }

        return data as ProcessedDream;
    } catch (error) {
        console.error('[DreamProcessing] Error fetching dream:', error);
        return null;
    }
}

/**
 * Get all dreams for the current user
 */
export async function getUserDreams(): Promise<ProcessedDream[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('dreams')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DreamProcessing] Error fetching dreams:', error);
            return [];
        }

        return (data || []) as ProcessedDream[];
    } catch (error) {
        console.error('[DreamProcessing] Error fetching dreams:', error);
        return [];
    }
}

/**
 * Poll for dream processing completion
 * @param dreamId Dream ID to poll
 * @param onUpdate Callback for status updates
 * @param maxAttempts Maximum polling attempts (default 60 = 2 minutes)
 * @param intervalMs Polling interval in ms (default 2000)
 */
export async function pollDreamProcessing(
    dreamId: string,
    onUpdate?: (dream: ProcessedDream) => void,
    maxAttempts: number = 60,
    intervalMs: number = 2000
): Promise<ProcessedDream | null> {
    let attempts = 0;

    return new Promise((resolve) => {
        const poll = async () => {
            attempts++;
            const dream = await getDream(dreamId);

            if (dream) {
                onUpdate?.(dream);

                if (dream.processing_status === 'complete' || dream.processing_status === 'error') {
                    resolve(dream);
                    return;
                }
            }

            if (attempts >= maxAttempts) {
                resolve(dream);
                return;
            }

            setTimeout(poll, intervalMs);
        };

        poll();
    });
}

/**
 * Subscribe to real-time updates for a dream
 */
export function subscribeToDream(
    dreamId: string,
    onUpdate: (dream: ProcessedDream) => void
): () => void {
    const channel = supabase
        .channel(`dream-${dreamId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'dreams',
                filter: `id=eq.${dreamId}`,
            },
            (payload) => {
                onUpdate(payload.new as ProcessedDream);
            }
        )
        .subscribe();

    // Return unsubscribe function
    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Delete a dream
 */
export async function deleteDream(dreamId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('dreams')
            .delete()
            .eq('id', dreamId);

        if (error) {
            console.error('[DreamProcessing] Error deleting dream:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[DreamProcessing] Error deleting dream:', error);
        return false;
    }
}

/**
 * Update dream transcript
 */
export async function updateDreamTranscript(dreamId: string, transcript: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('dreams')
            .update({ transcript })
            .eq('id', dreamId);

        if (error) {
            console.error('[DreamProcessing] Error updating transcript:', error);
            return false;
        }

        console.log('[DreamProcessing] Transcript updated successfully');
        return true;
    } catch (error) {
        console.error('[DreamProcessing] Error updating transcript:', error);
        return false;
    }
}

/**
 * Update dream image URL
 */
export async function updateDreamImageUrl(dreamId: string, imageUrl: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('dreams')
            .update({ dream_image_url: imageUrl })
            .eq('id', dreamId);

        if (error) {
            console.error('[DreamProcessing] Error updating dream image:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[DreamProcessing] Error updating dream image:', error);
        return false;
    }
}

/**
 * Get mood color based on dream mood
 */
export function getMoodColor(mood: string | null): string {
    const moodColors: Record<string, string> = {
        peaceful: '#10B981',    // Green
        chaotic: '#EF4444',     // Red
        surreal: '#8B5CF6',     // Purple
        prophetic: '#F59E0B',   // Amber
        nightmare: '#7C3AED',   // Dark purple
        lucid: '#06B6D4',       // Cyan
        nostalgic: '#EC4899',   // Pink
        adventurous: '#F97316', // Orange
    };
    return moodColors[mood || ''] || '#64748B';
}

/**
 * Get mood emoji
 */
export function getMoodEmoji(mood: string | null): string {
    const moodEmojis: Record<string, string> = {
        peaceful: '🌙',
        chaotic: '🌪️',
        surreal: '🎭',
        prophetic: '👁️',
        nightmare: '😱',
        lucid: '✨',
        nostalgic: '💭',
        adventurous: '🚀',
    };
    return moodEmojis[mood || ''] || '💫';
}
