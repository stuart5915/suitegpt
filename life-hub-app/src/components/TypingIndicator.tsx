import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../constants';

export function TypingIndicator() {
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animateDot = (dot: Animated.Value, delay: number) => {
            return Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(dot, {
                        toValue: 1,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                    Animated.timing(dot, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true,
                    }),
                ])
            );
        };

        const animation = Animated.parallel([
            animateDot(dot1, 0),
            animateDot(dot2, 150),
            animateDot(dot3, 300),
        ]);

        animation.start();

        return () => animation.stop();
    }, [dot1, dot2, dot3]);

    const getTranslateY = (dot: Animated.Value) => {
        return dot.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -6],
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.bubble}>
                <Animated.View
                    style={[styles.dot, { transform: [{ translateY: getTranslateY(dot1) }] }]}
                />
                <Animated.View
                    style={[styles.dot, { transform: [{ translateY: getTranslateY(dot2) }] }]}
                />
                <Animated.View
                    style={[styles.dot, { transform: [{ translateY: getTranslateY(dot3) }] }]}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginVertical: SPACING.xs,
        paddingHorizontal: SPACING.md,
        alignItems: 'flex-start',
    },
    bubble: {
        flexDirection: 'row',
        backgroundColor: COLORS.aiBubble,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.md,
        borderRadius: BORDER_RADIUS.lg,
        borderBottomLeftRadius: SPACING.xs,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: COLORS.cyan,
    },
});
