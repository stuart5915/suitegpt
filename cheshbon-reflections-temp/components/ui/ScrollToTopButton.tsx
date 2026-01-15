import { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Animated } from 'react-native';
import { Typography } from './Typography';
import { Colors } from '../../constants/theme';

interface ScrollToTopButtonProps {
    scrollViewRef: React.RefObject<ScrollView | null>;
}

export function ScrollToTopButton({ scrollViewRef }: ScrollToTopButtonProps) {
    const [isVisible, setIsVisible] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isVisible ? 1 : 0,
            duration: 200,
            useNativeDriver: true,
        }).start();
    }, [isVisible]);

    const handleScroll = (event: any) => {
        const yOffset = event.nativeEvent.contentOffset.y;
        setIsVisible(yOffset > 300); // Show after scrolling 300px
    };

    const scrollToTop = () => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    };

    if (!isVisible) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
            <TouchableOpacity style={styles.button} onPress={scrollToTop} activeOpacity={0.8}>
                <Typography variant="body" style={styles.icon}>↑</Typography>
            </TouchableOpacity>
        </Animated.View>
    );
}

// Export the handleScroll function for use in parent components
export function useScrollToTop(scrollViewRef: React.RefObject<ScrollView | null>) {
    const [isVisible, setIsVisible] = useState(false);

    const handleScroll = (event: any) => {
        const yOffset = event.nativeEvent.contentOffset.y;
        setIsVisible(yOffset > 300);
    };

    const scrollToTop = () => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    };

    return { isVisible, handleScroll, scrollToTop };
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90, // Above bottom nav
        right: 20,
        zIndex: 100,
    },
    button: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: Colors.gold,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    icon: {
        fontSize: 24,
        color: Colors.white,
        fontWeight: 'bold',
    },
});
