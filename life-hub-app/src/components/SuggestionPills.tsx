import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

interface SuggestionPillsProps {
    onSelect: (suggestion: string) => void;
    visible: boolean;
}

const SUGGESTIONS = [
    { emoji: '📊', text: 'How was my week?' },
    { emoji: '💪', text: 'What workouts did I do?' },
    { emoji: '🥗', text: 'What did I eat today?' },
    { emoji: '🙏', text: 'Show my Bible reflections' },
    { emoji: '💰', text: 'Any good deals nearby?' },
    { emoji: '😴', text: 'Analyze my sleep patterns' },
    { emoji: '📈', text: 'Am I making progress?' },
    { emoji: '🎯', text: 'Give me a plan for tomorrow' },
];

export function SuggestionPills({ onSelect, visible }: SuggestionPillsProps) {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Try asking:</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {SUGGESTIONS.map((suggestion, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.pill}
                        onPress={() => onSelect(suggestion.text)}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.emoji}>{suggestion.emoji}</Text>
                        <Text style={styles.pillText}>{suggestion.text}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: SPACING.sm,
    },
    label: {
        fontSize: 12,
        color: COLORS.textMuted,
        paddingHorizontal: SPACING.md,
        marginBottom: SPACING.sm,
    },
    scrollContent: {
        paddingHorizontal: SPACING.md,
        gap: SPACING.sm,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
        borderRadius: BORDER_RADIUS.full,
        borderWidth: 1,
        borderColor: COLORS.surfaceLight,
        gap: SPACING.xs,
    },
    emoji: {
        fontSize: 14,
    },
    pillText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
});
