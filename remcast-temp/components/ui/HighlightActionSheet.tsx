import React from 'react';
import { View, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { Typography } from './Typography';
import { Colors, Spacing } from '../../constants/theme';
import { useHighlight, HIGHLIGHT_COLORS } from '../../contexts/HighlightContext';

interface HighlightActionSheetProps {
    onReflect?: () => void;
    getSelectedText?: () => string;
}

export function HighlightActionSheet({ onReflect, getSelectedText }: HighlightActionSheetProps) {
    const { isSelectionMode, applyHighlight, clearSelection, selectedVerses } = useHighlight();

    if (!isSelectionMode) return null;

    async function handleShare() {
        const text = getSelectedText?.() || `Selected ${selectedVerses.size} verse(s)`;

        try {
            if (Platform.OS === 'web') {
                if (navigator.share) {
                    await navigator.share({ text });
                } else {
                    await navigator.clipboard.writeText(text);
                    window.alert('Copied to clipboard!');
                }
            } else {
                await Share.share({ message: text });
            }
        } catch (error) {
            console.error('Error sharing:', error);
        }

        clearSelection();
    }

    function handleReflect() {
        if (onReflect) {
            onReflect();
        }
        clearSelection();
    }

    async function handleColorSelect(color: string) {
        await applyHighlight(color);
    }

    return (
        <>
            {/* Backdrop - tap anywhere to dismiss */}
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={clearSelection}
            />

            <View style={styles.container}>
                <View style={styles.content}>
                    {/* Drag Handle - tap to dismiss */}
                    <TouchableOpacity
                        style={styles.dragHandleZone}
                        onPress={clearSelection}
                        activeOpacity={0.8}
                    >
                        <View style={styles.dragHandle} />
                    </TouchableOpacity>

                    {/* Color Swatches */}
                    <View style={styles.swatchRow}>
                        {HIGHLIGHT_COLORS.map(color => (
                            <TouchableOpacity
                                key={color.name}
                                style={[styles.colorSwatch, { backgroundColor: color.hex }]}
                                onPress={() => handleColorSelect(color.hex)}
                                accessibilityLabel={`Highlight ${color.name}`}
                            />
                        ))}
                    </View>

                    {/* Action Buttons */}
                    <View style={styles.actionRow}>
                        {onReflect && (
                            <>
                                <TouchableOpacity style={styles.actionButton} onPress={handleReflect}>
                                    <Typography variant="caption" color={Colors.gold} style={styles.actionText}>
                                        REFLECTION
                                    </Typography>
                                </TouchableOpacity>
                                <View style={styles.divider} />
                            </>
                        )}
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Typography variant="caption" color={Colors.gold} style={styles.actionText}>
                                SHARE
                            </Typography>
                        </TouchableOpacity>
                        <View style={styles.divider} />
                        <TouchableOpacity style={styles.actionButton} onPress={clearSelection}>
                            <Typography variant="caption" color={Colors.mediumGray} style={styles.actionText}>
                                CANCEL
                            </Typography>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
    },
    container: {
        position: 'absolute',
        bottom: 80, // Above bottom nav
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    content: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: Spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    dragHandleZone: {
        paddingVertical: 12,
        paddingHorizontal: 40,
        alignItems: 'center',
        marginTop: -4,
    },
    dragHandle: {
        width: 40,
        height: 5,
        backgroundColor: Colors.mediumGray,
        borderRadius: 3,
    },
    swatchRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    colorSwatch: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: Colors.white,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.lightGray,
    },
    actionButton: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    actionText: {
        fontWeight: 'bold',
    },
    divider: {
        width: 1,
        height: 16,
        backgroundColor: Colors.lightGray,
    },
});
