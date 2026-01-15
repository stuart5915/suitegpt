import React from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './ui/Typography';
import { Colors, Spacing } from '../constants/theme';

interface RepostMenuProps {
    visible: boolean;
    onClose: () => void;
    onReflect: () => void; // Simple re-reflect (boost)
    onQuoteReflect: () => void; // Quote with your own text
    isReposted: boolean;
}

export function RepostMenu({ visible, onClose, onReflect, onQuoteReflect, isReposted }: RepostMenuProps) {
    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.backdrop} onPress={onClose}>
                <View style={styles.sheet}>
                    {/* Re-reflect option */}
                    <TouchableOpacity
                        style={styles.option}
                        onPress={() => { onReflect(); onClose(); }}
                    >
                        <Ionicons
                            name="repeat"
                            size={22}
                            color={isReposted ? '#00BA7C' : Colors.charcoal}
                        />
                        <Typography
                            variant="body"
                            color={isReposted ? '#00BA7C' : Colors.charcoal}
                            style={{ marginLeft: 16, fontWeight: '500' }}
                        >
                            {isReposted ? 'Undo Re-reflect' : 'Re-reflect'}
                        </Typography>
                    </TouchableOpacity>

                    {/* Quote Reflect option */}
                    <TouchableOpacity
                        style={styles.option}
                        onPress={() => { onQuoteReflect(); onClose(); }}
                    >
                        <Ionicons name="pencil" size={22} color={Colors.charcoal} />
                        <Typography
                            variant="body"
                            color={Colors.charcoal}
                            style={{ marginLeft: 16, fontWeight: '500' }}
                        >
                            Reflect on this
                        </Typography>
                    </TouchableOpacity>

                    {/* Cancel */}
                    <TouchableOpacity
                        style={[styles.option, styles.cancelOption]}
                        onPress={onClose}
                    >
                        <Typography variant="body" color={Colors.mediumGray}>Cancel</Typography>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: Colors.cream,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: Spacing.md,
        paddingBottom: 40,
        paddingHorizontal: Spacing.lg,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    cancelOption: {
        justifyContent: 'center',
        borderBottomWidth: 0,
        marginTop: 8,
    },
});
