import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    SafeAreaView,
    Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { getCourseById, getLessonById, Module, QuizQuestion } from '@/lib/courses';
import { LinkedText } from '@/components/LinkedText';
import { useTerminologyStore } from '@/context/TerminologyContext';

const PROGRESS_KEY = 'course_progress_';

export default function LessonScreen() {
    const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
    const router = useRouter();

    const course = courseId ? getCourseById(courseId) : undefined;
    const lesson = courseId && lessonId ? getLessonById(courseId, lessonId) : undefined;

    const [isCompleted, setIsCompleted] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [currentModule, setCurrentModule] = useState<Module | null>(null);
    const [nextLessonId, setNextLessonId] = useState<string | null>(null);
    const openTerm = useTerminologyStore((state) => state.openTerm);

    // Find current module and next lesson
    useEffect(() => {
        if (course && lessonId) {
            let foundLesson = false;
            for (const module of course.modules) {
                for (let i = 0; i < module.lessons.length; i++) {
                    if (module.lessons[i].id === lessonId) {
                        setCurrentModule(module);
                        foundLesson = true;
                        // Check if there's a next lesson in this module
                        if (i + 1 < module.lessons.length) {
                            setNextLessonId(module.lessons[i + 1].id);
                        } else {
                            // Check next module
                            const moduleIdx = course.modules.indexOf(module);
                            if (moduleIdx + 1 < course.modules.length) {
                                const nextModule = course.modules[moduleIdx + 1];
                                if (nextModule.lessons.length > 0) {
                                    setNextLessonId(nextModule.lessons[0].id);
                                }
                            }
                        }
                        break;
                    }
                }
                if (foundLesson) break;
            }
        }
    }, [course, lessonId]);

    // Check if lesson is completed
    useEffect(() => {
        if (courseId && lessonId) {
            checkCompletion();
        }
    }, [courseId, lessonId]);

    const checkCompletion = async () => {
        try {
            const stored = await AsyncStorage.getItem(PROGRESS_KEY + courseId);
            if (stored) {
                const completed = new Set(JSON.parse(stored));
                setIsCompleted(completed.has(lessonId));
            }
        } catch (e) {
            console.error('Failed to check completion:', e);
        }
    };

    const markComplete = async () => {
        try {
            const stored = await AsyncStorage.getItem(PROGRESS_KEY + courseId);
            const completed: string[] = stored ? JSON.parse(stored) : [];
            if (!completed.includes(lessonId!)) {
                completed.push(lessonId!);
                await AsyncStorage.setItem(PROGRESS_KEY + courseId, JSON.stringify(completed));
            }
            setIsCompleted(true);

            // Check if this was the last lesson in module and show quiz
            if (currentModule) {
                const lessonIndex = currentModule.lessons.findIndex(l => l.id === lessonId);
                if (lessonIndex === currentModule.lessons.length - 1 && currentModule.quiz.length > 0) {
                    setShowQuiz(true);
                    return;
                }
            }

            // Go to next lesson or back to course
            if (nextLessonId) {
                router.replace({
                    pathname: '/(app)/lesson/[lessonId]',
                    params: { courseId, lessonId: nextLessonId },
                });
            } else {
                Alert.alert(
                    '🎉 Course Complete!',
                    'Congratulations! You\'ve completed all lessons in this course.',
                    [{ text: 'Done', onPress: () => router.back() }]
                );
            }
        } catch (e) {
            console.error('Failed to save progress:', e);
        }
    };

    if (!course || !lesson) {
        return (
            <SafeAreaView style={styles.container}>
                <Text style={styles.errorText}>Lesson not found</Text>
            </SafeAreaView>
        );
    }

    if (showQuiz && currentModule) {
        return (
            <QuizView
                questions={currentModule.quiz}
                moduleName={currentModule.title}
                onComplete={() => {
                    if (nextLessonId) {
                        router.replace({
                            pathname: '/(app)/lesson/[lessonId]',
                            params: { courseId, lessonId: nextLessonId },
                        });
                    } else {
                        router.back();
                    }
                }}
            />
        );
    }

    // Parse [[term]] patterns within text, optionally applying bold style
    const parseLinkedTerms = (text: string, baseStyle: any, isBold: boolean = false) => {
        const regex = /\[\[([^\]]+)\]\]/g;
        const parts: React.ReactNode[] = [];
        let lastIndex = 0;
        let match;
        let keyIndex = 0;

        const style = isBold ? [baseStyle, { fontWeight: '700' as const }] : baseStyle;

        while ((match = regex.exec(text)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
                parts.push(
                    <Text key={keyIndex++} style={style}>
                        {text.slice(lastIndex, match.index)}
                    </Text>
                );
            }

            // Add the linked term (always purple, bold if in bold section)
            const termName = match[1];
            parts.push(
                <Text
                    key={keyIndex++}
                    style={[style, { color: Colors.primary, fontWeight: '500' }]}
                    onPress={() => openTerm(termName)}
                >
                    {termName}
                </Text>
            );

            lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < text.length) {
            parts.push(
                <Text key={keyIndex++} style={style}>
                    {text.slice(lastIndex)}
                </Text>
            );
        }

        return parts.length > 0 ? parts : <Text style={style}>{text}</Text>;
    };

    // Parse inline markdown (bold, linked terms) within a text block
    const parseInlineMarkdown = (text: string, baseStyle: any) => {
        const parts: React.ReactNode[] = [];
        let remaining = text;
        let keyIndex = 0;

        while (remaining.length > 0) {
            // Look for **bold** pattern
            const boldMatch = remaining.match(/\*\*(.+?)\*\*/);

            if (boldMatch && boldMatch.index !== undefined) {
                // Add text before the bold (with linked terms)
                if (boldMatch.index > 0) {
                    const before = remaining.slice(0, boldMatch.index);
                    parts.push(
                        <React.Fragment key={keyIndex++}>
                            {parseLinkedTerms(before, baseStyle, false)}
                        </React.Fragment>
                    );
                }

                // Add the bold text (also parse for linked terms within)
                parts.push(
                    <React.Fragment key={keyIndex++}>
                        {parseLinkedTerms(boldMatch[1], baseStyle, true)}
                    </React.Fragment>
                );

                // Continue with remaining text
                remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
            } else {
                // No more bold, add the rest with linked terms
                parts.push(
                    <React.Fragment key={keyIndex++}>
                        {parseLinkedTerms(remaining, baseStyle, false)}
                    </React.Fragment>
                );
                break;
            }
        }

        return parts;
    };

    // Helper to strip [[term]] brackets from text (for headers)
    const stripBrackets = (text: string) => {
        return text.replace(/\[\[([^\]]+)\]\]/g, '$1');
    };

    // Parse markdown-ish content with linked terms
    const renderContent = (content: string) => {
        // Split by double newlines for paragraphs
        const sections = content.split('\n\n');

        return sections.map((section, idx) => {
            const trimmed = section.trim();

            // Headers - strip brackets since they can't be tapped in headers anyway
            if (trimmed.startsWith('# ')) {
                return (
                    <Text key={idx} style={styles.h1}>
                        {stripBrackets(trimmed.slice(2))}
                    </Text>
                );
            }
            if (trimmed.startsWith('## ')) {
                return (
                    <Text key={idx} style={styles.h2}>
                        {stripBrackets(trimmed.slice(3))}
                    </Text>
                );
            }

            // Quote blocks
            if (trimmed.startsWith('> ')) {
                return (
                    <View key={idx} style={styles.quoteBlock}>
                        <Text style={styles.quoteText}>
                            {parseInlineMarkdown(trimmed.slice(2), styles.quoteText)}
                        </Text>
                    </View>
                );
            }

            // Tables (simplified - just show as text for now)
            if (trimmed.includes('|')) {
                return (
                    <View key={idx} style={styles.tableContainer}>
                        {trimmed.split('\n').map((row, rowIdx) => {
                            if (row.includes('---')) return null;
                            const cells = row.split('|').filter(c => c.trim());
                            return (
                                <View key={rowIdx} style={styles.tableRow}>
                                    {cells.map((cell, cellIdx) => (
                                        <Text
                                            key={cellIdx}
                                            style={[
                                                styles.tableCell,
                                                rowIdx === 0 && styles.tableHeader
                                            ]}
                                        >
                                            {cell.trim()}
                                        </Text>
                                    ))}
                                </View>
                            );
                        })}
                    </View>
                );
            }

            // Regular paragraph with inline markdown and linked terms
            return (
                <View key={idx} style={styles.paragraph}>
                    <Text style={styles.bodyText}>
                        {parseInlineMarkdown(trimmed, styles.bodyText)}
                    </Text>
                </View>
            );
        });
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
                    <Animated.View entering={FadeInDown.duration(400)}>
                        {/* Lesson Header */}
                        <View style={styles.header}>
                            {currentModule && (
                                <Text style={styles.moduleName}>
                                    {currentModule.emoji} {currentModule.title}
                                </Text>
                            )}
                            <Text style={styles.lessonTitle}>{lesson.title}</Text>
                            <View style={styles.metaRow}>
                                <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                                <Text style={styles.metaText}>{lesson.duration}</Text>
                                {isCompleted && (
                                    <View style={styles.completedBadge}>
                                        <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                                        <Text style={styles.completedText}>Completed</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Lesson Content */}
                        <View style={styles.contentCard}>
                            {renderContent(lesson.content)}
                        </View>
                    </Animated.View>
                </ScrollView>

                {/* Bottom Action Bar */}
                <View style={styles.actionBar}>
                    <TouchableOpacity
                        style={[styles.actionButton, isCompleted && styles.actionButtonCompleted]}
                        onPress={markComplete}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name={isCompleted ? 'checkmark-circle' : 'checkmark-circle-outline'}
                            size={20}
                            color="#fff"
                        />
                        <Text style={styles.actionButtonText}>
                            {isCompleted ? 'Completed - Next' : 'Mark Complete'}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </>
    );
}

