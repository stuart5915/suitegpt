import { supabase } from './supabase';

export interface Notification {
    id: string;
    user_id: string;
    type: 'like' | 'reply' | 'follow';
    actor_id: string | null;
    actor_username: string | null;
    target_id: string | null;
    target_preview: string | null;
    read: boolean;
    created_at: string;
}

/**
 * Get notifications for the current user
 */
export async function getNotifications(limit = 50): Promise<Notification[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) {
        console.error('Error fetching notifications:', error);
        return [];
    }

    return data || [];
}

/**
 * Get count of unread notifications
 */
export async function getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

    if (error) {
        console.error('Error fetching unread count:', error);
        return 0;
    }

    return count || 0;
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

    if (error) {
        console.error('Error marking notification as read:', error);
    }
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

    if (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

/**
 * Create a notification for a user
 * Called when someone likes or replies to their content
 */
export async function createNotification(
    userId: string,
    type: 'like' | 'reply' | 'follow',
    actorId: string,
    actorUsername: string,
    targetId?: string,
    targetPreview?: string
): Promise<void> {
    // Don't notify yourself
    if (userId === actorId) return;

    const { error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            type,
            actor_id: actorId,
            actor_username: actorUsername,
            target_id: targetId,
            target_preview: targetPreview?.slice(0, 100), // Limit preview length
        });

    if (error) {
        console.error('Error creating notification:', error);
    }
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

    if (error) {
        console.error('Error deleting notification:', error);
    }
}
