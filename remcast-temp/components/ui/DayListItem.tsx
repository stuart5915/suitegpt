import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

interface DayListItemProps {
    dayNumber: number;
    isCompleted: boolean;
    isCurrent: boolean;
    onPress: () => void;
    disabled?: boolean;
}

export function DayListItem({ dayNumber, isCompleted, isCurrent, onPress, disabled }: DayListItemProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[
                styles.container,
                isCompleted && styles.completedContainer,
                isCurrent && styles.currentContainer,
                disabled && styles.disabledContainer,
            ]}
            activeOpacity={0.7}
            disabled={disabled}
        >
            <Typography
                variant="body"
                style={[
                    styles.text,
                    isCurrent && styles.currentText,
                    disabled && styles.disabledText,
                ]}
            >
                Day {dayNumber}
            </Typography>
            {isCompleted && (
                <View style={styles.checkmark}>
                    <Typography variant="body" style={styles.checkmarkText}>
                        ✓
                    </Typography>
                </View>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 2,
        borderColor: Colors.lightGray,
    },
    completedContainer: {
        borderColor: Colors.gold,
        backgroundColor: '#FFF9E6', // Very light gold tint
    },
    currentContainer: {
        borderColor: Colors.gold,
        borderWidth: 3,
        backgroundColor: Colors.cream,
    },
    disabledContainer: {
        opacity: 0.5,
        backgroundColor: Colors.lightGray,
    },
    text: {
        fontWeight: '500',
    },
    currentText: {
        color: Colors.gold,
        fontWeight: '700',
    },
    disabledText: {
        color: Colors.mediumGray,
    },
    checkmark: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkmarkText: {
        color: Colors.white,
        fontWeight: 'bold',
        fontSize: 16,
    },
});
