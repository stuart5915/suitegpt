import { supabase } from './supabase';
import { sanitizeReflection, sanitizeDisplayName } from './contentSanitizer';
import { getUsername } from './database';
import { createNotification } from './notificationsService';

export interface PublicReflection {
    id: string;
    user_id: string;
    verse_reference: string;
    verse_text: string;
    reflection: string;
    display_name: string | null;
    username: string | null; // @handle
    avatar_url: string | null;
    likes_count: number;
    created_at: string;
    is_liked?: boolean; // Populated client-side
    repost_count: number;
    views_count: number;
    reply_count: number;
    is_reposted?: boolean; // Populated client-side
    quoted_reflection_id?: string | null; // For quote reflections
    quoted_reflection?: PublicReflection | null; // Joined quoted reflection data
    parent_reflection_id?: string | null; // For replies (unified model)
    parent_display_name?: string | null; // Display name of parent author
}

export interface ReflectionReply {
    id: string;
    reflection_id: string;
    user_id: string;
    reply_text: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    parent_reply_id?: string;
    like_count?: number;
    is_liked?: boolean; // Populated client-side
}

// Fetch public feed (paginated) with optional reply filter
export async function getPublicFeed(limit: number = 20, offset: number = 0, includeReplies: boolean = true): Promise<PublicReflection[]> {
    let query = supabase
        .from('public_reflections')
        .select('*')
        .order('created_at', { ascending: false });

    // Filter out replies if not wanted
    if (!includeReplies) {
        query = query.is('parent_reflection_id', null);
    }

    const { data, error } = await query.range(offset, offset + limit - 1);

    if (error) {
        console.error('Error fetching public feed:', error);
        return [];
    }

    return data || [];
}

// Get reflections the current user has reposted
export async function getUserRepostedReflections(): Promise<Set<string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
        .from('reflection_reposts')
        .select('reflection_id')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error fetching user reposts:', error);
        return new Set();
    }
    return new Set(data?.map(r => r.reflection_id) || []);
}


// Get reflections the current user has liked
export async function getUserLikedReflections(): Promise<Set<string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    // ... existing implementation ...
    const { data, error } = await supabase
        .from('reflection_likes')
        .select('reflection_id')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error fetching user likes:', error);
        return new Set();
    }
    return new Set(data?.map(like => like.reflection_id) || []);
}

// Get full reflection objects for posts the user has liked (for Likes tab)
export async function getLikedReflectionsFull(): Promise<PublicReflection[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // First get the liked reflection IDs
    const { data: likeData, error: likeError } = await supabase
        .from('reflection_likes')
        .select('reflection_id')
        .eq('user_id', user.id);

    if (likeError || !likeData || likeData.length === 0) {
        return [];
    }

    const likedIds = likeData.map(l => l.reflection_id);

    // Now fetch the full reflection objects
    const { data, error } = await supabase
        .from('public_reflections')
        .select(`
            *,
            quoted_reflection:quoted_reflection_id (
                id,
                display_name,
                avatar_url,
                reflection,
                verse_reference,
                created_at
            )
        `)
        .in('id', likedIds)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching liked reflections:', error);
        return [];
    }

    return data || [];
}

// Publish a public reflection
export async function publishReflection(
    verseReference: string,
    verseText: string,
    reflection: string
): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Check if user has set a username
    const username = await getUsername();
    if (!username) {
        throw new Error('USERNAME_REQUIRED');
    }

    // Get user's display name from metadata
    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    const { data, error } = await supabase
        .from('public_reflections')
        .insert({
            user_id: user.id,
            verse_reference: verseReference,
            verse_text: verseText,
            reflection: sanitizeReflection(reflection),
            display_name: sanitizeDisplayName(displayName),
            username: username,
            avatar_url: avatarUrl,
        })
        .select()
        .single();

    if (error) {
        console.error('Error publishing reflection:', error);
        throw error;
    }

    return data?.id || null;
}

