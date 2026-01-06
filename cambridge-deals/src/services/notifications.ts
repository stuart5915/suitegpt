// Push notification handling for deal alerts

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Deal } from '../types';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        return false;
    }

    // Android requires a notification channel
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('deals', {
            name: 'Deal Alerts',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF6B35',
        });
    }

    return true;
}

// Schedule daily deal notification
export async function scheduleDailyNotification(hour: number, minute: number): Promise<string | null> {
    try {
        // Cancel existing daily notifications
        await cancelAllScheduledNotifications();

        const identifier = await Notifications.scheduleNotificationAsync({
            content: {
                title: '🔔 Daily Deal Check',
                body: 'Check out new deals in Cambridge today!',
                data: { type: 'daily_reminder' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute,
            },
        });

        return identifier;
    } catch (error) {
        console.error('Error scheduling notification:', error);
        return null;
    }
}

// Send immediate notification for a new deal match
export async function sendDealNotification(deal: Deal): Promise<void> {
    await Notifications.scheduleNotificationAsync({
        content: {
            title: `🎉 Deal Found: ${deal.title}`,
            body: deal.price ? `$${deal.price} - ${deal.description}` : deal.description,
            data: { type: 'deal_match', dealId: deal.id },
        },
        trigger: null, // Immediate notification
    });
}

// Cancel all scheduled notifications
export async function cancelAllScheduledNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get all scheduled notifications
export async function getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
}

// Listen for notification responses (tap handling)
export function addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
) {
    return Notifications.addNotificationResponseReceivedListener(callback);
}

// Listen for notifications received while app is in foreground
export function addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
) {
    return Notifications.addNotificationReceivedListener(callback);
}
