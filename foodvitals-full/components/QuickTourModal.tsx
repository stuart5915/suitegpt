import React, { useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    Modal,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface TourSlide {
    id: string;
    emoji: string;
    title: string;
    description: string;
    gradient: [string, string];
}

const TOUR_SLIDES: TourSlide[] = [
    {
        id: '1',
        emoji: '📸',
        title: 'Scan Meals',
        description: 'Snap a photo or describe your food — AI analyzes nutrition instantly',
        gradient: ['#1a472a', '#2d5a3d'],
    },
    {
        id: '2',
        emoji: '📊',
        title: 'Track Progress',
        description: 'See your calories, macros, and micronutrients at a glance',
        gradient: ['#1e3a5f', '#2d4a6f'],
    },
    {
        id: '3',
        emoji: '✨',
        title: 'Get Insights',
        description: 'Ask AI about your diet and get personalized meal suggestions',
        gradient: ['#3d2d5f', '#4d3d6f'],
    },
    {
        id: '4',
        emoji: '💚',
        title: 'Set Goals',
        description: 'Customize your nutrition targets in your Profile',
        gradient: ['#1a472a', '#2d5a3d'],
    },
    {
        id: '5',
        emoji: '🔔',
        title: 'Stay on Track',
        description: 'Enable notifications for smart daily reminders and suggestions',
        gradient: ['#2d3a4f', '#3d4a5f'],
    },
];

interface QuickTourModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function QuickTourModal({ visible, onClose }: QuickTourModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const handleNext = () => {
        if (currentIndex < TOUR_SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
            setCurrentIndex(currentIndex + 1);
        } else {
            onClose();
        }
    };

    const handleSkip = () => {
        onClose();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const renderSlide = ({ item }: { item: TourSlide }) => (
        <View style={styles.slide}>
            <LinearGradient
                colors={item.gradient}
                style={styles.slideGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.emojiContainer}>
                    <Text style={styles.emoji}>{item.emoji}</Text>
                </View>
                <Text style={styles.slideTitle}>{item.title}</Text>
                <Text style={styles.slideDescription}>{item.description}</Text>
            </LinearGradient>
        </View>
    );

    const isLastSlide = currentIndex === TOUR_SLIDES.length - 1;

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Background overlay */}
                <View style={styles.overlay} />

                {/* Modal content */}
                <View style={styles.modalContent}>
                    {/* Header with skip */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Quick Tour</Text>
                        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                            <Text style={styles.skipText}>Skip</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Slides */}
                    <FlatList
                        ref={flatListRef}
                        data={TOUR_SLIDES}
                        renderItem={renderSlide}
                        keyExtractor={(item) => item.id}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onViewableItemsChanged={onViewableItemsChanged}
                        viewabilityConfig={viewabilityConfig}
                        scrollEventThrottle={16}
                        style={styles.slideList}
                    />

                    {/* Dot indicators */}
                    <View style={styles.dotsContainer}>
                        {TOUR_SLIDES.map((_, index) => (
                            <View
                                key={index}
                                style={[
                                    styles.dot,
                                    index === currentIndex && styles.dotActive,
                                ]}
                            />
                        ))}
                    </View>

                    {/* Next / Get Started button */}
                    <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                        <Text style={styles.nextButtonText}>
                            {isLastSlide ? 'Get Started' : 'Next'}
                        </Text>
                        {!isLastSlide && (
                            <Ionicons name="arrow-forward" size={18} color="#000" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
    },
    modalContent: {
        width: SCREEN_WIDTH - 40,
        maxHeight: SCREEN_HEIGHT * 0.7,
        backgroundColor: '#0A0A1A',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(74,222,128,0.2)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    skipButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    skipText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    slideList: {
        flexGrow: 0,
    },
    slide: {
        width: SCREEN_WIDTH - 40,
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    slideGradient: {
        borderRadius: 16,
        padding: 30,
        alignItems: 'center',
    },
    emojiContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emoji: {
        fontSize: 40,
    },
    slideTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
    },
    slideDescription: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    dotActive: {
        backgroundColor: '#4ADE80',
        width: 24,
    },
    nextButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#4ADE80',
        marginHorizontal: 20,
        marginBottom: 20,
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    nextButtonText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
    },
});
