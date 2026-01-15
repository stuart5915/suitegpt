import { useState, useMemo } from 'react';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WORKOUT_TEMPLATES } from '../data/workoutTemplates';
import { supabase } from '../lib/supabase';
import { SavedPlan } from '../types/workout';

export default function TemplatePreviewScreen() {
    const router = useRouter();
    const { templateId } = useLocalSearchParams<{ templateId: string }>();
    const [saving, setSaving] = useState(false);
    const [expandedDay, setExpandedDay] = useState<string | null>(null);

    const template = useMemo(() => {
        return WORKOUT_TEMPLATES.find(t => t.id === templateId);
    }, [templateId]);

    if (!template) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Template not found</Text>
                    <Pressable style={styles.backButton} onPress={() => router.back()}>
                        <Text style={styles.backButtonText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    const handleUseTemplate = async () => {
        setSaving(true);
        try {
            // Create a new plan from the template
            const newPlan: SavedPlan = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: template.name,
                days: template.days.map(day => ({
                    ...day,
                    exercises: day.exercises.map(ex => ({
                        ...ex,
                        id: `${ex.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    })),
                })),
                createdAt: new Date(),
            };

            // Try to save to Supabase first
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await (supabase as any)
                    .from('saved_workout_templates')
                    .insert({
                        id: newPlan.id,
                        user_id: user.id,
                        name: newPlan.name,
                        days: newPlan.days,
                    });

                if (error) {
                    console.error('Supabase save error:', error);
                    // Fall back to local storage
                }
            }

            // Also save to local storage
            const stored = await AsyncStorage.getItem('opticrep_saved_plans');
            const existing: SavedPlan[] = stored ? JSON.parse(stored) : [];
            existing.push(newPlan);
            await AsyncStorage.setItem('opticrep_saved_plans', JSON.stringify(existing));

            // Navigate back to workout tab
            router.replace('/(tabs)/workout');
        } catch (error) {
            console.error('Error saving template:', error);
            Alert.alert('Error', 'Failed to create plan from template');
        } finally {
            setSaving(false);
        }
    };

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty) {
            case 'beginner': return '#22c55e';
            case 'intermediate': return '#eab308';
            case 'advanced': return '#ef4444';
            default: return '#71717a';
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={styles.backBtn}>← Back</Text>
                </Pressable>
                <Text style={styles.headerTitle}>Preview</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Template Info Card */}
                <View style={styles.infoCard}>
                    <View style={styles.infoHeader}>
                        <Text style={styles.infoEmoji}>{template.emoji}</Text>
                        <View style={styles.infoMeta}>
                            <Text style={styles.infoName}>{template.name}</Text>
                            <View style={[
                                styles.difficultyBadge,
                                { backgroundColor: getDifficultyColor(template.difficulty) + '20' }
                            ]}>
                                <Text style={[
                                    styles.difficultyText,
                                    { color: getDifficultyColor(template.difficulty) }
                                ]}>
                                    {template.difficulty}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.infoDescription}>{template.description}</Text>
                    <View style={styles.infoStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{template.daysPerWeek}</Text>
                            <Text style={styles.statLabel}>Days/Week</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {template.days.reduce((sum, d) => sum + d.exercises.length, 0)}
                            </Text>
                            <Text style={styles.statLabel}>Exercises</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {template.days.reduce((sum, d) =>
                                    sum + d.exercises.reduce((s, e) => s + e.sets.length, 0), 0
                                )}
                            </Text>
                            <Text style={styles.statLabel}>Total Sets</Text>
                        </View>
                    </View>
                </View>

                {/* Days Preview */}
                <Text style={styles.sectionTitle}>Workout Schedule</Text>
                {template.days.map((day, index) => {
                    const isExpanded = expandedDay === day.name;
                    return (
                        <Pressable
                            key={day.name}
                            style={styles.dayCard}
                            onPress={() => setExpandedDay(isExpanded ? null : day.name)}
                        >
                            <View style={styles.dayHeader}>
                                <View style={styles.dayNumber}>
                                    <Text style={styles.dayNumberText}>{index + 1}</Text>
                                </View>
                                <View style={styles.dayInfo}>
                                    <Text style={styles.dayName}>{day.name}</Text>
                                    <Text style={styles.dayMeta}>
                                        {day.exercises.length} exercises • {day.dayOfWeek || 'Flexible'}
                                    </Text>
                                </View>
                                <Text style={styles.expandIcon}>
                                    {isExpanded ? '▼' : '▶'}
                                </Text>
                            </View>

                            {isExpanded && (
                                <View style={styles.exerciseList}>
                                    {day.exercises.map((exercise, exIndex) => (
                                        <View key={exercise.id} style={styles.exerciseItem}>
                                            <Text style={styles.exerciseIndex}>{exIndex + 1}.</Text>
                                            <Text style={styles.exerciseName}>{exercise.name}</Text>
                                            <Text style={styles.exerciseSets}>
                                                {exercise.sets.length} × {exercise.sets[0]?.reps || '?'}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </Pressable>
                    );
                })}

                {/* Target Audience */}
                <View style={styles.audienceCard}>
                    <Text style={styles.audienceLabel}>👤 Best For</Text>
                    <Text style={styles.audienceText}>{template.targetAudience}</Text>
                </View>
            </ScrollView>

            {/* Bottom Action */}
            <View style={styles.bottomAction}>
                <Pressable
                    style={[styles.useButton, saving && styles.useButtonDisabled]}
                    onPress={handleUseTemplate}
                    disabled={saving}
                >
                    <Text style={styles.useButtonText}>
                        {saving ? 'Creating Plan...' : '✓ Use This Plan'}
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0e14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1e293b',
    },
    backBtn: {
        color: '#7CFC00',
        fontSize: 16,
        fontWeight: '500',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 120,
    },

    // Error State
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        marginBottom: 16,
    },
    backButton: {
        backgroundColor: '#1e293b',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#ffffff',
        fontWeight: '500',
    },

    // Info Card
    infoCard: {
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#7CFC00',
        marginBottom: 24,
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    infoEmoji: {
        fontSize: 48,
        marginRight: 16,
    },
    infoMeta: {
        flex: 1,
    },
    infoName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    difficultyBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    difficultyText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    infoDescription: {
        fontSize: 15,
        color: '#94a3b8',
        lineHeight: 22,
        marginBottom: 20,
    },
    infoStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '700',
        color: '#7CFC00',
    },
    statLabel: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 4,
    },

    // Section
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: 16,
    },

    // Day Card
    dayCard: {
        backgroundColor: '#151b24',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1e293b',
        overflow: 'hidden',
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    dayNumber: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1e293b',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    dayNumberText: {
        color: '#7CFC00',
        fontWeight: '700',
        fontSize: 14,
    },
    dayInfo: {
        flex: 1,
    },
    dayName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#ffffff',
    },
    dayMeta: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    expandIcon: {
        color: '#64748b',
        fontSize: 12,
    },

    // Exercise List
    exerciseList: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#0d1117',
    },
    exerciseIndex: {
        color: '#64748b',
        fontSize: 13,
        width: 24,
    },
    exerciseName: {
        flex: 1,
        color: '#e2e8f0',
        fontSize: 14,
    },
    exerciseSets: {
        color: '#7CFC00',
        fontSize: 13,
        fontWeight: '500',
    },

    // Audience Card
    audienceCard: {
        backgroundColor: '#0d1a12',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#1a2e1a',
    },
    audienceLabel: {
        color: '#7CFC00',
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    audienceText: {
        color: '#94a3b8',
        fontSize: 14,
        lineHeight: 20,
    },

    // Bottom Action
    bottomAction: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 36,
        backgroundColor: '#0a0e14',
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    useButton: {
        backgroundColor: '#7CFC00',
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
    },
    useButtonDisabled: {
        opacity: 0.6,
    },
    useButtonText: {
        color: '#0a0e14',
        fontSize: 18,
        fontWeight: '700',
    },
});
