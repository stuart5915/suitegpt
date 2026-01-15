import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import {
    getNotifications,
    markAsRead,
    markAllAsRead,
    type Notification
} from '../services/notificationsService';
import { useNotifications } from '../contexts/NotificationsContext';

export default function NotificationsScreen() {
    const router = useRouter();
    const { refreshUnreadCount } = useNotifications();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadNotifications = useCallback(async () => {
        const data = await getNotifications();
        setNotifications(data);
        setLoading(false);
    }, []);

    useEffect(() => {
        loadNotifications();
    }, [loadNotifications]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadNotifications();
        await refreshUnreadCount();
        setRefreshing(false);
    };

    const handleMarkAllRead = async () => {
        await markAllAsRead();
        await loadNotifications();
        await refreshUnreadCount();
    };

    const handleNotificationPress = async (notification: Notification) => {
        // Mark as read
        if (!notification.read) {
            await markAsRead(notification.id);
            await refreshUnreadCount();
        }

        // Navigate to the target (reflection)
        if (notification.target_id) {
            router.push(`/reflection/${notification.target_id}`);
        }
    };

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'like': return '❤️';
            case 'reply': return '💬';
            case 'follow': return '👤';
            default: return '🔔';
        }
    };

    const getNotificationText = (notification: Notification) => {
        const actor = notification.actor_username || 'Someone';
        switch (notification.type) {
            case 'like':
                return `${actor} liked your reflection`;
            case 'reply':
                return `${actor} replied to your reflection`;
            case 'follow':
                return `${actor} started following you`;
            default:
                return 'New notification';
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.gold} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Typography variant="h2">🔔 Notifications</Typography>
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Typography variant="caption" color={Colors.white} style={{ fontWeight: '600' }}>
                                    {unreadCount}
                                </Typography>
                            </View>
                        )}
                    </View>
                    {unreadCount > 0 && (
                        <TouchableOpacity onPress={handleMarkAllRead}>
                            <Typography variant="body" color={Colors.gold}>Mark All Read</Typography>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Notifications List */}
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={Colors.gold} />
                    </View>
                ) : notifications.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Typography variant="h3" style={{ marginBottom: 8 }}>🔕</Typography>
                        <Typography variant="body" color={Colors.mediumGray} style={{ textAlign: 'center' }}>
                            No notifications yet
                        </Typography>
                        <Typography variant="caption" color={Colors.mediumGray} style={{ textAlign: 'center', marginTop: 4 }}>
                            When someone likes or replies to your reflections, you'll see it here
                        </Typography>
                    </View>
                ) : (
                    <View style={styles.list}>
                        {notifications.map((notification) => (
                            <TouchableOpacity
                                key={notification.id}
                                style={[
                                    styles.notificationCard,
                                    !notification.read && styles.unreadCard
                                ]}
                                onPress={() => handleNotificationPress(notification)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.notificationIcon}>
                                    <Typography variant="body" style={{ fontSize: 24 }}>
                                        {getNotificationIcon(notification.type)}
                                    </Typography>
                                </View>
                                <View style={styles.notificationContent}>
                                    <Typography variant="body" color={Colors.charcoal}>
                                        {getNotificationText(notification)}
                                    </Typography>
                                    {notification.target_preview && (
                                        <Typography
                                            variant="caption"
                                            color={Colors.mediumGray}
                                            numberOfLines={2}
                                            style={{ marginTop: 4 }}
                                        >
                                            "{notification.target_preview}"
                                        </Typography>
                                    )}
                                    <Typography variant="caption" color={Colors.mediumGray} style={{ marginTop: 4 }}>
                                        {formatTime(notification.created_at)}
                                    </Typography>
                                </View>
                                {!notification.read && (
                                    <View style={styles.unreadDot} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </ScrollView>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingTop: 60,
        paddingBottom: 100,
        paddingHorizontal: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    badge: {
        backgroundColor: Colors.gold,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 100,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: 80,
        paddingHorizontal: Spacing.xl,
    },
    list: {
        gap: 12,
    },
    notificationCard: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    unreadCard: {
        backgroundColor: 'rgba(166, 123, 91, 0.08)',
        borderLeftWidth: 3,
        borderLeftColor: Colors.gold,
    },
    notificationIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.03)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    notificationContent: {
        flex: 1,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.gold,
        marginLeft: 8,
        alignSelf: 'center',
    },
});
