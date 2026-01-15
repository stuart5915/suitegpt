import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, TextInput, Image, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';
import { type PublicReflection, formatRelativeTime } from '../services/feedService';

interface QuoteReflectModalProps {
    visible: boolean;
    onClose: () => void;
    onSubmit: (text: string) => Promise<void>;
    quotedReflection: PublicReflection;
}

export function QuoteReflectModal({ visible, onClose, onSubmit, quotedReflection }: QuoteReflectModalProps) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        if (!text.trim()) return;
        setSubmitting(true);
        try {
            await onSubmit(text.trim());
            setText('');
            onClose();
        } catch (e) {
            console.error('Failed to submit quote reflection', e);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose}>
                        <Typography variant="body" color={Colors.charcoal}>Cancel</Typography>
                    </TouchableOpacity>
                    <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                        Reflect on this
                    </Typography>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={!text.trim() || submitting}
                        style={[styles.shareButton, (!text.trim() || submitting) && { opacity: 0.5 }]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                            <Typography variant="body" color={Colors.white} style={{ fontWeight: '600' }}>Share</Typography>
                        )}
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} keyboardDismissMode="on-drag">
                    {/* Compose Area */}
                    <TextInput
                        style={styles.input}
                        placeholder="What are your thoughts?"
                        placeholderTextColor={Colors.mediumGray}
                        value={text}
                        onChangeText={setText}
                        multiline
                        autoFocus
                        maxLength={2000}
                    />

                    {/* Quoted Reflection Preview */}
                    <View style={styles.quotedCard}>
                        <View style={styles.quotedHeader}>
                            <View style={styles.quotedAvatar}>
                                {quotedReflection.avatar_url ? (
                                    <Image
                                        source={{ uri: quotedReflection.avatar_url }}
                                        style={{ width: 20, height: 20, borderRadius: 10 }}
                                    />
                                ) : (
                                    <Typography variant="caption" color={Colors.white} style={{ fontSize: 10, fontWeight: 'bold' }}>
                                        {(quotedReflection.display_name?.[0] || '?').toUpperCase()}
                                    </Typography>
                                )}
                            </View>
                            <Typography variant="caption" color={Colors.charcoal} style={{ fontWeight: '600' }}>
                                {quotedReflection.display_name || 'Anonymous'}
                            </Typography>
                            <Typography variant="caption" color={Colors.mediumGray} style={{ marginLeft: 6 }}>
                                {formatRelativeTime(quotedReflection.created_at)}
                            </Typography>
                        </View>
                        <Typography variant="caption" color={Colors.gold} style={{ marginTop: 4 }}>
                            {quotedReflection.verse_reference}
                        </Typography>
                        <Typography variant="caption" color={Colors.charcoal} style={{ marginTop: 4, lineHeight: 18 }} numberOfLines={4}>
                            {quotedReflection.reflection}
                        </Typography>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    shareButton: {
        backgroundColor: Colors.gold,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 18,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    input: {
        fontSize: 18,
        color: Colors.charcoal,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    quotedCard: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: Spacing.md,
        marginTop: Spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.08)',
    },
    quotedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    quotedAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
    },
});
