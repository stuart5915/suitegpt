import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { getCourseById, getTotalLessons, Course, Module, Lesson } from '@/lib/courses';

const PROGRESS_KEY = 'course_progress_';

export default function CourseDetailScreen() {
    const { courseId } = useLocalSearchParams<{ courseId: string }>();
    const router = useRouter();
    const course = courseId ? getCourseById(courseId) : undefined;

    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());

    // Load progress
    useEffect(() => {
        if (courseId) {
            loadProgress(courseId);
        }
    }, [courseId]);

    const loadProgress = async (id: string) => {
        try {
            const stored = await AsyncStorage.getItem(PROGRESS_KEY + id);
            if (stored) {
                setCompletedLessons(new Set(JSON.parse(stored)));
            }
        } catch (e) {
            console.error('Failed to load progress:', e);
        }
    };

    const toggleModule = (moduleId: string) => {
        setExpandedModules(prev => {
            const next = new Set(prev);
            if (next.has(moduleId)) {
                next.delete(moduleId);
            } else {
                next.add(moduleId);
            }
            return next;
        });
    };

    const openLesson = (lessonId: string) => {
        router.push({
            pathname: '/(app)/lesson/[lessonId]',
            params: { courseId, lessonId },
        });
    };

    if (!course) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Course not found</Text>
            </SafeAreaView>
        );
    }

    const totalLessons = getTotalLessons(course);
    const completedCount = completedLessons.size;
    const progressPercent = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;

    const getDifficultyColor = (difficulty: Course['difficulty']) => {
        switch (difficulty) {
            case 'beginner': return Colors.success;
            case 'intermediate': return Colors.warning;
            case 'advanced': return Colors.error;
        }
    };

    return (
        <>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: '',
                    headerBackTitle: 'Back',
                    headerStyle: { backgroundColor: Colors.background },
                    headerTintColor: Colors.textPrimary,
                    headerShadowVisible: false,
                }}
            />
            <SafeAreaView style={styles.container}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero Header */}
                    <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
                        <Text style={styles.heroEmoji}>{course.emoji}</Text>
                        <Text style={styles.heroTitle}>{course.title}</Text>

                        <View style={styles.metaRow}>
                            <View style={[
                                styles.difficultyBadge,
                                { backgroundColor: getDifficultyColor(course.difficulty) + '20' }
                            ]}>
                                <Text style={[
                                    styles.difficultyText,
                                    { color: getDifficultyColor(course.difficulty) }
                                ]}>
                                    {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
                                </Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                                <Text style={styles.metaText}>{course.duration}</Text>
                            </View>
                            <View style={styles.metaItem}>
                                <Ionicons name="book-outline" size={14} color={Colors.textMuted} />
                                <Text style={styles.metaText}>{totalLessons} lessons</Text>
                            </View>
                        </View>

                        <Text style={styles.description}>{course.description}</Text>

                        {/* Progress Bar */}
                        <View style={styles.progressSection}>
                            <View style={styles.progressHeader}>
                                <Text style={styles.progressLabel}>Progress</Text>
                                <Text style={styles.progressValue}>
                                    {completedCount}/{totalLessons} lessons
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${progressPercent}%` }
                                    ]}
                                />
                            </View>
                        </View>
                    </Animated.View>

                    {/* Modules */}
                    <View style={styles.modulesSection}>
                        <Text style={styles.sectionTitle}>Course Content</Text>

                        {course.modules.map((module, index) => (
                            <Animated.View
                                key={module.id}
                                entering={FadeInRight.delay(100 * index).duration(300)}
                            >
                                <ModuleCard
                                    module={module}
                                    isExpanded={expandedModules.has(module.id)}
                                    onToggle={() => toggleModule(module.id)}
                                    onLessonPress={openLesson}
                                    completedLessons={completedLessons}
                                    moduleNumber={index + 1}
                                />
                            </Animated.View>
                        ))}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </>
    );
}

// Module Card Component
interface ModuleCardProps {
    module: Module;
    isExpanded: boolean;
    onToggle: () => void;
    onLessonPress: (lessonId: string) => void;
    completedLessons: Set<string>;
    moduleNumber: number;
}

function ModuleCard({
    module,
    isExpanded,
    onToggle,
    onLessonPress,
    completedLessons,
    moduleNumber
}: ModuleCardProps) {
    const completedInModule = module.lessons.filter(l => completedLessons.has(l.id)).length;
    const allComplete = completedInModule === module.lessons.length;

    return (
        <View style={styles.moduleCard}>
            <TouchableOpacity
                style={styles.moduleHeader}
                onPress={onToggle}
                activeOpacity={0.7}
            >
                <View style={styles.moduleLeft}>
                    <View style={[
                        styles.moduleNumber,
                        allComplete && styles.moduleNumberComplete
                    ]}>
                        {allComplete ? (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                        ) : (
                            <Text style={styles.moduleNumberText}>{moduleNumber}</Text>
                        )}
                    </View>
                    <View style={styles.moduleTitleContainer}>
                        <Text style={styles.moduleTitle}>{module.title}</Text>
                        <Text style={styles.moduleMeta}>
                            {completedInModule}/{module.lessons.length} lessons
                            {module.quiz.length > 0 && ' • Quiz included'}
                        </Text>
                    </View>
                </View>
                <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.textMuted}
                />
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.lessonsList}>
                    {module.lessons.map((lesson, idx) => (
                        <TouchableOpacity
                            key={lesson.id}
                            style={styles.lessonItem}
                            onPress={() => onLessonPress(lesson.id)}
                            activeOpacity={0.7}
                        >
                            <View style={[
                                styles.lessonCheckbox,
                                completedLessons.has(lesson.id) && styles.lessonCheckboxComplete
                            ]}>
                                {completedLessons.has(lesson.id) && (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                )}
                            </View>
                            <View style={styles.lessonInfo}>
                                <Text style={[
                                    styles.lessonTitle,
                                    completedLessons.has(lesson.id) && styles.lessonTitleComplete
                                ]}>
                                    {lesson.title}
                                </Text>
                                <Text style={styles.lessonDuration}>{lesson.duration}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                        </TouchableOpacity>
                    ))}

                    {module.quiz.length > 0 && (
                        <View style={styles.quizRow}>
                            <Ionicons name="help-circle-outline" size={18} color={Colors.primary} />
                            <Text style={styles.quizText}>
                                {module.quiz.length} question quiz after lessons
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        paddingBottom: Spacing['3xl'],
    },
    errorText: {
        color: Colors.error,
        fontSize: Typography.fontSize.lg,
        textAlign: 'center',
        marginTop: 100,
    },

    // Hero
    hero: {
        padding: Spacing.lg,
        paddingTop: 0,
    },
    heroEmoji: {
        fontSize: 48,
        marginBottom: Spacing.md,
    },
    heroTitle: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.md,
    },
    difficultyBadge: {
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        borderRadius: BorderRadius.sm,
    },
    difficultyText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    description: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        lineHeight: Typography.fontSize.base * 1.6,
        marginBottom: Spacing.lg,
    },

    // Progress
    progressSection: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.sm,
    },
    progressLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    progressValue: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    progressBarBg: {
        height: 6,
        backgroundColor: Colors.border,
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },

    // Modules
    modulesSection: {
        padding: Spacing.lg,
        paddingTop: 0,
    },
    sectionTitle: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },
    moduleCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    moduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    moduleLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: Spacing.md,
    },
    moduleNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moduleNumberComplete: {
        backgroundColor: Colors.success,
    },
    moduleNumberText: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    moduleTitleContainer: {
        flex: 1,
    },
    moduleTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    moduleMeta: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },

    // Lessons
    lessonsList: {
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },
    lessonItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        gap: Spacing.md,
    },
    lessonCheckbox: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    lessonCheckboxComplete: {
        backgroundColor: Colors.success,
        borderColor: Colors.success,
    },
    lessonInfo: {
        flex: 1,
    },
    lessonTitle: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textPrimary,
    },
    lessonTitleComplete: {
        color: Colors.textMuted,
    },
    lessonDuration: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    quizRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        marginTop: Spacing.sm,
    },
    quizText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.primary,
        fontWeight: '500',
    },
});
