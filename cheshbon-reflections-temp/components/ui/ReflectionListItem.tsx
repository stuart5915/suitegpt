import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Typography } from './Typography';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

interface ReflectionListItemProps {
    date: string;
    scripture: string;
    snippet: string;
    onPress: () => void;
}

export function ReflectionListItem({ date, scripture, snippet, onPress }: ReflectionListItemProps) {
    // Format date nicely (e.g., "Oct 24")
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });

    return (
        <TouchableOpacity onPress={onPress} style={styles.container} activeOpacity={0.7}>
            <View style={styles.dateContainer}>
                <Typography variant="caption" style={styles.date}>
                    {formattedDate}
                </Typography>
            </View>
            <View style={styles.content}>
                <Typography variant="h3" style={styles.scripture}>
                    {scripture}
                </Typography>
                <Typography variant="body" color={Colors.mediumGray} style={styles.snippet}>
                    {snippet}
                </Typography>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        padding: Spacing.md,
        backgroundColor: Colors.white,
        borderRadius: BorderRadius.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.lightGray,
    },
    dateContainer: {
        width: 60,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.md,
    },
    date: {
        color: Colors.gold,
        fontWeight: '600',
    },
    content: {
        flex: 1,
    },
    scripture: {
        marginBottom: Spacing.xs,
    },
    snippet: {
        fontSize: 14,
        lineHeight: 20,
    },
});
