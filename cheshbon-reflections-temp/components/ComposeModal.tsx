import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';
import { publishReflection } from '../services/feedService';

interface ComposeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    userDisplayName: string;
    userAvatarUrl?: string | null;
}

export function ComposeModal({ visible, onClose, onSuccess, userDisplayName, userAvatarUrl }: ComposeModalProps) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [sharePublicly, setSharePublicly] = useState(true); // Default to sharing

    async function handleSubmit() {
        if (!text.trim()) return;

        setSubmitting(true);
        try {
            // ComposeModal is for PUBLIC sharing only - no need to double-save
            try {
                await publishReflection(
                    '💭 Personal Reflection',
                    '', // No verse text for personal reflections
                    text.trim()
                );
            } catch (publishError: any) {
                if (publishError?.message === 'USERNAME_REQUIRED') {
                    // Show alert about needing username for public sharing
                    Alert.alert(
                        'Username Required',
                        'To share publicly, please set a username in your Profile first.',
                        [{ text: 'OK' }]
                    );
                    setSubmitting(false);
                    return;
                } else {
                    throw publishError;
                }
            }

            setText('');
            onClose();
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error('Failed to save reflection:', error);
            Alert.alert('Error', 'Failed to save reflection. Please try again.');
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
                    {/* User Avatar + Input */}
                    <View style={styles.composeRow}>
                        <View style={styles.avatar}>
                            {userAvatarUrl ? (
                                <Image
                                    source={{ uri: userAvatarUrl }}
                                    style={{ width: 44, height: 44, borderRadius: 22 }}
                                />
                            ) : (
                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold', fontSize: 18 }}>
                                    {userDisplayName[0]?.toUpperCase() || '?'}
                                </Typography>
                            )}
                        </View>
                        <TextInput
                            style={styles.input}
                            placeholder="What's on your heart today?"
                            placeholderTextColor={Colors.mediumGray}
                            value={text}
                            onChangeText={setText}
                            multiline
                            autoFocus
                            maxLength={2000}
                        />
                    </View>

                    {/* Tag indicator */}
                    <View style={styles.tagIndicator}>
                        <Typography variant="caption" color={Colors.gold}>
                            💭 This will be shared as a Personal Reflection
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
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
    },
    content: {
        flex: 1,
        padding: Spacing.lg,
    },
    composeRow: {
        flexDirection: 'row',
        gap: 12,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
    },
    input: {
        flex: 1,
        fontSize: 18,
        color: Colors.charcoal,
        minHeight: 150,
        textAlignVertical: 'top',
        paddingTop: 4,
    },
    tagIndicator: {
        marginTop: Spacing.lg,
        padding: Spacing.md,
        backgroundColor: 'rgba(212, 163, 115, 0.1)',
        borderRadius: 8,
    },
});