// Quiz View Component
interface QuizViewProps {
    questions: QuizQuestion[];
    moduleName: string;
    onComplete: () => void;
}

function QuizView({ questions, moduleName, onComplete }: QuizViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [correctCount, setCorrectCount] = useState(0);
    const [showComplete, setShowComplete] = useState(false);
    const [finalScore, setFinalScore] = useState(0);

    const question = questions[currentIndex];
    const isCorrect = selectedAnswer === question.correctIndex;
    const isLastQuestion = currentIndex === questions.length - 1;

    const handleSelect = (index: number) => {
        if (isAnswered) return;
        setSelectedAnswer(index);
    };

    const handleSubmit = () => {
        if (selectedAnswer === null) return;

        if (!isAnswered) {
            // First click - check the answer
            setIsAnswered(true);
            if (isCorrect) {
                setCorrectCount(prev => prev + 1);
            }
        } else {
            // Second click - move to next or finish
            if (isLastQuestion) {
                // Calculate final score (correctCount already includes last answer if correct)
                const score = correctCount;
                setFinalScore(score);
                setShowComplete(true);
            } else {
                setCurrentIndex(prev => prev + 1);
                setSelectedAnswer(null);
                setIsAnswered(false);
            }
        }
    };

    // Quiz Complete Screen
    if (showComplete) {
        const percent = Math.round((finalScore / questions.length) * 100);
        const isPassing = percent >= 60;

        return (
            <SafeAreaView style={styles.container}>
                <Stack.Screen
                    options={{
                        headerShown: false,
                    }}
                />
                <View style={styles.completeContainer}>
                    <Animated.View entering={FadeIn.duration(400)} style={styles.completeCard}>
                        <Text style={styles.completeEmoji}>
                            {isPassing ? '🎉' : '📚'}
                        </Text>
                        <Text style={styles.completeTitle}>
                            {isPassing ? 'Quiz Complete!' : 'Keep Learning!'}
                        </Text>
                        <Text style={styles.completeSubtitle}>{moduleName}</Text>

                        <View style={styles.scoreCircle}>
                            <Text style={styles.scoreNumber}>{finalScore}/{questions.length}</Text>
                            <Text style={styles.scoreLabel}>Correct</Text>
                        </View>

                        <Text style={[
                            styles.scoreMessage,
                            { color: isPassing ? Colors.success : Colors.warning }
                        ]}>
                            {percent >= 100 ? 'Perfect score! 🌟' :
                                percent >= 80 ? 'Great job!' :
                                    percent >= 60 ? 'Nice work!' :
                                        'Review the material and try again!'}
                        </Text>

                        <TouchableOpacity
                            style={styles.continueButton}
                            onPress={onComplete}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.continueButtonText}>Continue</Text>
                            <Ionicons name="arrow-forward" size={20} color="#fff" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: 'Quiz',
                    headerStyle: { backgroundColor: Colors.background },
                    headerTintColor: Colors.textPrimary,
                    headerShadowVisible: false,
                }}
            />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.quizContent}
            >
                <Animated.View entering={FadeIn.duration(300)}>
                    <Text style={styles.quizModuleName}>{moduleName}</Text>
                    <Text style={styles.quizProgress}>
                        Question {currentIndex + 1} of {questions.length}
                    </Text>

                    <Text style={styles.questionText}>{question.question}</Text>

                    <View style={styles.optionsContainer}>
                        {question.options.map((option, idx) => {
                            let optionStyle = styles.optionButton;
                            if (isAnswered) {
                                if (idx === question.correctIndex) {
                                    optionStyle = { ...styles.optionButton, ...styles.optionCorrect };
                                } else if (idx === selectedAnswer && !isCorrect) {
                                    optionStyle = { ...styles.optionButton, ...styles.optionWrong };
                                }
                            } else if (idx === selectedAnswer) {
                                optionStyle = { ...styles.optionButton, ...styles.optionSelected };
                            }

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={optionStyle}
                                    onPress={() => handleSelect(idx)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.optionText}>{option}</Text>
                                    {isAnswered && idx === question.correctIndex && (
                                        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {isAnswered && (
                        <View style={styles.feedbackBox}>
                            <Text style={[
                                styles.feedbackText,
                                { color: isCorrect ? Colors.success : Colors.error }
                            ]}>
                                {isCorrect ? '✓ Correct!' : '✗ Not quite right'}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </ScrollView>

            <View style={styles.actionBar}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        selectedAnswer === null && styles.actionButtonDisabled
                    ]}
                    onPress={handleSubmit}
                    disabled={selectedAnswer === null}
                    activeOpacity={0.8}
                >
                    <Text style={styles.actionButtonText}>
                        {!isAnswered ? 'Check Answer' : isLastQuestion ? 'Finish Quiz' : 'Next Question'}
                    </Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
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
        paddingBottom: 100,
    },
    errorText: {
        color: Colors.error,
        fontSize: Typography.fontSize.lg,
        textAlign: 'center',
        marginTop: 100,
    },

    // Header
    header: {
        padding: Spacing.lg,
        paddingBottom: 0,
    },
    moduleName: {
        fontSize: Typography.fontSize.sm,
        color: Colors.primary,
        fontWeight: '500',
        marginBottom: Spacing.xs,
    },
    lessonTitle: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    metaText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: Spacing.sm,
    },
    completedText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.success,
        fontWeight: '500',
    },

    // Content
    contentCard: {
        padding: Spacing.lg,
    },
    h1: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
        marginTop: Spacing.md,
    },
    h2: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
        marginTop: Spacing.lg,
    },
    paragraph: {
        marginBottom: Spacing.md,
    },
    bodyText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        lineHeight: Typography.fontSize.base * 1.7,
    },
    boldText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.sm,
    },
    quoteBlock: {
        backgroundColor: Colors.surface,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        marginVertical: Spacing.md,
    },
    quoteText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    tableContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
        marginVertical: Spacing.md,
    },
    tableRow: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    tableCell: {
        flex: 1,
        padding: Spacing.sm,
        fontSize: Typography.fontSize.sm,
        color: Colors.textPrimary,
    },
    tableHeader: {
        fontWeight: '600',
        backgroundColor: Colors.surfaceElevated,
    },

    // Action Bar
    actionBar: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: Colors.background,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    actionButtonCompleted: {
        backgroundColor: Colors.success,
    },
    actionButtonDisabled: {
        backgroundColor: Colors.border,
    },
    actionButtonText: {
        color: '#fff',
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
    },

    // Quiz
    quizContent: {
        padding: Spacing.lg,
        paddingBottom: 100,
    },
    quizModuleName: {
        fontSize: Typography.fontSize.sm,
        color: Colors.primary,
        fontWeight: '500',
        marginBottom: Spacing.xs,
    },
    quizProgress: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginBottom: Spacing.xl,
    },
    questionText: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xl,
        lineHeight: Typography.fontSize.xl * 1.4,
    },
    optionsContainer: {
        gap: Spacing.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    optionSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '10',
    },
    optionCorrect: {
        borderColor: Colors.success,
        backgroundColor: Colors.success + '15',
    },
    optionWrong: {
        borderColor: Colors.error,
        backgroundColor: Colors.error + '15',
    },
    optionText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        flex: 1,
    },
    feedbackBox: {
        marginTop: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        alignItems: 'center',
    },
    feedbackText: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '600',
    },

    // Quiz Complete Screen
    completeContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
    },
    completeCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing['2xl'],
        alignItems: 'center',
        width: '100%',
        maxWidth: 340,
    },
    completeEmoji: {
        fontSize: 64,
        marginBottom: Spacing.md,
    },
    completeTitle: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    completeSubtitle: {
        fontSize: Typography.fontSize.base,
        color: Colors.textMuted,
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    scoreCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: Colors.primary + '20',
        borderWidth: 4,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    scoreNumber: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.primary,
    },
    scoreLabel: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
    },
    scoreMessage: {
        fontSize: Typography.fontSize.base,
        fontWeight: '500',
        marginBottom: Spacing.xl,
        textAlign: 'center',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.primary,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
        borderRadius: BorderRadius.lg,
        width: '100%',
    },
    continueButtonText: {
        color: '#fff',
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
    },
});
