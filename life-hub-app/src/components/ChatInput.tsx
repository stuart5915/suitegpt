import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
    const [text, setText] = useState('');

    const handleSend = () => {
        if (text.trim() && !disabled) {
            onSend(text.trim());
            setText('');
            Keyboard.dismiss();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.inputWrapper}>
                <TextInput
                    style={styles.input}
                    placeholder="Ask about your life..."
                    placeholderTextColor={COLORS.textMuted}
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={handleSend}
                    returnKeyType="send"
                    multiline
                    maxLength={500}
                    editable={!disabled}
                />
                <TouchableOpacity
                    style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
                    onPress={handleSend}
                    disabled={!text.trim() || disabled}
                >
                    <Ionicons
                        name="send"
                        size={20}
                        color={text.trim() && !disabled ? COLORS.textPrimary : COLORS.textMuted}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.surface,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: COLORS.surface,
        borderRadius: BORDER_RADIUS.xl,
        paddingLeft: SPACING.md,
        paddingRight: SPACING.xs,
        paddingVertical: SPACING.xs,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: COLORS.textPrimary,
        maxHeight: 100,
        paddingVertical: SPACING.sm,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: BORDER_RADIUS.full,
        backgroundColor: COLORS.purple,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: SPACING.sm,
    },
    sendButtonDisabled: {
        backgroundColor: COLORS.surfaceLight,
    },
});