// Create a quote reflection (reflect on someone else's reflection)
export async function createQuoteReflection(
    quotedReflectionId: string,
    reflectionText: string,
    quotedReflection: PublicReflection
): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Check if user has set a username
    const username = await getUsername();
    if (!username) {
        throw new Error('USERNAME_REQUIRED');
    }

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    // Use the quoted reflection's verse reference as context
    const verseReference = quotedReflection.verse_reference;
    const verseText = quotedReflection.verse_text;

    const { data, error } = await supabase
        .from('public_reflections')
        .insert({
            user_id: user.id,
            verse_reference: verseReference,
            verse_text: verseText,
            reflection: sanitizeReflection(reflectionText),
            display_name: sanitizeDisplayName(displayName),
            username: username,
            avatar_url: avatarUrl,
            quoted_reflection_id: quotedReflectionId,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating quote reflection:', error);
        throw error;
    }

    return data?.id || null;
}

// Toggle like on a reflection
export async function toggleLike(reflectionId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Check if already liked
    const { data: existingLike } = await supabase
        .from('reflection_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('reflection_id', reflectionId)
        .single();

    if (existingLike) {
        // Unlike
        const { error } = await supabase
            .from('reflection_likes')
            .delete()
            .eq('user_id', user.id)
            .eq('reflection_id', reflectionId);

        if (error) {
            console.error('Error unliking:', error);
            throw error;
        }
        return false; // Now unliked
    } else {
        // Like
        const { error } = await supabase
            .from('reflection_likes')
            .insert({
                user_id: user.id,
                reflection_id: reflectionId,
            });

        if (error) {
            console.error('Error liking:', error);
            throw error;
        }

        // Create notification for the reflection author
        try {
            const { data: reflection } = await supabase
                .from('public_reflections')
                .select('user_id, reflection')
                .eq('id', reflectionId)
                .single();

            if (reflection && reflection.user_id !== user.id) {
                const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone';
                await createNotification(
                    reflection.user_id,
                    'like',
                    user.id,
                    username,
                    reflectionId,
                    reflection.reflection
                );
            }
        } catch (e) {
            console.log('Notification creation failed (non-critical):', e);
        }

        return true; // Now liked
    }
}

// Toggle repost on a reflection
export async function toggleRepost(reflectionId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    // Check if already reposted
    const { data: existingRepost } = await supabase
        .from('reflection_reposts')
        .select('id')
        .eq('user_id', user.id)
        .eq('reflection_id', reflectionId)
        .single();

    if (existingRepost) {
        // Unrepost
        const { error } = await supabase.rpc('decrement_repost_count', { row_id: reflectionId });
        if (error) console.error('Error decrementing repost count:', error);

        const { error: deleteError } = await supabase
            .from('reflection_reposts')
            .delete()
            .eq('user_id', user.id)
            .eq('reflection_id', reflectionId);

        if (deleteError) throw deleteError;
        return false;
    } else {
        // Repost
        const { error } = await supabase.rpc('increment_repost_count', { row_id: reflectionId });
        if (error) console.error('Error incrementing repost count:', error);

        const { error: insertError } = await supabase
            .from('reflection_reposts')
            .insert({
                user_id: user.id,
                reflection_id: reflectionId,
            });

        if (insertError) throw insertError;
        return true;
    }
}

// Increment view count
export async function incrementView(reflectionId: string): Promise<void> {
    const { error } = await supabase.rpc('increment_view_count', { row_id: reflectionId });
    if (error) console.error('Error incrementing view count:', error);
}

// Delete a public reflection (by owner)
export async function deletePublicReflection(reflectionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('User not authenticated');
    }

    const { error } = await supabase
        .from('public_reflections')
        .delete()
        .eq('id', reflectionId)
        .eq('user_id', user.id);

    if (error) {
        console.error('Error deleting reflection:', error);
        throw error;
    }
}


// Get details for a single reflection
export async function getReflectionDetails(id: string): Promise<PublicReflection | null> {
    const { data, error } = await supabase
        .from('public_reflections')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching reflection details:', error);
        return null;
    }
    return data;
}

// Extended reply with parent reflection info for profile display
export interface UserReplyWithContext {
    id: string;
    user_id: string;
    reflection: string; // The reply text (stored in 'reflection' field)
    reply_text: string; // Alias for display compatibility
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    verse_reference: string;
    parent_reflection_id: string | null;
    parent_display_name: string | null;
    parent_reflection?: {
        id: string;
        verse_reference: string;
        reflection: string;
        display_name: string | null;
    };
}

