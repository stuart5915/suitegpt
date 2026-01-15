/**
 * Dream Feed Service
 * Handles public dream feed, likes, comments, and social features
 */
import { supabase } from './supabase';

// Types
export interface PublicDream {
    id: string;
    user_id: string;
    title: string | null;
    transcript: string | null;
    mood: string | null;
    reel_url: string | null;
    thumbnail_url: string | null;
    reel_duration_seconds: number | null;
    is_public: boolean;
    likes_count: number;
    comments_count: number;
    views_count: number;
    created_at: string;
    // User info (joined)
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
}

export interface DreamComment {
    id: string;
    dream_id: string;
    user_id: string;
    parent_comment_id: string | null;
    comment_text: string;
    likes_count: number;
    created_at: string;
    display_name: string | null;
    avatar_url: string | null;
}

// ============================================
// Public Feed Functions
// ============================================

/**
 * Get public dream feed with pagination
 */
export async function getPublicDreamFeed(
    limit: number = 20,
    offset: number = 0,
    moodFilter?: string
): Promise<PublicDream[]> {
    try {
        // Simple query without profile join to avoid FK errors
        let query = supabase
            .from('dreams')
            .select('*')
            .eq('is_public', true)
            .eq('processing_status', 'complete')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (moodFilter && moodFilter !== 'all') {
            query = query.eq('mood', moodFilter);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[DreamFeed] Error fetching feed:', error);
            return [];
        }

        // Return with null user info (can be fetched separately if needed)
        return (data || []).map(dream => ({
            ...dream,
            display_name: null,
            username: null,
            avatar_url: null,
            likes_count: dream.likes_count || 0,
            comments_count: dream.comments_count || 0,
            views_count: dream.views_count || 0,
        }));
    } catch (error) {
        console.error('[DreamFeed] Error fetching feed:', error);
        return [];
    }
}

/**
 * Get trending dreams (most liked this week)
 */
export async function getTrendingDreams(limit: number = 10): Promise<PublicDream[]> {
    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const { data, error } = await supabase
            .from('dreams')
            .select(`
                *,
                profiles!dreams_user_id_fkey (
                    display_name,
                    username,
                    avatar_url
                )
            `)
            .eq('is_public', true)
            .eq('processing_status', 'complete')
            .gte('created_at', oneWeekAgo.toISOString())
            .order('likes_count', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('[DreamFeed] Error fetching trending:', error);
            return [];
        }

        return (data || []).map(dream => ({
            ...dream,
            display_name: dream.profiles?.display_name || null,
            username: dream.profiles?.username || null,
            avatar_url: dream.profiles?.avatar_url || null,
        }));
    } catch (error) {
        console.error('[DreamFeed] Error fetching trending:', error);
        return [];
    }
}

/**
 * Get dreams from people the user follows
 */
export async function getFollowingFeed(limit: number = 20, offset: number = 0): Promise<PublicDream[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Get list of users we follow
        const { data: follows } = await supabase
            .from('user_follows')
            .select('following_id')
            .eq('follower_id', user.id);

        if (!follows || follows.length === 0) return [];

        const followingIds = follows.map(f => f.following_id);

        const { data, error } = await supabase
            .from('dreams')
            .select(`
                *,
                profiles!dreams_user_id_fkey (
                    display_name,
                    username,
                    avatar_url
                )
            `)
            .eq('is_public', true)
            .eq('processing_status', 'complete')
            .in('user_id', followingIds)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('[DreamFeed] Error fetching following feed:', error);
            return [];
        }

        return (data || []).map(dream => ({
            ...dream,
            display_name: dream.profiles?.display_name || null,
            username: dream.profiles?.username || null,
            avatar_url: dream.profiles?.avatar_url || null,
        }));
    } catch (error) {
        console.error('[DreamFeed] Error fetching following feed:', error);
        return [];
    }
}

// ============================================
// Like Functions
// ============================================

/**
 * Toggle like on a dream
 */
export async function toggleDreamLike(dreamId: string): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        // Check if already liked
        const { data: existing } = await supabase
            .from('dream_likes')
            .select('id')
            .eq('dream_id', dreamId)
            .eq('user_id', user.id)
            .single();

        if (existing) {
            // Unlike
            await supabase
                .from('dream_likes')
                .delete()
                .eq('dream_id', dreamId)
                .eq('user_id', user.id);

            // Decrement count (best effort)
            try {
                await supabase.rpc('decrement_dream_likes', { dream_id_param: dreamId });
            } catch {
                // RPC doesn't exist, skip
            }

            return false;
        } else {
            // Like
            await supabase
                .from('dream_likes')
                .insert({ dream_id: dreamId, user_id: user.id });

            // Increment count (best effort)
            try {
                const { data: dreamData } = await supabase.from('dreams').select('likes_count').eq('id', dreamId).single();
                await supabase.from('dreams').update({ likes_count: (dreamData?.likes_count || 0) + 1 }).eq('id', dreamId);
            } catch {
                // Skip on error
            }

            return true;
        }
    } catch (error) {
        console.error('[DreamFeed] Error toggling like:', error);
        return false;
    }
}

/**
 * Get dreams the current user has liked
 */
