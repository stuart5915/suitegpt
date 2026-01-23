// Custom Success Toast
// Animated in-app success notification

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';

interface SuccessToastProps {
    visible: boolean;
    message: string;
    subMessage?: string;
    onHide: () => void;
    duration?: number;
}

export default function SuccessToast({
    visible,
    message,
    subMessage,
    onHide,
    duration = 3000,
}: SuccessToastProps) {
    const translateY = useSharedValue(-150);
    const opacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            // Smooth slide down - no bounce
            translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
            opacity.value = withTiming(1, { duration: 250 });

            // Auto hide after duration
            const timeout = setTimeout(() => {
                translateY.value = withTiming(-150, { duration: 250 });
                opacity.value = withTiming(0, { duration: 200 });
                setTimeout(onHide, 300);
            }, duration);

            return () => clearTimeout(timeout);
        }
    }, [visible]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <LinearGradient
                colors={[Colors.success, '#10b981']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
            >
                <View style={styles.iconContainer}>
                    <Ionicons name="checkmark-circle" size={28} color="#fff" />
                </View>
                <View style={styles.textContainer}>
                    <Text style={styles.message}>{message}</Text>
                    {subMessage && (
                        <Text style={styles.subMessage}>{subMessage}</Text>
                    )}
                </View>
            </LinearGradient>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 60,
        left: Spacing.lg,
        right: Spacing.lg,
        zIndex: 9999,
    },
    gradient: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.xl,
        shadowColor: Colors.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    iconContainer: {
        marginRight: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    message: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },
    subMessage: {
        fontSize: Typography.fontSize.sm,
        color: 'rgba(255, 255, 255, 0.85)',
        marginTop: 2,
    },
});
