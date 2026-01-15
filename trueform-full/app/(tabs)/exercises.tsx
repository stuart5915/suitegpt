import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EXERCISE_CATALOG, getExerciseImage, getExerciseVideoUrl, Exercise } from '../../constants/exercises';
import VideoPlayerModal from '../../components/VideoPlayerModal';

const { width } = Dimensions.get('window');

type Category = 'all' | 'neck' | 'shoulder' | 'upper_back' | 'core' | 'lower_back' | 'hip' | 'lower_body' | 'wrist';
type ExerciseType = 'all' | 'stretch' | 'strengthening' | 'mobility';

const CATEGORY_LABELS: Record<Category, string> = {
    all: 'All',
    neck: 'Neck',
    shoulder: 'Shoulder',
    upper_back: 'Back',
    core: 'Core',
    lower_back: 'L. Back',
    hip: 'Hip',
    lower_body: 'Legs',
    wrist: 'Wrist',
};

const TYPE_LABELS: Record<ExerciseType, { label: string; color: string }> = {
    all: { label: 'All Types', color: '#888' },
    stretch: { label: '🧘 Stretch', color: '#4CAF50' },
    strengthening: { label: '💪 Strength', color: '#FF9800' },
    mobility: { label: '🔄 Mobility', color: '#2196F3' },
};

