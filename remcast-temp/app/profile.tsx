/**
 * Profile Screen - REMcast Simplified
 * User stats and settings
 */
import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Platform, Image, Alert, Switch } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../components/ui/Typography';
import { BottomNav } from '../components/ui/BottomNav';
import { Colors, Spacing } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { getUserDreams } from '../services/dreamProcessing';
import { getUserCredits, type UserCredits } from '../services/videoGeneration';

export default function Profile() {
    const router = useRouter();
    const { user, signOut } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [dreamCount, setDreamCount] = useState(0);
    const [reelCount, setReelCount] = useState(0);
    const [credits, setCredits] = useState<UserCredits | null>(null);

    useEffect(() => {
        loadProfile();
        loadStats();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [])
    );

    async function loadProfile() {
        if (!user) return;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(data);
        } catch (error) {
            console.error('[Profile] Error loading profile:', error);
        }
    }

    async function loadStats() {
        const dreams = await getUserDreams();
        setDreamCount(dreams.length);
        setReelCount(dreams.filter(d => d.reel_url).length);

        const userCredits = await getUserCredits();
        setCredits(userCredits);
    }

    function handleSignOut() {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', style: 'destructive', onPress: signOut },
            ]
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <Typography variant="h2" color={Colors.starlight}>
                        Profile
                    </Typography>
                </View>

                {/* User Info */}
                <View style={styles.userSection}>
                    <View style={styles.avatarLarge}>
                        {profile?.avatar_url ? (
                            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                        ) : (
                            <Ionicons name="person" size={40} color={Colors.fog} />
                        )}
                    </View>
                    <Typography variant="h3" color={Colors.starlight} style={styles.displayName}>
                        {profile?.display_name || user?.email?.split('@')[0] || 'Dreamer'}
                    </Typography>
                    <Typography variant="caption" color={Colors.fog}>
                        {user?.email}
                    </Typography>
                </View>

                {/* Stats */}
                <View style={styles.statsCard}>
                    <View style={styles.statItem}>
                        <Typography variant="h2" color={Colors.dreamPurple}>
                            {dreamCount}
                        </Typography>
                        <Typography variant="caption" color={Colors.mist}>
                            Dreams
                        </Typography>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Typography variant="h2" color={Colors.cosmicCyan}>
                            {reelCount}
                        </Typography>
                        <Typography variant="caption" color={Colors.mist}>
                            Reels
                        </Typography>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Typography variant="h2" color={Colors.sunrise}>
                            {credits?.video_credits ?? 3}
                        </Typography>
                        <Typography variant="caption" color={Colors.mist}>
                            Credits
                        </Typography>
                    </View>
                </View>

                {/* Settings */}
                <View style={styles.section}>
                    <Typography variant="caption" color={Colors.fog} style={styles.sectionTitle}>
                        SETTINGS
                    </Typography>

                    <TouchableOpacity style={styles.settingRow}>
                        <Ionicons name="person-outline" size={20} color={Colors.mist} />
                        <Typography variant="body" color={Colors.starlight} style={styles.settingText}>
                            Edit Profile
                        </Typography>
                        <Ionicons name="chevron-forward" size={18} color={Colors.fog} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow}>
                        <Ionicons name="notifications-outline" size={20} color={Colors.mist} />
                        <Typography variant="body" color={Colors.starlight} style={styles.settingText}>
                            Notifications
                        </Typography>
                        <Ionicons name="chevron-forward" size={18} color={Colors.fog} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow}>
                        <Ionicons name="lock-closed-outline" size={20} color={Colors.mist} />
                        <Typography variant="body" color={Colors.starlight} style={styles.settingText}>
                            Privacy
                        </Typography>
                        <Ionicons name="chevron-forward" size={18} color={Colors.fog} />
                    </TouchableOpacity>
                </View>

                {/* Support */}
                <View style={styles.section}>
                    <Typography variant="caption" color={Colors.fog} style={styles.sectionTitle}>
                        SUPPORT
                    </Typography>

                    <TouchableOpacity style={styles.settingRow}>
                        <Ionicons name="help-circle-outline" size={20} color={Colors.mist} />
                        <Typography variant="body" color={Colors.starlight} style={styles.settingText}>
                            Help & FAQ
                        </Typography>
                        <Ionicons name="chevron-forward" size={18} color={Colors.fog} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.settingRow}>
                        <Ionicons name="document-text-outline" size={20} color={Colors.mist} />
                        <Typography variant="body" color={Colors.starlight} style={styles.settingText}>
                            Terms & Privacy
                        </Typography>
                        <Ionicons name="chevron-forward" size={18} color={Colors.fog} />
                    </TouchableOpacity>
                </View>

                {/* Sign Out */}
                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Ionicons name="log-out-outline" size={20} color={Colors.nightmare} />
                    <Typography variant="body" color={Colors.nightmare} style={{ marginLeft: Spacing.sm }}>
                        Sign Out
                    </Typography>
                </TouchableOpacity>

                <View style={{ height: 120 }} />
            </ScrollView>

            <BottomNav />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.midnight,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingHorizontal: Spacing.lg,
    },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: Spacing.md,
    },
    userSection: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.nebula,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 80,
        height: 80,
    },
    displayName: {
        marginBottom: 4,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: Colors.nebula,
        borderRadius: 16,
        padding: Spacing.lg,
        marginBottom: Spacing.xl,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: Colors.cosmic,
    },
    section: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        marginBottom: Spacing.sm,
        letterSpacing: 1,
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.nebula,
        padding: Spacing.md,
        borderRadius: 12,
        marginBottom: Spacing.xs,
    },
    settingText: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.nightmare + '20',
        padding: Spacing.md,
        borderRadius: 12,
        marginTop: Spacing.md,
    },
});
