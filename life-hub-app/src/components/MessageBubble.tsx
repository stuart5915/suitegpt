import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '../types';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

interface MessageBubbleProps {
    message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';

    return (
        <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
            <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
                <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
                    {message.content}
                </Text>
                {message.suiteCost && message.suiteCost > 0 && (
                    <Text style={styles.costBadge}>-{message.suiteCost} $SUITE</Text>
                )}
            </View>
            <Text style={styles.timestamp}>
                {formatTime(message.timestamp)}
            </Text>
        </View>
    );
}

function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
    container: {
        marginVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
    },
    userContainer: {
        alignItems: 'flex-end',
    },
    aiContainer: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '80%',
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 4,
        borderRadius: BORDER_RADIUS.lg,
    },
    userBubble: {
        backgroundColor: COLORS.userBubble,
        borderBottomRightRadius: SPACING.xs,
    },
    aiBubble: {
        backgroundColor: COLORS.aiBubble,
        borderBottomLeftRadius: SPACING.xs,
    },
    text: {
        fontSize: 16,
        lineHeight: 22,
    },
    userText: {
        color: COLORS.textPrimary,
    },
    aiText: {
        color: COLORS.textPrimary,
    },
    timestamp: {
        fontSize: 11,
        color: COLORS.textMuted,
        marginTop: SPACING.xs,
    },
    costBadge: {
        fontSize: 10,
        color: COLORS.cyan,
        marginTop: SPACING.xs,
        fontWeight: '600',
    },
});