export default function ExercisesScreen() {
    const [selectedCategory, setSelectedCategory] = useState<Category>('all');
    const [selectedType, setSelectedType] = useState<ExerciseType>('all');
    const [selectedDifficulty, setSelectedDifficulty] = useState<'all' | 'gentle' | 'moderate' | 'challenging'>('all');
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
    const [videoModalExercise, setVideoModalExercise] = useState<Exercise | null>(null);

    const filteredExercises = EXERCISE_CATALOG.filter(ex => {
        const categoryMatch = selectedCategory === 'all' || ex.category === selectedCategory;
        const typeMatch = selectedType === 'all' || ex.type === selectedType;
        const difficultyMatch = selectedDifficulty === 'all' || ex.difficulty === selectedDifficulty;
        return categoryMatch && typeMatch && difficultyMatch;
    });

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'stretch': return '#4CAF50';
            case 'strengthening': return '#FF9800';
            case 'mobility': return '#2196F3';
            default: return '#888';
        }
    };

    const getDifficultyLabel = (difficulty: string) => {
        switch (difficulty) {
            case 'gentle': return '🟢 Gentle';
            case 'moderate': return '🟡 Moderate';
            case 'challenging': return '🔴 Challenging';
            default: return difficulty;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <Text style={styles.screenTitle}>💪 Exercise Library</Text>
                <Text style={styles.subtitle}>
                    Browse {EXERCISE_CATALOG.length} exercises
                </Text>

                {/* Type Filter */}
                <Text style={styles.filterLabel}>Filter by Type</Text>
                <View style={styles.typeFilters}>
                    {(Object.keys(TYPE_LABELS) as ExerciseType[]).map(type => (
                        <TouchableOpacity
                            key={type}
                            style={[
                                styles.typeBtn,
                                selectedType === type && {
                                    backgroundColor: TYPE_LABELS[type].color + '20',
                                    borderColor: TYPE_LABELS[type].color,
                                }
                            ]}
                            onPress={() => setSelectedType(type)}
                        >
                            <Text style={[
                                styles.typeBtnText,
                                selectedType === type && { color: TYPE_LABELS[type].color }
                            ]}>
                                {TYPE_LABELS[type].label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Category Filter - Wrapped Grid */}
                <Text style={styles.filterLabel}>Filter by Body Area</Text>
                <View style={styles.categoryGrid}>
                    {(Object.keys(CATEGORY_LABELS) as Category[]).map(cat => (
                        <TouchableOpacity
                            key={cat}
                            style={[
                                styles.categoryTab,
                                selectedCategory === cat && styles.categoryTabActive
                            ]}
                            onPress={() => setSelectedCategory(cat)}
                        >
                            <Text style={[
                                styles.categoryTabText,
                                selectedCategory === cat && styles.categoryTabTextActive
                            ]}>
                                {CATEGORY_LABELS[cat]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Exercise Count + Difficulty Toggle */}
                <View style={styles.resultRow}>
                    <Text style={styles.resultCount}>
                        {filteredExercises.length} exercise{filteredExercises.length !== 1 ? 's' : ''}
                    </Text>
                    <TouchableOpacity
                        style={styles.difficultyToggle}
                        onPress={() => {
                            const order: ('all' | 'gentle' | 'moderate' | 'challenging')[] = ['all', 'gentle', 'moderate', 'challenging'];
                            const currentIndex = order.indexOf(selectedDifficulty);
                            const nextIndex = (currentIndex + 1) % order.length;
                            setSelectedDifficulty(order[nextIndex]);
                        }}
                    >
                        <Text style={styles.difficultyToggleText}>
                            {selectedDifficulty === 'all' ? '⬆️⬇️ All Levels' :
                                selectedDifficulty === 'gentle' ? '🟢 Gentle' :
                                    selectedDifficulty === 'moderate' ? '🟡 Moderate' : '🔴 Challenging'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Exercise List */}
                {filteredExercises.map(exercise => {
                    const isExpanded = expandedExerciseId === exercise.id;
                    const exerciseImage = getExerciseImage(exercise.id);

                    return (
                        <TouchableOpacity
                            key={exercise.id}
                            style={[
                                styles.exerciseCard,
                                isExpanded && styles.exerciseCardExpanded
                            ]}
                            onPress={() => setExpandedExerciseId(isExpanded ? null : exercise.id)}
                            activeOpacity={0.8}
                        >
                            <View style={styles.exerciseHeader}>
                                {exerciseImage && (
                                    <Image
                                        source={exerciseImage}
                                        style={styles.exerciseImage}
                                        resizeMode="contain"
                                    />
                                )}
                                <View style={styles.exerciseInfo}>
                                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                                    <View style={styles.exerciseMeta}>
                                        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(exercise.type) + '30' }]}>
                                            <Text style={[styles.typeBadgeText, { color: getTypeColor(exercise.type) }]}>
                                                {exercise.type}
                                            </Text>
                                        </View>
                                        <Text style={styles.difficultyText}>
                                            {getDifficultyLabel(exercise.difficulty)}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.chevron}>{isExpanded ? '▼' : '▶'}</Text>
                            </View>

                            {isExpanded && (
                                <View style={styles.expandedContent}>
                                    <Text style={styles.descriptionText}>
                                        {exercise.description}
                                    </Text>

                                    <TouchableOpacity
                                        style={styles.learnMoreBtn}
                                        onPress={() => setVideoModalExercise(exercise)}
                                    >
                                        <Text style={styles.learnMoreText}>📺 Watch Videos →</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </TouchableOpacity>
                    );
                })}

                {filteredExercises.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No exercises match your filters</Text>
                        <TouchableOpacity
                            style={styles.clearFiltersBtn}
                            onPress={() => {
                                setSelectedCategory('all');
                                setSelectedType('all');
                            }}
                        >
                            <Text style={styles.clearFiltersText}>Clear Filters</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.bottomSpacer} />
            </ScrollView>

            {/* Video Player Modal */}
            <VideoPlayerModal
                visible={!!videoModalExercise}
                onClose={() => setVideoModalExercise(null)}
                url={videoModalExercise ? getExerciseVideoUrl(videoModalExercise.name) : ''}
                exerciseName={videoModalExercise?.name || ''}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F0F1A',
    },
    scrollContent: {
        padding: 16,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 16,
    },
    filterLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginTop: 4,
    },
    typeFilters: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    typeBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    typeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    categoryTab: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryTabActive: {
        backgroundColor: 'rgba(0,188,212,0.15)',
        borderColor: '#00BCD4',
    },
    categoryTabText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    categoryTabTextActive: {
        color: '#00BCD4',
    },
    resultRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    resultCount: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
    },
    difficultyToggle: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    difficultyToggleText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    exerciseCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    exerciseCardExpanded: {
        borderColor: 'rgba(0,188,212,0.3)',
        backgroundColor: 'rgba(0,188,212,0.05)',
    },
    exerciseHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    exerciseImage: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    exerciseMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    typeBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    difficultyText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    chevron: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginLeft: 8,
    },
    expandedContent: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    descriptionText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 20,
    },
    learnMoreBtn: {
        marginTop: 12,
        paddingVertical: 8,
    },
    learnMoreText: {
        fontSize: 14,
        color: '#00BCD4',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyStateText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 12,
    },
    clearFiltersBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(0,188,212,0.15)',
    },
    clearFiltersText: {
        fontSize: 14,
        color: '#00BCD4',
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 100,
    },
});
