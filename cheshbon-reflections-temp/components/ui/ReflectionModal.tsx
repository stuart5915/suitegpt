import React, { useEffect } from 'react';
import { Modal, View, TouchableOpacity, TextInput, ScrollView, StyleSheet, Platform, useWindowDimensions, KeyboardAvoidingView, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Typography } from './Typography';
import { Colors, Spacing, FontFamilies } from '../../constants/theme';

interface ReflectionModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    verseNumber: string | number;
    verseText: string;
    verseReference: string;
    reflectionValue: string;
    onReflectionChange: (text: string) => void;
    sharePublicly?: boolean;
    onShareChange?: (share: boolean) => void;
}

export function ReflectionModal({
    visible,
    onClose,
    onSave,
    verseNumber,
    verseText,
    verseReference,
    reflectionValue,
    onReflectionChange,
    sharePublicly = false,
    onShareChange,
}: ReflectionModalProps) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();

    // Disable body scroll on web when modal is visible
    useEffect(() => {
        if (Platform.OS === 'web' && visible) {
            // Save original styles
            const originalBodyOverflow = document.body.style.overflow;
            const originalHtmlOverflow = document.documentElement.style.overflow;

            // Set overflow hidden on both html and body
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';

            // Prevent scroll events
            const preventScroll = (e: Event) => {
                e.preventDefault();
            };

            document.addEventListener('wheel', preventScroll, { passive: false });
            document.addEventListener('touchmove', preventScroll, { passive: false });

            return () => {
                document.body.style.overflow = originalBodyOverflow;
                document.documentElement.style.overflow = originalHtmlOverflow;
                document.removeEventListener('wheel', preventScroll);
                document.removeEventListener('touchmove', preventScroll);
            };
        }
    }, [visible]);

    if (!visible) return null;

    // For web, use a completely custom overlay with fixed positioning
    if (Platform.OS === 'web') {
        return (
            <View style={[webStyles.fixedOverlay, { width: windowWidth, height: windowHeight }]}>
                <TouchableOpacity style={webStyles.backdrop} onPress={onClose} activeOpacity={1} />
                <View style={[webStyles.modalContainer, { maxWidth: Math.min(windowWidth - 32, 500) }]}>
                    {/* Header */}
                    <View style={webStyles.header}>
                        <Typography variant="h3" color={Colors.gold}>Verse {verseNumber}</Typography>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Typography variant="h3" color={Colors.mediumGray}>✕</Typography>
                        </TouchableOpacity>
                    </View>
                    {/* Verse text */}
                    <View style={webStyles.verseBox}>
                        <Typography variant="body" style={webStyles.verseText} numberOfLines={3}>"{verseText}"</Typography>
                    </View>
                    <Typography variant="caption" color={Colors.gold} style={webStyles.reference}>— {verseReference}</Typography>
                    {/* Input */}
                    <TextInput
                        style={webStyles.input}
                        placeholder="Write your reflection on this verse..."
                        placeholderTextColor={Colors.mediumGray}
                        value={reflectionValue}
                        onChangeText={onReflectionChange}
                        multiline
                        maxLength={2000}
                    />
                    {/* Share Toggle */}
                    {onShareChange && (
                        <TouchableOpacity
                            onPress={() => onShareChange(!sharePublicly)}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
                        >
                            <View style={{
                                width: 44, height: 24, borderRadius: 12,
                                backgroundColor: sharePublicly ? Colors.gold : 'rgba(0,0,0,0.2)',
                                padding: 2, justifyContent: 'center',
                            }}>
                                <View style={{
                                    width: 20, height: 20, borderRadius: 10,
                                    backgroundColor: '#FFF',
                                    alignSelf: sharePublicly ? 'flex-end' : 'flex-start',
                                }} />
                            </View>
                            <Typography variant="caption" color={Colors.charcoal}>
                                Share to Community Feed
                            </Typography>
                        </TouchableOpacity>
                    )}
                    {/* Actions */}
                    <View style={webStyles.actions}>
                        <TouchableOpacity style={webStyles.cancelButton} onPress={onClose}>
                            <Typography variant="body" color={Colors.mediumGray}>Cancel</Typography>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[webStyles.saveButton, !reflectionValue.trim() && webStyles.buttonDisabled]}
                            disabled={!reflectionValue.trim()}
                            onPress={onSave}
                        >
                            <Typography variant="body" color={Colors.white}>
                                {sharePublicly ? '📤 Save & Share' : '💾 Save Reflection'}
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    }

    // For native platforms, use standard Modal with keyboard handling
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={0}
                >
                    <TouchableOpacity style={styles.backdrop} onPress={() => { Keyboard.dismiss(); onClose(); }} />
                    <View style={styles.modal}>
                        <View style={styles.header}>
                            <Typography variant="h3" color={Colors.gold}>Verse {verseNumber}</Typography>
                            <TouchableOpacity onPress={() => { Keyboard.dismiss(); onClose(); }}>
                                <Typography variant="h3" color={Colors.mediumGray}>✕</Typography>
                            </TouchableOpacity>
                        </View>
                        <ScrollView
                            style={styles.verseScroll}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Typography variant="body" style={styles.verseText}>"{verseText}"</Typography>
                        </ScrollView>
                        <Typography variant="caption" color={Colors.gold} style={styles.reference}>— {verseReference}</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="Write your reflection on this verse..."
                            placeholderTextColor={Colors.mediumGray}
                            value={reflectionValue}
                            onChangeText={onReflectionChange}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            maxLength={2000}
                        />
                        {/* Share Toggle */}
                        {onShareChange && (
                            <TouchableOpacity
                                onPress={() => onShareChange(!sharePublicly)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md }}
                            >
                                <View style={{
                                    width: 44, height: 24, borderRadius: 12,
                                    backgroundColor: sharePublicly ? Colors.gold : 'rgba(0,0,0,0.2)',
                                    padding: 2, justifyContent: 'center',
                                }}>
                                    <View style={{
                                        width: 20, height: 20, borderRadius: 10,
                                        backgroundColor: '#FFF',
                                        alignSelf: sharePublicly ? 'flex-end' : 'flex-start',
                                    }} />
                                </View>
                                <Typography variant="caption" color={Colors.charcoal}>
                                    Share to Community Feed
                                </Typography>
                            </TouchableOpacity>
                        )}
                        <View style={styles.actions}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => { Keyboard.dismiss(); onClose(); }}>
                                <Typography variant="body" color={Colors.mediumGray}>Cancel</Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.saveButton, !reflectionValue.trim() && styles.buttonDisabled]}
                                disabled={!reflectionValue.trim()}
                                onPress={() => { Keyboard.dismiss(); onSave(); }}
                            >
                                <Typography variant="body" color={Colors.white}>
                                    {sharePublicly ? '📤 Save & Share' : '💾 Save Reflection'}
                                </Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

