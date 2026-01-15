import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { Colors, Spacing } from '../../constants/theme';
import { useNotifications } from '../../contexts/NotificationsContext';

export function BottomNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { unreadCount } = useNotifications();
    const [showBibleModal, setShowBibleModal] = useState(false);

    const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/');
    const isBibleActive = isActive('/bible') || isActive('/setup') || isActive('/journey') || isActive('/daily');

    const handleBiblePress = () => {
        // Always show modal to let user choose
        setShowBibleModal(true);
    };

    return (
        <>
            {/* Bible/Plan Choice Modal */}
            <Modal
                visible={showBibleModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowBibleModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowBibleModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
                        <View style={styles.modalContent}>
                            <Typography variant="h3" style={{ textAlign: 'center', marginBottom: 20 }}>
                                Open Bible
                            </Typography>

                            <TouchableOpacity
                                style={styles.choiceButton}
                                onPress={() => {
                                    setShowBibleModal(false);
                                    // Only navigate if not already on bible page
                                    if (!isActive('/bible')) {
                                        router.push('/bible');
                                    }
                                }}
                            >
                                <Ionicons name="book" size={28} color={Colors.gold} />
                                <View style={{ flex: 1 }}>
                                    <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                                        Free Read
                                    </Typography>
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        Browse any book or chapter
                                    </Typography>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.choiceButton}
                                onPress={() => {
                                    setShowBibleModal(false);
                                    // Only navigate if not already on setup/daily/journey page
                                    if (!isActive('/setup') && !isActive('/daily') && !isActive('/journey')) {
                                        router.push('/setup');
                                    }
                                }}
                            >
                                <Ionicons name="calendar" size={28} color={Colors.gold} />
                                <View style={{ flex: 1 }}>
                                    <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                                        My Reading Plan
                                    </Typography>
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        Continue your guided journey
                                    </Typography>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{ marginTop: 16, alignSelf: 'center' }}
                                onPress={() => setShowBibleModal(false)}
                            >
                                <Typography variant="body" color={Colors.mediumGray}>Cancel</Typography>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            <View style={styles.container}>
                {/* Home */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.replace('/home')}
                >
                    <Ionicons
                        name={isActive('/home') ? 'home' : 'home-outline'}
                        size={24}
                        color={isActive('/home') ? Colors.gold : Colors.mediumGray}
                    />
                    <Typography
                        variant="caption"
                        color={isActive('/home') ? Colors.gold : Colors.mediumGray}
                        style={isActive('/home') ? styles.activeText : undefined}
                    >
                        Home
                    </Typography>
                </TouchableOpacity>

                {/* Bible */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={handleBiblePress}
                >
                    <Ionicons
                        name={isBibleActive ? 'book' : 'book-outline'}
                        size={24}
                        color={isBibleActive ? Colors.gold : Colors.mediumGray}
                    />
                    <Typography
                        variant="caption"
                        color={isBibleActive ? Colors.gold : Colors.mediumGray}
                        style={isBibleActive ? styles.activeText : undefined}
                    >
                        Bible
                    </Typography>
                </TouchableOpacity>

                {/* Journal */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.replace('/journal')}
                >
                    <Ionicons
                        name={isActive('/journal') ? 'create' : 'create-outline'}
                        size={24}
                        color={isActive('/journal') ? Colors.gold : Colors.mediumGray}
                    />
                    <Typography
                        variant="caption"
                        color={isActive('/journal') ? Colors.gold : Colors.mediumGray}
                        style={isActive('/journal') ? styles.activeText : undefined}
                    >
                        Journal
                    </Typography>
                </TouchableOpacity>

                {/* Alerts/Notifications */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.replace('/notifications')}
                >
                    <View style={{ position: 'relative' }}>
                        <Ionicons
                            name={isActive('/notifications') ? 'notifications' : 'notifications-outline'}
                            size={24}
                            color={isActive('/notifications') ? Colors.gold : Colors.mediumGray}
                        />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Typography variant="caption" color={Colors.white} style={{ fontSize: 10, fontWeight: '700' }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Typography>
                            </View>
                        )}
                    </View>
                    <Typography
                        variant="caption"
                        color={isActive('/notifications') ? Colors.gold : Colors.mediumGray}
                        style={isActive('/notifications') ? styles.activeText : undefined}
                    >
                        Alerts
                    </Typography>
                </TouchableOpacity>

                {/* Learn */}
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => router.replace('/edification')}
                >
                    <Ionicons
                        name={isActive('/edification') || isActive('/insights') ? 'school' : 'school-outline'}
                        size={24}
                        color={isActive('/edification') || isActive('/insights') ? Colors.gold : Colors.mediumGray}
                    />
                    <Typography
                        variant="caption"
                        color={isActive('/edification') || isActive('/insights') ? Colors.gold : Colors.mediumGray}
                        style={isActive('/edification') || isActive('/insights') ? styles.activeText : undefined}
                    >
                        Learn
                    </Typography>
                </TouchableOpacity>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: Colors.white,
        borderTopWidth: 1,
        borderTopColor: '#E5E5E5',
        flexDirection: 'row',
        paddingTop: 12,
        paddingBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 10,
    },
    navItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    activeText: {
        fontWeight: '600',
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -10,
        backgroundColor: '#D32F2F',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: Colors.cream,
        borderRadius: 20,
        padding: 24,
        width: 300,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
    },
    choiceButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
});


