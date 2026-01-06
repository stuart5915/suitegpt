// CategoryChip component for filter selection

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

interface CategoryChipProps {
    label: string;
    selected: boolean;
    onPress: () => void;
}

export function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
    return (
        <TouchableOpacity
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text style={[styles.label, selected && styles.labelSelected]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        backgroundColor: '#2D2D3D',
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#3D3D4D',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 40,
    },
    chipSelected: {
        backgroundColor: '#FF6B35',
        borderColor: '#FF6B35',
    },
    label: {
        fontSize: 14,
        color: '#A0A0B0',
        fontWeight: '500',
        lineHeight: 18,
        textAlignVertical: 'center',
    },
    labelSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
});
