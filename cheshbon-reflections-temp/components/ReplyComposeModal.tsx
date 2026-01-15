import { useState, useRef } from 'react';
import { View, Modal, TouchableOpacity, TextInput, StyleSheet, Platform, ActivityIndicator, KeyboardAvoidingView, Image, Keyboard, ScrollView, Pressable, InputAccessoryView } from 'react-native';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';
import { postReplyToReply, postReply, formatRelativeTime, type PublicReflection } from '../services/feedService';

interface ReplyComposeModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: (newReply: PublicReflection) => void;
    reflectionId: string;
    replyingTo: PublicReflection | null; // The reply or reflection being replied to
    userDisplayName: string;
    userAvatarUrl?: string | null;
    isReplyToReply?: boolean; // true if replying to a reply, false if replying to main reflection
}

export function ReplyComposeModal({
    visible,
    onClose,
    onSuccess,
    reflectionId,
    replyingTo,
    userDisplayName,
    userAvatarUrl,
    isReplyToReply = true,
}: ReplyComposeModalProps) {
    const [text, setText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!text.trim() || !replyingTo) return;

        setSubmitting(true);
        try {
            let newReply;
            if (isReplyToReply) {
                newReply = await postReplyToReply(reflectionId, replyingTo.id, text.trim());
            } else {
                newReply = await postReply(reflectionId, text.trim());
            }

            if (newReply) {
                setText('');
                onSuccess(newReply);
                onClose();
            }
        } catch (error) {
            console.error('Error posting reply:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (!replyingTo) return null;

    // Get display info from the reply/reflection being replied to
    const originalDisplayName = replyingTo.display_name || 'Anonymous';
    const originalAvatarUrl = replyingTo.avatar_url;
    const originalText = replyingTo.reflection;
    const originalTime = formatRelativeTime(replyingTo.created_at);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => { Keyboard.dismiss(); onClose(); }}
        >
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                {/* Header - For non-keyboard interactions */}
                <View style={styles.header}>
                    <View
                        onTouchEnd={() => {
                            console.log('[DEBUG] Cancel onTouchEnd!');
                            onClose();
                        }}
                        style={{ padding: 12, marginLeft: -12, marginVertical: -4 }}
                    >
                        <Typography variant="body" color={Colors.charcoal}>Cancel</Typography>
                    </View>
                    <View
                        onTouchEnd={() => {
                            if (text.trim() && !submitting) {
                                handleSubmit();
                            }
                        }}
                        style={[styles.postButton, !text.trim() && styles.postButtonDisabled]}
                    >
                        {submitting ? (
                            <ActivityIndicator size="small" color={Colors.white} />
                        ) : (
                            <Typography variant="body" color={Colors.white} style={{ fontWeight: '600' }}>
                                Reply
                            </Typography>
                        )}
                    </View>
                </View>

                <ScrollView
                    keyboardShouldPersistTaps="always"
                    contentContainerStyle={{ flexGrow: 1 }}
                >

                    {/* Original content being replied to */}
                    <View style={styles.originalContent}>
                        <View style={styles.originalRow}>
                            {/* Avatar */}
                            <View style={styles.avatarColumn}>
                                {originalAvatarUrl ? (
                                    <Image source={{ uri: originalAvatarUrl }} style={styles.avatar} />
                                ) : (
                                    <View style={styles.avatarPlaceholder}>
                                        <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                            {originalDisplayName[0]?.toUpperCase()}
                                        </Typography>
                                    </View>
                                )}
                                {/* Connecting line */}
                                <View style={styles.connectingLine} />
                            </View>

                            {/* Content */}
                            <View style={styles.contentColumn}>
                                <View style={styles.nameRow}>
                                    <Typography variant="body" color={Colors.charcoal} style={{ fontWeight: 'bold' }}>
                                        {originalDisplayName}
                                    </Typography>
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        · {originalTime}
                                    </Typography>
                                </View>
                                <Typography variant="body" color={Colors.charcoal} style={styles.originalText}>
                                    {originalText}
                                </Typography>

                                {/* Replying to indicator */}
                                <View style={styles.replyingToRow}>
                                    <Typography variant="caption" color={Colors.mediumGray}>
                                        Replying to{' '}
                                    </Typography>
                                    <Typography variant="caption" color={Colors.gold}>
                                        @{originalDisplayName}
                                    </Typography>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Compose area */}
                    <View style={styles.composeArea}>
                        {/* Your avatar */}
                        {userAvatarUrl ? (
                            <Image source={{ uri: userAvatarUrl }} style={styles.yourAvatar} />
                        ) : (
                            <View style={styles.yourAvatarPlaceholder}>
                                <Typography variant="body" color={Colors.white} style={{ fontWeight: 'bold' }}>
                                    {userDisplayName[0]?.toUpperCase()}
                                </Typography>
                            </View>
                        )}

                        {/* Text input */}
                        <TextInput
                            style={styles.textInput}
                            placeholder="Post your reply"
                            placeholderTextColor={Colors.mediumGray}
                            value={text}
                            onChangeText={setText}
                            multiline
                            autoFocus
                            maxLength={2000}
                        />
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingTop: Platform.OS === 'ios' ? 16 : Spacing.md,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.08)',
    },
    postButton: {
        backgroundColor: Colors.gold,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 18,
    },
    postButtonDisabled: {
        opacity: 0.5,
    },
    originalContent: {
        padding: Spacing.md,
    },
    originalRow: {
        flexDirection: 'row',
    },
    avatarColumn: {
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    avatarPlaceholder: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.brown,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectingLine: {
        width: 2,
        flex: 1,
        backgroundColor: Colors.lightGray,
        marginTop: 4,
        minHeight: 20,
    },
    contentColumn: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    originalText: {
        lineHeight: 22,
        marginBottom: Spacing.sm,
    },
    replyingToRow: {
        flexDirection: 'row',
        marginTop: 4,
    },
    composeArea: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        flex: 1,
    },
    yourAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        marginRight: Spacing.sm,
    },
    yourAvatarPlaceholder: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: Spacing.sm,
    },
    textInput: {
        flex: 1,
        fontSize: 18,
        color: Colors.charcoal,
        textAlignVertical: 'top',
        paddingTop: 0,
    },
    accessoryBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: Colors.cream,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: 'rgba(0,0,0,0.08)',
    },
    accessoryButton: {
        padding: 8,
    },
    accessoryPostButton: {
        backgroundColor: Colors.gold,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 18,
    },
});
