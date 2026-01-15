import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontSizes, FontFamilies, BorderRadius, Spacing } from '../../constants/theme';

interface ButtonProps {
    onPress: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    style?: ViewStyle;
}

export function Button({ onPress, children, variant = 'primary', disabled = false, style }: ButtonProps) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                styles.button,
                variant === 'primary' ? styles.primary : styles.secondary,
                disabled && styles.disabled,
                style,
            ]}
            activeOpacity={0.7}
        >
            <Text style={[styles.text, variant === 'primary' ? styles.primaryText : styles.secondaryText]}>
                {children}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    primary: {
        backgroundColor: Colors.gold,
    },
    secondary: {
        backgroundColor: Colors.white,
        borderWidth: 2,
        borderColor: Colors.gold,
    },
    disabled: {
        opacity: 0.5,
    },
    text: {
        fontFamily: FontFamilies.sansSemiBold,
        fontSize: FontSizes.base,
        textAlign: 'center',
    },
    primaryText: {
        color: Colors.white,
    },
    secondaryText: {
        color: Colors.gold,
    },
});
