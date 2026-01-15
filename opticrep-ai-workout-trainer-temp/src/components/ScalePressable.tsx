import React, { useRef } from 'react';
import { Pressable, Animated, PressableProps, StyleProp, ViewStyle } from 'react-native';

interface ScalePressableProps extends PressableProps {
    scaleTo?: number;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}

export const ScalePressable: React.FC<ScalePressableProps> = ({
    scaleTo = 0.95,
    style,
    children,
    ...props
}) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
            speed: 50,
            bounciness: 10,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 10,
        }).start();
    };

    return (
        <Pressable
            {...props}
            onPressIn={(e) => {
                handlePressIn();
                props.onPressIn?.(e);
            }}
            onPressOut={(e) => {
                handlePressOut();
                props.onPressOut?.(e);
            }}
        >
            <Animated.View style={[{ transform: [{ scale }] }, style]}>
                {children}
            </Animated.View>
        </Pressable>
    );
};
