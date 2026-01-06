import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    ScrollView,
    TouchableOpacity,
    Switch,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

export function SettingsScreen() {
    const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Profile Section */}
                <View style={styles.profileCard}>
                    <View style={styles.avatar}>
                        <Ionicons name="person" size={32} color={COLORS.textPrimary} />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.profileName}>Demo User</Text>
                        <Text style={styles.profileEmail}>demo@lifehub.app</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                </View>

                {/* Connected Apps */}
                <Text style={styles.sectionTitle}>Connected Apps</Text>
                <View style={styles.section}>
                    {[
                        { name: 'TrueForm AI', icon: 'fitness', connected: true },
                        { name: 'OpticRep', icon: 'barbell', connected: true },
                        { name: 'FoodVital', icon: 'nutrition', connected: true },
                        { name: 'Cheshbon', icon: 'book', connected: true },
                        { name: 'REMcast', icon: 'moon', connected: false },
                        { name: 'Deals', icon: 'pricetag', connected: true },
                    ].map((app, index) => (
                        <TouchableOpacity key={app.name} style={styles.settingRow}>
                            <View style={styles.settingLeft}>
                                <View style={[styles.appIcon, app.connected && styles.appIconConnected]}>
                                    <Ionicons name={app.icon as any} size={18} color={app.connected ? COLORS.cyan : COLORS.textMuted} />
                                </View>
                                <Text style={styles.settingLabel}>{app.name}</Text>
                            </View>
                            <View style={[styles.badge, app.connected ? styles.badgeConnected : styles.badgeDisconnected]}>
                                <Text style={[styles.badgeText, app.connected && styles.badgeTextConnected]}>
                                    {app.connected ? 'Connected' : 'Connect'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Preferences */}
                <Text style={styles.sectionTitle}>Preferences</Text>
                <View style={styles.section}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="notifications" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.settingLabel}>Notifications</Text>
                        </View>
                        <Switch
                            value={notificationsEnabled}
                            onValueChange={setNotificationsEnabled}
                            trackColor={{ false: COLORS.surfaceLight, true: COLORS.cyan + '50' }}
                            thumbColor={notificationsEnabled ? COLORS.cyan : COLORS.textMuted}
                        />
                    </View>

                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="color-palette" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.settingLabel}>Theme</Text>
                        </View>
                        <View style={styles.settingRight}>
                            <Text style={styles.settingValue}>Dark</Text>
                            <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* About */}
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.section}>
                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="information-circle" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.settingLabel}>Version</Text>
                        </View>
                        <Text style={styles.settingValue}>1.0.0</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow}>
                        <View style={styles.settingLeft}>
                            <Ionicons name="document-text" size={20} color={COLORS.textSecondary} />
                            <Text style={styles.settingLabel}>Privacy Policy</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
                    </TouchableOpacity>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Life Hub - Part of Stuart's App Suite</Text>
                    <Text style={styles.footerSubtext}>Powered by $SUITE</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.surface,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.textPrimary,
    },
    content: {
        flex: 1,
        padding: SPACING.md,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.lg,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.purple + '30',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileInfo: {
        flex: 1,
        marginLeft: SPACING.md,
    },
    profileName: {
        fontSize: 18,
        fontWeight: '600',
        color: COLORS.textPrimary,
    },
    profileEmail: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: SPACING.sm,
        marginTop: SPACING.sm,
    },
    section: {
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.md,
        marginBottom: SPACING.md,
        overflow: 'hidden',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.background,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
    },
    settingRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    settingLabel: {
        fontSize: 16,
        color: COLORS.textPrimary,
    },
    settingValue: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    appIcon: {
        width: 32,
        height: 32,
        borderRadius: BORDER_RADIUS.sm,
        backgroundColor: COLORS.surfaceLight,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appIconConnected: {
        backgroundColor: COLORS.cyan + '20',
    },
    badge: {
        paddingHorizontal: SPACING.sm + 4,
        paddingVertical: SPACING.xs,
        borderRadius: BORDER_RADIUS.full,
    },
    badgeConnected: {
        backgroundColor: COLORS.cyan + '20',
    },
    badgeDisconnected: {
        backgroundColor: COLORS.surfaceLight,
    },
    badgeText: {
        fontSize: 12,
        color: COLORS.textMuted,
    },
    badgeTextConnected: {
        color: COLORS.cyan,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: SPACING.xl,
    },
    footerText: {
        fontSize: 14,
        color: COLORS.textMuted,
    },
    footerSubtext: {
        fontSize: 12,
        color: COLORS.purple,
        marginTop: 4,
    },
});
