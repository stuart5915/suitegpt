/**
 * Video Generation Service
 * Triggers reel generation and tracks progress
 */
import { supabase } from './supabase';

export interface GenerationStatus {
    generation_status: string | null;
    generation_progress: number;
    generation_error: string | null;
    reel_url: string | null;
}

export interface UserCredits {
    video_credits: number;
    total_generated: number;
}

/**
 * Trigger video reel generation for a dream
 */
export async function triggerReelGeneration(dreamId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { data, error } = await supabase.functions.invoke('generate-reel', {
            body: { dreamId },
        });

        if (error) {
            console.error('[VideoGen] Edge function error:', error);
            return { success: false, error: error.message };
        }

        if (!data.success) {
            return { success: false, error: data.error || 'Generation failed' };
        }

        return { success: true };
    } catch (error: any) {
        console.error('[VideoGen] Error triggering generation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current generation status for a dream
 */
export async function getGenerationStatus(dreamId: string): Promise<GenerationStatus | null> {
    try {
        const { data, error } = await supabase
            .from('dreams')
            .select('generation_status, generation_progress, generation_error, reel_url')
            .eq('id', dreamId)
            .single();

        if (error) {
            console.error('[VideoGen] Error fetching status:', error);
            return null;
        }

        return data as GenerationStatus;
    } catch (error) {
        console.error('[VideoGen] Error fetching generation status:', error);
        return null;
    }
}

/**
 * Get user's video credits
 */
export async function getUserCredits(): Promise<UserCredits | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('user_credits')
            .select('video_credits, total_generated')
            .eq('user_id', user.id)
            .single();

        if (error) {
            // If no row exists or table/column doesn't exist, return default credits
            if (error.code === 'PGRST116' || error.code === '42703' || error.code === '42P01') {
                console.log('[VideoGen] Credits table/column not set up yet, using defaults');
                return { video_credits: 3, total_generated: 0 };
            }
            console.error('[VideoGen] Error fetching credits:', error);
            return { video_credits: 3, total_generated: 0 }; // Return defaults instead of null
        }

        return data as UserCredits;
    } catch (error) {
        console.error('[VideoGen] Error fetching credits:', error);
        return { video_credits: 3, total_generated: 0 }; // Return defaults instead of null
    }
}

/**
 * Subscribe to generation status updates
 */
export function subscribeToGenerationStatus(
    dreamId: string,
    onUpdate: (status: GenerationStatus) => void
): () => void {
    const channel = supabase
        .channel(`generation-${dreamId}`)
        .on(
            'postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: 'dreams',
                filter: `id=eq.${dreamId}`,
            },
            (payload) => {
                onUpdate({
                    generation_status: payload.new.generation_status,
                    generation_progress: payload.new.generation_progress,
                    generation_error: payload.new.generation_error,
                    reel_url: payload.new.reel_url,
                });
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Get human-readable status text
 */
export function getGenerationStatusText(status: string | null): string {
    switch (status) {
        case 'generating_1':
            return 'Generating Scene 1 of 3...';
        case 'generating_2':
            return 'Generating Scene 2 of 3...';
        case 'generating_3':
            return 'Generating Scene 3 of 3...';
        case 'stitching':
            return 'Stitching clips together...';
        case 'uploading':
            return 'Uploading your reel...';
        case 'complete':
            return 'Complete!';
        case 'error':
            return 'Generation failed';
        default:
            return 'Preparing...';
    }
}