export async function getUserLikedDreams(): Promise<Set<string>> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return new Set();

        const { data } = await supabase
            .from('dream_likes')
            .select('dream_id')
            .eq('user_id', user.id);

        return new Set((data || []).map(like => like.dream_id));
    } catch (error) {
        console.error('[DreamFeed] Error fetching liked dreams:', error);
        return new Set();
    }
}

// ============================================
// Comment Functions
// ============================================

/**
 * Get comments for a dream
 */
export async function getDreamComments(dreamId: string): Promise<DreamComment[]> {
    try {
        const { data, error } = await supabase
            .from('dream_comments')
            .select(`
                *,
                profiles!dream_comments_user_id_fkey (
                    display_name,
                    avatar_url
                )
            `)
            .eq('dream_id', dreamId)
            .is('parent_comment_id', null) // Top-level comments only
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[DreamFeed] Error fetching comments:', error);
            return [];
        }

        return (data || []).map(comment => ({
            ...comment,
            display_name: comment.profiles?.display_name || null,
            avatar_url: comment.profiles?.avatar_url || null,
        }));
    } catch (error) {
        console.error('[DreamFeed] Error fetching comments:', error);
        return [];
    }
}

/**
 * Post a comment on a dream
 */
export async function postDreamComment(
    dreamId: string,
    commentText: string,
    parentCommentId?: string
): Promise<DreamComment | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('dream_comments')
            .insert({
                dream_id: dreamId,
                user_id: user.id,
                comment_text: commentText,
                parent_comment_id: parentCommentId || null,
            })
            .select()
            .single();

        if (error) {
            console.error('[DreamFeed] Error posting comment:', error);
            return null;
        }

        // Increment comment count (best effort)
        try {
            const { data: dreamData } = await supabase.from('dreams').select('comments_count').eq('id', dreamId).single();
            await supabase.from('dreams').update({ comments_count: (dreamData?.comments_count || 0) + 1 }).eq('id', dreamId);
        } catch {
            // Skip on error
        }

        return data as DreamComment;
    } catch (error) {
        console.error('[DreamFeed] Error posting comment:', error);
        return null;
    }
}

/**
 * Delete a comment
 */
export async function deleteDreamComment(commentId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('dream_comments')
            .delete()
            .eq('id', commentId);

        return !error;
    } catch (error) {
        console.error('[DreamFeed] Error deleting comment:', error);
        return false;
    }
}

// ============================================
// Save/Bookmark Functions
// ============================================

/**
 * Toggle save/bookmark on a dream
 */
export async function toggleSaveDream(dreamId: string): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { data: existing } = await supabase
            .from('saved_dreams')
            .select('id')
            .eq('dream_id', dreamId)
            .eq('user_id', user.id)
            .single();

        if (existing) {
            await supabase
                .from('saved_dreams')
                .delete()
                .eq('dream_id', dreamId)
                .eq('user_id', user.id);
            return false;
        } else {
            await supabase
                .from('saved_dreams')
                .insert({ dream_id: dreamId, user_id: user.id });
            return true;
        }
    } catch (error) {
        console.error('[DreamFeed] Error toggling save:', error);
        return false;
    }
}

/**
 * Get user's saved dreams
 */
export async function getUserSavedDreams(): Promise<Set<string>> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return new Set();

        const { data } = await supabase
            .from('saved_dreams')
            .select('dream_id')
            .eq('user_id', user.id);

        return new Set((data || []).map(s => s.dream_id));
    } catch (error) {
        console.error('[DreamFeed] Error fetching saved dreams:', error);
        return new Set();
    }
}

// ============================================
// Privacy Functions
// ============================================

/**
 * Toggle dream visibility (public/private)
 */
export async function toggleDreamVisibility(dreamId: string): Promise<boolean> {
    try {
        const { data: dream } = await supabase
            .from('dreams')
            .select('is_public')
            .eq('id', dreamId)
            .single();

        if (!dream) return false;

        const newVisibility = !dream.is_public;

        await supabase
            .from('dreams')
            .update({ is_public: newVisibility })
            .eq('id', dreamId);

        return newVisibility;
    } catch (error) {
        console.error('[DreamFeed] Error toggling visibility:', error);
        return false;
    }
}

/**
 * Increment view count
 */
export async function incrementDreamView(dreamId: string): Promise<void> {
    try {
        await supabase.rpc('increment_dream_views', { dream_id_param: dreamId });
    } catch {
        // No RPC or error, silently skip
    }
}

// ============================================
// Helpers
// ============================================

/**
 * Format relative time
 */
export function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Get mood color
 */
export function getMoodColor(mood: string | null): string {
    const colors: Record<string, string> = {
        peaceful: '#10B981',
        chaotic: '#EF4444',
        surreal: '#8B5CF6',
        prophetic: '#F59E0B',
        nightmare: '#7C3AED',
        lucid: '#06B6D4',
        nostalgic: '#EC4899',
        adventurous: '#F97316',
    };
    return colors[mood || ''] || '#64748B';
}

/**
 * Get mood emoji
 */
export function getMoodEmoji(mood: string | null): string {
    const emojis: Record<string, string> = {
        peaceful: '🌙',
        chaotic: '🌪️',
        surreal: '🎭',
        prophetic: '👁️',
        nightmare: '😱',
        lucid: '✨',
        nostalgic: '💭',
        adventurous: '🚀',
    };
    return emojis[mood || ''] || '💫';
}