// Web-specific styles with position fixed
const webStyles = StyleSheet.create({
    fixedOverlay: {
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
        alignItems: 'center',
        zIndex: 9999,
        overflow: 'hidden',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    modalContainer: {
        backgroundColor: Colors.cream,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        paddingBottom: 24,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    verseBox: {
        backgroundColor: 'rgba(212, 163, 115, 0.1)',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
    },
    verseText: {
        fontStyle: 'italic',
        color: Colors.charcoal,
    },
    reference: {
        marginBottom: 12,
    },
    input: {
        backgroundColor: Colors.white,
        borderRadius: 12,
        padding: 12,
        height: 80,
        fontSize: 16,
        fontFamily: FontFamilies.sans,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    saveButton: {
        backgroundColor: Colors.gold,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
});

// Native styles
const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
    modal: { backgroundColor: Colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, maxHeight: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    verseScroll: { maxHeight: 100, marginBottom: Spacing.sm, backgroundColor: 'rgba(212, 163, 115, 0.1)', padding: Spacing.md, borderRadius: 8 },
    verseText: { fontStyle: 'italic', color: Colors.charcoal },
    reference: { marginTop: Spacing.md },
    input: { backgroundColor: Colors.white, borderRadius: 12, padding: Spacing.md, height: 120, marginTop: Spacing.md, fontSize: 16, fontFamily: FontFamilies.sans, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: Spacing.md },
    cancelButton: { paddingVertical: 10, paddingHorizontal: 16 },
    saveButton: { backgroundColor: Colors.gold, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
    buttonDisabled: { opacity: 0.5 },
});