// Get all replies made by the current user (queries public_reflections with parent_reflection_id)
export async function getUserReplies(): Promise<UserReplyWithContext[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // Query public_reflections where this user has made replies (has parent_reflection_id)
    const { data, error } = await supabase
        .from('public_reflections')
        .select('*')
        .eq('user_id', user.id)
        .not('parent_reflection_id', 'is', null) // Only get replies (not top-level reflections)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching user replies:', error);
        return [];
    }

    if (!data || data.length === 0) return [];

    // Fetch parent reflections for context
    const parentIds = [...new Set(data.map(r => r.parent_reflection_id).filter(Boolean))];
    const { data: parentData } = await supabase
        .from('public_reflections')
        .select('id, verse_reference, reflection, display_name')
        .in('id', parentIds);

    const parentMap = new Map(parentData?.map(p => [p.id, p]) || []);

    // Map to expected format with parent context
    return data.map(reply => ({
        ...reply,
        reply_text: reply.reflection, // Alias for display
        parent_reflection: parentMap.get(reply.parent_reflection_id) || undefined
    }));
}

// Find a public reflection ID by matching verse reference and reflection text
export async function findPublicReflectionId(verseReference: string, reflectionText: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('public_reflections')
        .select('id')
        .eq('user_id', user.id)
        .eq('verse_reference', verseReference)
        .eq('reflection', reflectionText)
        .limit(1)
        .single();

    if (error || !data) {
        return null;
    }
    return data.id;
}

// Get all public reflections for the current user (for batch visibility checking)
export async function getUserPublicReflections(): Promise<Map<string, string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Map();

    const { data, error } = await supabase
        .from('public_reflections')
        .select('id, verse_reference, reflection')
        .eq('user_id', user.id)
        .is('parent_reflection_id', null); // Exclude replies

    if (error || !data) {
        return new Map();
    }

    // Create a map with key = "verse_reference|reflection" and value = public reflection ID
    const publicMap = new Map<string, string>();
    for (const item of data) {
        const key = `${item.verse_reference}|${item.reflection}`;
        publicMap.set(key, item.id);
    }
    return publicMap;
}

// Get replies for a reflection (now queries public_reflections with parent_reflection_id)
export async function getReplies(reflectionId: string): Promise<PublicReflection[]> {
    const { data, error } = await supabase
        .from('public_reflections')
        .select('*')
        .eq('parent_reflection_id', reflectionId)
        .order('created_at', { ascending: true }); // Chronological order

    if (error) {
        console.error('Error fetching replies:', error);
        return [];
    }
    return data || [];
}

// Post a reply (creates a public_reflection with parent_reflection_id)
export async function postReply(reflectionId: string, replyText: string, parentDisplayName?: string): Promise<PublicReflection | null> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('User not authenticated');

    // Check if user has set a username
    const username = await getUsername();
    if (!username) {
        throw new Error('USERNAME_REQUIRED');
    }

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    // Get parent reflection to get verse context
    const { data: parentReflection } = await supabase
        .from('public_reflections')
        .select('verse_reference, verse_text, display_name')
        .eq('id', reflectionId)
        .single();

    const { data, error } = await supabase
        .from('public_reflections')
        .insert({
            user_id: user.id,
            verse_reference: parentReflection?.verse_reference || 'Reply',
            verse_text: parentReflection?.verse_text || '',
            reflection: sanitizeReflection(replyText),
            display_name: sanitizeDisplayName(displayName),
            username: username,
            avatar_url: avatarUrl,
            parent_reflection_id: reflectionId,
            parent_display_name: parentDisplayName || parentReflection?.display_name || 'Someone'
        })
        .select()
        .single();

    if (error) {
        console.error('Error posting reply:', error);
        throw error;
    }

    // Create notification for the parent reflection author
    try {
        const { data: parentPost } = await supabase
            .from('public_reflections')
            .select('user_id, reflection')
            .eq('id', reflectionId)
            .single();

        if (parentPost && parentPost.user_id !== user.id) {
            const username = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone';
            await createNotification(
                parentPost.user_id,
                'reply',
                user.id,
                username,
                reflectionId,
                replyText
            );
        }
    } catch (e) {
        console.log('Notification creation failed (non-critical):', e);
    }

    // Also save to user's personal journal (verse_reflections)
    const today = new Date().toISOString().split('T')[0];
    await supabase
        .from('verse_reflections')
        .insert({
            user_id: user.id,
            date: today,
            verse_reference: parentReflection?.verse_reference || 'Community Reply',
            verse_text: parentReflection?.verse_text || '',
            reflection: sanitizeReflection(replyText),
        });

    return data;
}

