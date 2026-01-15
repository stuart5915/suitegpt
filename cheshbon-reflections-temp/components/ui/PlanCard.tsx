import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { type PlanType } from '../../services/planGenerator';

interface PlanCardProps {
    planName: string;
    planType: PlanType;
    currentDay: number;
    totalDays: number;
    onPress: () => void;
}

const PLAN_ICONS: Record<PlanType, string> = {
    canonical: '📖',
    chronological: '📅',
    nt90: '✨',
    wisdom: '🕊️',
    jesus: '✝️',
    custom: '🎯',
};

export function PlanCard({ planName, planType, currentDay, totalDays, onPress }: PlanCardProps) {
    const progressPercentage = (currentDay / totalDays) * 100;

    return (
        <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Typography variant="h2">{PLAN_ICONS[planType]}</Typography>
                </View>
                <View style={styles.titleContainer}>
                    <Typography variant="h3">{planName}</Typography>
                    <Typography variant="caption" style={styles.progress}>
                        Day {currentDay} of {totalDays}
                    </Typography>
                </View>
            </View>

            <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        ...Shadows.md,
        borderWidth: 2,
        borderColor: Colors.lightGray,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    iconContainer: {
        width: 50,
        height: 50,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.cream,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    titleContainer: {
        flex: 1,
    },
    progress: {
        marginTop: Spacing.xs,
        color: Colors.gold,
    },
    progressBarContainer: {
        height: 8,
        backgroundColor: Colors.lightGray,
        borderRadius: BorderRadius.sm,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: Colors.gold,
        borderRadius: BorderRadius.sm,
    },
});
