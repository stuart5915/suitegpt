import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

// Mock consultants data
const consultants = [
    {
        id: '1',
        name: 'Sarah Chen',
        title: 'DeFi Strategist',
        rating: 4.9,
        sessions: 124,
        price: '$50',
        duration: '30 min',
        avatar: '👩‍💼',
        expertise: ['Yield Farming', 'Staking', 'Portfolio'],
    },
    {
        id: '2',
        name: 'Mike Rodriguez',
        title: 'Blockchain Developer',
        rating: 4.8,
        sessions: 89,
        price: '$75',
        duration: '45 min',
        avatar: '👨‍💻',
        expertise: ['Smart Contracts', 'Security', 'Tech'],
    },
    {
        id: '3',
        name: 'Emily Thompson',
        title: 'Crypto Educator',
        rating: 5.0,
        sessions: 210,
        price: '$35',
        duration: '30 min',
        avatar: '👩‍🏫',
        expertise: ['Beginners', 'Wallets', 'Safety'],
    },
];

export default function ConsultScreen() {
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Coming Soon Banner */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.comingSoonBanner}>
                <View style={styles.bannerContent}>
                    <Text style={styles.bannerEmoji}>🚧</Text>
                    <View>
                        <Text style={styles.bannerTitle}>Booking Coming Soon!</Text>
                        <Text style={styles.bannerText}>
                            We&apos;re setting up our expert network. Leave your email below to be notified.
                        </Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.notifyBtn}>
                    <Text style={styles.notifyBtnText}>Notify Me</Text>
                </TouchableOpacity>
            </Animated.View>

            {/* Preview: Expert Consultants */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <Text style={styles.sectionTitle}>⭐ Featured Experts (Preview)</Text>
                <Text style={styles.sectionSubtitle}>
                    Meet some of the experts who will be available soon
                </Text>

                {consultants.map((consultant, index) => (
                    <Animated.View
                        key={consultant.id}
                        entering={FadeInDown.delay(300 + index * 100).duration(400)}
                    >
                        <TouchableOpacity style={styles.consultantCard} activeOpacity={0.8}>
                            <View style={styles.consultantHeader}>
                                <Text style={styles.consultantAvatar}>{consultant.avatar}</Text>
                                <View style={styles.consultantInfo}>
                                    <Text style={styles.consultantName}>{consultant.name}</Text>
                                    <Text style={styles.consultantTitle}>{consultant.title}</Text>
                                    <View style={styles.ratingRow}>
                                        <Ionicons name="star" size={14} color="#fbbf24" />
                                        <Text style={styles.rating}>{consultant.rating}</Text>
                                        <Text style={styles.sessions}> • {consultant.sessions}+ sessions</Text>
                                    </View>
                                </View>
                                <View style={styles.priceTag}>
                                    <Text style={styles.price}>{consultant.price}</Text>
                                    <Text style={styles.duration}>{consultant.duration}</Text>
                                </View>
                            </View>

                            <View style={styles.expertiseTags}>
                                {consultant.expertise.map((tag) => (
                                    <View key={tag} style={styles.tag}>
                                        <Text style={styles.tagText}>{tag}</Text>
                                    </View>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.bookBtn} disabled>
                                <Text style={styles.bookBtnText}>Coming Soon</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </Animated.View>
                ))}
            </Animated.View>

            {/* What to Expect */}
            <Animated.View entering={FadeInDown.delay(600).duration(400)}>
                <Text style={styles.sectionTitle}>💡 What You&apos;ll Get</Text>
                <View style={styles.benefitsList}>
                    <View style={styles.benefitItem}>
                        <Ionicons name="videocam" size={24} color={Colors.primary} />
                        <View style={styles.benefitContent}>
                            <Text style={styles.benefitTitle}>1-on-1 Video Calls</Text>
                            <Text style={styles.benefitText}>Private sessions with DeFi experts</Text>
                        </View>
                    </View>
                    <View style={styles.benefitItem}>
                        <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
                        <View style={styles.benefitContent}>
                            <Text style={styles.benefitTitle}>Vetted Experts</Text>
                            <Text style={styles.benefitText}>All consultants are verified professionals</Text>
                        </View>
                    </View>
                    <View style={styles.benefitItem}>
                        <Ionicons name="document-text" size={24} color={Colors.secondary} />
                        <View style={styles.benefitContent}>
                            <Text style={styles.benefitTitle}>Personalized Plans</Text>
                            <Text style={styles.benefitText}>Get a custom learning or investment roadmap</Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: Spacing['3xl'],
    },
    comingSoonBanner: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
        marginBottom: Spacing.lg,
    },
    bannerContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    bannerEmoji: {
        fontSize: 32,
    },
    bannerTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    bannerText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    notifyBtn: {
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.lg,
        borderRadius: BorderRadius.md,
        alignSelf: 'flex-start',
    },
    notifyBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: '#fff',
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
        marginTop: Spacing.lg,
    },
    sectionSubtitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.md,
    },
    consultantCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        marginBottom: Spacing.md,
    },
    consultantHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: Spacing.md,
    },
    consultantAvatar: {
        fontSize: 48,
        marginRight: Spacing.md,
    },
    consultantInfo: {
        flex: 1,
    },
    consultantName: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    consultantTitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.xs,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rating: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginLeft: Spacing.xs,
    },
    sessions: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    priceTag: {
        alignItems: 'flex-end',
    },
    price: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.success,
    },
    duration: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    expertiseTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginBottom: Spacing.md,
    },
    tag: {
        backgroundColor: Colors.border,
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.full,
    },
    tagText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textSecondary,
    },
    bookBtn: {
        backgroundColor: Colors.border,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    bookBtnText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textMuted,
    },
    benefitsList: {
        gap: Spacing.md,
    },
    benefitItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    benefitContent: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    benefitText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
});
