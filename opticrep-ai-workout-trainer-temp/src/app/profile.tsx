import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
    const router = useRouter();
    const { user, signOut } = useAuth();

    // Settings state (will be persisted later)
    const [darkMode, setDarkMode] = useState(true);
    const [notifications, setNotifications] = useState(true);
    const [audioCues, setAudioCues] = useState(true);
    const [hapticFeedback, setHapticFeedback] = useState(true);

    const handleSignOut = async () => {
        await signOut();
        router.replace('/auth');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <Pressable onPress={() => router.back()} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </Pressable>
                    <Text style={styles.title}>Profile</Text>
                </View>

                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarInitial}>
                            {user?.email?.charAt(0).toUpperCase() || '?'}
                        </Text>
                    </View>
                    <Text style={styles.email}>{user?.email || 'Not logged in'}</Text>
                    <Text style={styles.memberSince}>
                        Member since {new Date(user?.created_at || Date.now()).toLocaleDateString()}
                    </Text>
                </View>

                {/* Appearance Section */}
                <Text style={styles.sectionTitle}>Appearance</Text>
                <View style={styles.settingsCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingEmoji}>🌙</Text>
                            <View>
                                <Text style={styles.settingLabel}>Dark Mode</Text>
                                <Text style={styles.settingDesc}>Use dark theme</Text>
                            </View>
                        </View>
                        <Switch
                            value={darkMode}
                            onValueChange={setDarkMode}
                            trackColor={{ false: '#27272a', true: '#22c55e' }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </View>

                {/* Workout Settings */}
                <Text style={styles.sectionTitle}>Workout Settings</Text>
                <View style={styles.settingsCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingEmoji}>🔊</Text>
                            <View>
                                <Text style={styles.settingLabel}>Audio Cues</Text>
                                <Text style={styles.settingDesc}>Voice feedback during workout</Text>
                            </View>
                        </View>
                        <Switch
                            value={audioCues}
                            onValueChange={setAudioCues}
                            trackColor={{ false: '#27272a', true: '#22c55e' }}
                            thumbColor="#ffffff"
                        />
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingEmoji}>📳</Text>
                            <View>
                                <Text style={styles.settingLabel}>Haptic Feedback</Text>
                                <Text style={styles.settingDesc}>Vibration on rep completion</Text>
                            </View>
                        </View>
                        <Switch
                            value={hapticFeedback}
                            onValueChange={setHapticFeedback}
                            trackColor={{ false: '#27272a', true: '#22c55e' }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </View>

                {/* Notifications */}
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.settingsCard}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingEmoji}>🔔</Text>
                            <View>
                                <Text style={styles.settingLabel}>Push Notifications</Text>
                                <Text style={styles.settingDesc}>Workout reminders & updates</Text>
                            </View>
                        </View>
                        <Switch
                            value={notifications}
                            onValueChange={setNotifications}
                            trackColor={{ false: '#27272a', true: '#22c55e' }}
                            thumbColor="#ffffff"
                        />
                    </View>
                </View>

                {/* Account Actions */}
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.settingsCard}>
                    <Pressable style={styles.actionRow}>
                        <Text style={styles.settingEmoji}>📊</Text>
                        <Text style={styles.actionLabel}>Export My Data</Text>
                        <Text style={styles.actionArrow}>→</Text>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable style={styles.actionRow}>
                        <Text style={styles.settingEmoji}>🔒</Text>
                        <Text style={styles.actionLabel}>Privacy Settings</Text>
                        <Text style={styles.actionArrow}>→</Text>
                    </Pressable>

                    <View style={styles.divider} />

                    <Pressable style={styles.actionRow}>
                        <Text style={styles.settingEmoji}>❓</Text>
                        <Text style={styles.actionLabel}>Help & Support</Text>
                        <Text style={styles.actionArrow}>→</Text>
                    </Pressable>
                </View>

                {/* Sign Out */}
                <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                </Pressable>

                {/* App Version */}
                <Text style={styles.version}>OpticRep v1.0.0</Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 48,
    },
    header: {
        paddingTop: 16,
        paddingBottom: 24,
    },
    backButton: {
        marginBottom: 16,
    },
    backButtonText: {
        color: '#8b5cf6',
        fontSize: 16,
        fontWeight: '500',
    },
    title: {
        color: '#ffffff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    profileCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#8b5cf6',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    avatarInitial: {
        color: '#ffffff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    email: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '500',
    },
    memberSince: {
        color: '#71717a',
        fontSize: 12,
        marginTop: 4,
    },
    sectionTitle: {
        color: '#a1a1aa',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        marginBottom: 12,
        marginTop: 8,
    },
    settingsCard: {
        backgroundColor: '#18181b',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#27272a',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    settingInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    settingEmoji: {
        fontSize: 24,
    },
    settingLabel: {
        color: '#ffffff',
        fontSize: 16,
    },
    settingDesc: {
        color: '#71717a',
        fontSize: 12,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: '#27272a',
        marginHorizontal: 16,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    actionLabel: {
        color: '#ffffff',
        fontSize: 16,
        flex: 1,
        marginLeft: 12,
    },
    actionArrow: {
        color: '#71717a',
        fontSize: 16,
    },
    signOutButton: {
        backgroundColor: '#ef4444',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 24,
    },
    signOutText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '600',
    },
    version: {
        color: '#52525b',
        textAlign: 'center',
        marginTop: 24,
        fontSize: 12,
    },
});
