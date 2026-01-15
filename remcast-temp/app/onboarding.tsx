/**
 * Onboarding Screen - REMcast First-Time User Experience
 * 3-slide intro with generated backgrounds
 */
import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions, FlatList, ImageBackground, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Typography } from '../components/ui/Typography';
import { Colors, Spacing } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        image: require('../assets/images/onboarding_1_1767391440393.png'),
        title: 'Capture Your Dreams',
        subtitle: 'Record your dreams the moment you wake up while they\'re still fresh',
    },
    {
        id: '2',
        image: require('../assets/images/onboarding_2_1767391454347.png'),
        title: 'AI Transforms Voice to Vision',
        subtitle: 'Our AI transcribes and extracts cinematic scenes from your dreams',
    },
    {
        id: '3',
        image: require('../assets/images/onboarding_3_1767391468138.png'),
        title: 'Watch Your Dreams Come Alive',
        subtitle: 'Generate stunning video reels from your dream experiences',
    },
];

export default function Onboarding() {
    const router = useRouter();
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    async function handleComplete() {
        await AsyncStorage.setItem('hasSeenOnboarding', 'true');
        router.replace('/home');
    }

    function handleNext() {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            handleComplete();
        }
    }

    function handleSkip() {
        handleComplete();
    }

    const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
        <ImageBackground source={item.image} style={styles.slide} resizeMode="cover">
            <View style={styles.overlay} />
            <View style={styles.content}>
                <Typography variant="h1" color={Colors.starlight} style={styles.title}>
                    {item.title}
                </Typography>
                <Typography variant="body" color={Colors.mist} style={styles.subtitle}>
                    {item.subtitle}
                </Typography>
            </View>
        </ImageBackground>
    );

    const renderPagination = () => (
        <View style={styles.pagination}>
            {SLIDES.map((_, index) => (
                <View
                    key={index}
                    style={[
                        styles.dot,
                        currentIndex === index && styles.dotActive,
                    ]}
                />
            ))}
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.id}
                renderItem={renderSlide}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                    const index = Math.round(e.nativeEvent.contentOffset.x / width);
                    setCurrentIndex(index);
                }}
            />

            {/* Skip Button */}
            <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                <Typography variant="body" color={Colors.mist}>
                    Skip
                </Typography>
            </TouchableOpacity>

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                {renderPagination()}
                <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    {currentIndex < SLIDES.length - 1 ? (
                        <Ionicons name="arrow-forward" size={24} color={Colors.starlight} />
                    ) : (
                        <Typography variant="body" color={Colors.starlight} style={{ fontWeight: '600' }}>
                            Get Started
                        </Typography>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.void,
    },
    slide: {
        width,
        height,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(15, 15, 35, 0.4)',
    },
    content: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: Spacing.xl,
        paddingBottom: 160,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
    },
    skipButton: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 60 : 40,
        right: Spacing.lg,
    },
    bottomControls: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
    },
    pagination: {
        flexDirection: 'row',
        marginBottom: Spacing.lg,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: Colors.cosmic,
        marginHorizontal: 4,
    },
    dotActive: {
        backgroundColor: Colors.dreamPurple,
        width: 24,
    },
    nextButton: {
        backgroundColor: Colors.dreamPurple,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: 24,
        minWidth: 140,
        alignItems: 'center',
    },
});