// Toggle like on a reply
export async function toggleReplyLike(replyId: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if already liked
    const { data: existing } = await supabase
        .from('reply_likes')
        .select('id')
        .eq('reply_id', replyId)
        .eq('user_id', user.id)
        .single();

    if (existing) {
        // Unlike
        await supabase
            .from('reply_likes')
            .delete()
            .eq('reply_id', replyId)
            .eq('user_id', user.id);
        return false;
    } else {
        // Like
        await supabase
            .from('reply_likes')
            .insert({ reply_id: replyId, user_id: user.id });
        return true;
    }
}

// Get user's liked reply IDs
export async function getUserLikedReplies(): Promise<Set<string>> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Set();

    const { data, error } = await supabase
        .from('reply_likes')
        .select('reply_id')
        .eq('user_id', user.id);

    if (error) {
        console.error('Error fetching user reply likes:', error);
        return new Set();
    }
    return new Set(data?.map(like => like.reply_id) || []);
}

// Post a reply to a reply (nested reply - creates public_reflection with parent = the reply)
export async function postReplyToReply(reflectionId: string, parentReplyId: string, replyText: string): Promise<PublicReflection | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if user has set a username
    const username = await getUsername();
    if (!username) {
        throw new Error('USERNAME_REQUIRED');
    }

    const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Anonymous';
    const avatarUrl = user.user_metadata?.avatar_url || null;

    // Get parent reply to get verse context and display name
    const { data: parentReply } = await supabase
        .from('public_reflections')
        .select('verse_reference, verse_text, display_name')
        .eq('id', parentReplyId)
        .single();

    const { data, error } = await supabase
        .from('public_reflections')
        .insert({
            user_id: user.id,
            verse_reference: parentReply?.verse_reference || 'Reply',
            verse_text: parentReply?.verse_text || '',
            reflection: sanitizeReflection(replyText),
            display_name: sanitizeDisplayName(displayName),
            username: username,
            avatar_url: avatarUrl,
            parent_reflection_id: parentReplyId, // Parent is the reply, not original reflection
            parent_display_name: parentReply?.display_name || 'Someone'
        })
        .select()
        .single();

    if (error) {
        console.error('Error posting nested reply:', error);
        throw error;
    }

    // Also save to user's personal journal (verse_reflections)
    const today = new Date().toISOString().split('T')[0];
    await supabase
        .from('verse_reflections')
        .insert({
            user_id: user.id,
            date: today,
            verse_reference: parentReply?.verse_reference || 'Community Reply',
            verse_text: parentReply?.verse_text || '',
            reflection: sanitizeReflection(replyText),
        });

    return data;
}

// Format relative time (e.g., "2h ago", "3d ago")
export function formatRelativeTime(dateString: string): string {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHrs < 24) return `${diffHrs}h`;
    if (diffDays < 7) return `${diffDays}d`;

    // For older posts, show date
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface UserProfile {
    id: string;
    display_name: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    avatar_url: string | null;
    banner_url: string | null;
    created_at: string;
}

// Get public profile
export async function getPublicProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Error fetching public profile:', error);
        return null;
    }
    return data;
}

// Upsert profile (keep public table in sync with auth metadata)
export async function upsertProfile(profile: Partial<UserProfile>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('user_profiles')
        .upsert({
            user_id: user.id,
            ...profile,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

    if (error) {
        console.error('Error upserting profile:', error);
        throw error;
    }
}
