import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, Image, Share, Modal, Dimensions, TextInput, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMovementReports, deleteMovementReport, updateMovementReport, MovementReport, supabase, getHealthProfile, getPainContext } from '../../services/supabase';
import { router } from 'expo-router';
import { matchExerciseFromText, getExerciseImage, getExerciseVideoUrl, EXERCISE_CATALOG, PHASE_DIFFICULTY_MAP, getExercisesByDifficulty } from '../../constants/exercises';
import {
    getActivePlan,
    getPlanProgress,
    markExerciseComplete,
    unmarkExerciseComplete,
    shouldPromptProgressScan,
    createRehabPlan,
    abandonPlan,
    WeeklyExercises,
    RehabPlan,
    PlanProgress,
    RehabExercise,
} from '../../services/rehabPlanService';

const { width: screenWidth } = Dimensions.get('window');

// Simple markdown renderer for bold text
const renderMarkdownText = (text: string, baseStyle: any, boldStyle: any) => {
    let cleanText = text.replace(/\*\*/g, '{{BOLD}}');
    cleanText = cleanText.replace(/\*/g, '');
    cleanText = cleanText.replace(/{{BOLD}}/g, '**');
    cleanText = cleanText
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+/gm, '')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '');

    const parts = cleanText.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            const boldText = part.slice(2, -2);
            return <Text key={index} style={boldStyle}>{boldText}</Text>;
        } else if (part) {
            return <Text key={index}>{part}</Text>;
        }
        return null;
    });
};

// Parse structured report into sections
interface ParsedReport {
    tldr: string;
    topExercise: string;
    sections: { name: string; content: string }[];
    rawText: string;
}

const parseStructuredReport = (reportText: string): ParsedReport => {
    const result: ParsedReport = {
        tldr: '',
        topExercise: '',
        sections: [],
        rawText: reportText,
    };

    const tldrMatch = reportText.match(/\[TLDR\]([\s\S]*?)\[\/TLDR\]/);
    if (tldrMatch) {
        result.tldr = tldrMatch[1].trim();
    }

    const exerciseMatch = reportText.match(/\[TOP_EXERCISE\]([\s\S]*?)\[\/TOP_EXERCISE\]/);
    if (exerciseMatch) {
        // Clean up: remove markdown asterisks and redundant "Exercise Name:" prefix
        let exerciseName = exerciseMatch[1].trim();
        exerciseName = exerciseName.replace(/\*+/g, ''); // Remove asterisks
        exerciseName = exerciseName.replace(/^exercise\s*name\s*:\s*/i, ''); // Remove "Exercise Name:" prefix
        result.topExercise = exerciseName.trim();
    }

    const sectionRegex = /\[SECTION:([^\]]+)\]([\s\S]*?)\[\/SECTION\]/g;
    let match;
    while ((match = sectionRegex.exec(reportText)) !== null) {
        result.sections.push({
            name: match[1].trim(),
            content: match[2].trim(),
        });
    }

    console.log('[PARSE] Sections found:', result.sections.map(s => s.name));

    return result;
};

// Collapsible Section Component
const CollapsibleSection = ({
    title,
    content,
    defaultExpanded = false,
    baseStyle,
    boldStyle,
}: {
    title: string;
    content: string;
    defaultExpanded?: boolean;
    baseStyle: any;
    boldStyle: any;
}) => {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    // Recognize all 3 exercise category sections for image rendering
    const titleLower = title.toLowerCase();
    const isExerciseSection = titleLower.includes('exercise') ||
        titleLower.includes('stretch') ||
        titleLower.includes('mobility');

    const renderExerciseContent = (text: string) => {
        const lines = text.split('\n').filter(line => line.trim());
        return lines.map((line, idx) => {
            const matched = matchExerciseFromText(line);
            if (matched) {
                const exerciseImage = getExerciseImage(matched.id);
                return (
                    <View key={idx} style={styles.exerciseItem}>
                        {exerciseImage && (
                            <Image
                                source={exerciseImage}
                                style={styles.exerciseImage}
                                resizeMode="contain"
                            />
                        )}
                        <View style={styles.exerciseTextContainer}>
                            <Text style={boldStyle}>{matched.name}</Text>
                            <Text style={baseStyle}>{matched.description}</Text>
                        </View>
                    </View>
                );
            }
            return (
                <Text key={idx} style={baseStyle}>
                    {renderMarkdownText(line, baseStyle, boldStyle)}
                </Text>
            );
        });
    };

    return (
        <View style={styles.collapsibleSection}>
            <TouchableOpacity
                onPress={() => setIsExpanded(!isExpanded)}
                style={styles.collapsibleHeader}
            >
                <Text style={styles.collapsibleTitle}>{title}</Text>
                <Text style={styles.collapsibleArrow}>{isExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            {isExpanded && (
                <View style={styles.collapsibleContent}>
                    {isExerciseSection
                        ? renderExerciseContent(content)
                        : <Text style={baseStyle}>{renderMarkdownText(content, baseStyle, boldStyle)}</Text>
                    }
                </View>
            )}
        </View>
    );
};

export default function ReportsScreen() {
    const scrollViewRef = useRef<ScrollView>(null);

    // Reports state
    const [reports, setReports] = useState<MovementReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedReport, setExpandedReport] = useState<string | null>(null);

    // User profile state for personalized report context
    const [userName, setUserName] = useState<string>('');
    const [painAreas, setPainAreas] = useState<string[]>([]);
    const [userGoals, setUserGoals] = useState<string[]>([]);

    // Plan state
    const [activePlan, setActivePlan] = useState<RehabPlan | null>(null);
    const [planProgress, setPlanProgress] = useState<PlanProgress | null>(null);
    const [planLoading, setPlanLoading] = useState(true);
    const [selectedDayOffset, setSelectedDayOffset] = useState(0);
    const [isPlanExpanded, setIsPlanExpanded] = useState(true);
    const [currentWeekPage, setCurrentWeekPage] = useState(0);
    const [hideCelebration, setHideCelebration] = useState(false);
    const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);

    // Plan Config Modal state
    const [showPlanConfigModal, setShowPlanConfigModal] = useState(false);
    const [pendingReport, setPendingReport] = useState<MovementReport | null>(null);
    const [pendingParsed, setPendingParsed] = useState<ParsedReport | null>(null);
    const [configDuration, setConfigDuration] = useState(4);
    const [aiRecommendations, setAiRecommendations] = useState<{ duration: number; reasoning: string } | null>(null);
    const [loadingRecommendations, setLoadingRecommendations] = useState(false);

    // Cancel Plan confirmation modal state
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Rename Report modal state
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameReportId, setRenameReportId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // Plan Created success modal state
    const [showPlanCreatedModal, setShowPlanCreatedModal] = useState(false);
    const [createdPlanDuration, setCreatedPlanDuration] = useState(0);

    useEffect(() => {
        loadReports();
        loadActivePlan();
        loadUserProfile();
    }, []);

    // Reset expanded exercise when switching days or weeks
    useEffect(() => {
        setExpandedExerciseId(null);
    }, [selectedDayOffset, currentWeekPage]);

    const loadReports = async () => {
        setLoading(true);
        try {
            const { data, error } = await getMovementReports();
            if (error) {
                console.error('Failed to load reports:', error);
            } else {
                setReports(data || []);
            }
        } catch (error) {
            console.error('[Reports] Error loading reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadActivePlan = async () => {
        setPlanLoading(true);
        try {
            const { data: plan } = await getActivePlan();
            setActivePlan(plan);
            if (plan) {
                const progress = await getPlanProgress(plan);
                setPlanProgress(progress);
                setCurrentWeekPage(progress.currentWeek - 1);
            }
        } catch (error) {
            console.error('[Reports] Error loading plan:', error);
        } finally {
            setPlanLoading(false);
        }
    };

    const loadUserProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get user name
                const name = user.user_metadata?.name || user.email?.split('@')[0] || '';
                setUserName(name);

                // Get pain context for personalized display
                const { data: painData } = await getPainContext(user.id);
                if (painData) {
                    setPainAreas(painData.pain_areas || []);
                    setUserGoals(painData.goals || []);
                }
            }
        } catch (error) {
            console.error('[Reports] Error loading user profile:', error);
        }
    };

    const handleExerciseToggle = async (exerciseId: string, isCompleted: boolean) => {
        if (!activePlan) return;

        if (isCompleted) {
            await unmarkExerciseComplete(activePlan.id, exerciseId);
        } else {
            await markExerciseComplete(activePlan.id, exerciseId);
            setHideCelebration(false);
        }

        const progress = await getPlanProgress(activePlan);
        setPlanProgress(progress);
    };

    const handleViewCompletedExercises = () => {
        setHideCelebration(true);
    };

    const handleDeleteReport = async (report: MovementReport) => {
        Alert.alert(
            'Delete Report?',
            'This will permanently delete this movement analysis report.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        if (report.id) {
                            const { error } = await deleteMovementReport(report.id);
                            if (error) {
                                Alert.alert('Error', 'Failed to delete report');
                            } else {
                                setReports(prev => prev.filter(r => r.id !== report.id));
                            }
                        }
                    }
                }
            ]
        );
    };

    const handleExportReport = async (report: MovementReport) => {
        const reportDate = new Date(report.created_at!).toLocaleDateString();
        const content = `
🏃 TrueForm Movement Analysis Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Movement: ${report.movement_name}
📅 Date: ${reportDate}
😣 Pain Points: ${report.pain_points_count || 0}

${report.ai_report?.replace(/\[\/?[A-Z_]+\]/g, '').replace(/\[SECTION:([^\]]+)\]/g, '\n━━ $1 ━━\n') || 'No analysis available.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by TrueForm AI Physiotherapist
        `.trim();

        try {
            await Share.share({
                message: content,
                title: `Movement Analysis - ${report.movement_name}`,
            });
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const handleRenameReport = async () => {
        if (!renameReportId || !renameValue.trim()) return;

        const { error } = await updateMovementReport(renameReportId, {
            movement_name: renameValue.trim()
        });

        if (error) {
            Alert.alert('Error', 'Failed to rename report');
        } else {
            setReports(prev => prev.map(r =>
                r.id === renameReportId
                    ? { ...r, movement_name: renameValue.trim() }
                    : r
            ));
            setShowRenameModal(false);
            setRenameReportId(null);
            setRenameValue('');
        }
    };

    const openRenameModal = (report: MovementReport) => {
        setRenameReportId(report.id ?? null);
        setRenameValue(report.movement_name);
        setShowRenameModal(true);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const handleImplementPlan = async (report: MovementReport, parsed: ParsedReport) => {
        setPendingReport(report);
        setPendingParsed(parsed);
        setLoadingRecommendations(true);

        const painMatch = report.ai_report.match(/pain.*?(\d+)\/10|severity.*?(\d+)\/10/i);
        const painLevel = painMatch ? parseInt(painMatch[1] || painMatch[2]) : 5;
        let suggestedDuration = 4;
        let reasoning = '';

        if (painLevel >= 7) {
            suggestedDuration = 6;
            reasoning = `High pain level (${painLevel}/10) suggests a longer, gentler program.`;
        } else if (painLevel >= 4) {
            suggestedDuration = 4;
            reasoning = `Moderate pain level (${painLevel}/10) suggests a standard 4-week program.`;
        } else {
            suggestedDuration = 2;
            reasoning = `Lower pain level (${painLevel}/10) allows for an accelerated 2-week program.`;
        }

        const chronicMatch = report.ai_report.match(/chronic|long-term|months|years|recurring/i);
        if (chronicMatch) {
            suggestedDuration = 6;
            reasoning += ' Chronic condition detected - 6-week plan recommended.';
        }

        setAiRecommendations({ duration: suggestedDuration, reasoning });
        setConfigDuration(suggestedDuration);
        setLoadingRecommendations(false);
        setShowPlanConfigModal(true);
    };

    const createPlanWithConfig = async () => {
        if (!pendingReport || !pendingParsed) return;

        const parsed = pendingParsed;
        const durationWeeks = configDuration;
        const frequencyPerDay = 1; // Always 1x daily - clinical standard

        setShowPlanConfigModal(false);

        // Find all exercise-related sections (Stretches, Strengthening, Mobility)
        const exerciseSections = parsed.sections.filter(s => {
            const name = s.name.toLowerCase();
            return name.includes('exercise') || name.includes('stretch') || name.includes('mobility');
        });

        console.log('[PLAN] Found exercise sections:', exerciseSections.map(s => s.name));

        if (exerciseSections.length === 0) {
            Alert.alert('Error', 'No exercises found in this report');
            return;
        }

        // Collect all exercise lines from all matching sections
        const allLines: string[] = [];
        for (const section of exerciseSections) {
            const lines = section.content.split('\n').filter(line => line.trim());
            allLines.push(...lines);
        }

        console.log('[PLAN] Total exercise lines:', allLines.length);

        const exercises: RehabExercise[] = [];

        for (const line of allLines) {
            const matched = matchExerciseFromText(line);
            if (matched) {
                // Avoid duplicates
                if (exercises.some(e => e.id === matched.id)) continue;

                const sentences = matched.description.split('.').filter(s => s.trim());
                const lastSentence = sentences[sentences.length - 1]?.trim() || '3 sets of 10';

                exercises.push({
                    id: matched.id,
                    name: matched.name,
                    reps_or_duration: lastSentence,
                    frequency_per_week: frequencyPerDay * 7,
                    description: matched.description,
                });
            }
        }

        console.log('[PLAN] Matched exercises:', exercises.map(e => e.name));

        if (exercises.length === 0) {
            Alert.alert('Error', 'Could not match any exercises from this report');
            return;
        }

        const exercisesByWeek: WeeklyExercises[] = [];
        const phases: Array<{ phase: 'acute' | 'subacute' | 'strengthening' | 'maintenance'; goal: string }> = [
            { phase: 'acute', goal: 'Reduce pain, gentle mobility' },
            { phase: 'subacute', goal: 'Rebuild stability, moderate load' },
            { phase: 'strengthening', goal: 'Build strength, prevent recurrence' },
            { phase: 'maintenance', goal: 'Maintain progress, increase endurance' },
        ];

        for (let week = 1; week <= durationWeeks; week++) {
            const phaseIndex = Math.min(
                Math.floor((week - 1) / Math.ceil(durationWeeks / 3)),
                phases.length - 1
            );
            const phaseInfo = phases[phaseIndex];
            const allowedDifficulties = PHASE_DIFFICULTY_MAP[phaseInfo.phase] || ['gentle', 'moderate', 'challenging'];

            let phaseFilteredExercises = exercises.filter(ex => {
                const matchedCatalogExercise = EXERCISE_CATALOG.find(cat => cat.id === ex.id);
                if (!matchedCatalogExercise) return true;
                return allowedDifficulties.includes(matchedCatalogExercise.difficulty);
            });

            const MIN_EXERCISES = 3;
            if (phaseFilteredExercises.length < MIN_EXERCISES) {
                const existingIds = new Set(phaseFilteredExercises.map(e => e.id));
                const allExIds = new Set(exercises.map(e => e.id));
                const firstMatch = exercises[0] && EXERCISE_CATALOG.find(c => c.id === exercises[0].id);
                const targetCategory = firstMatch?.category;

                const supplementalCandidates = getExercisesByDifficulty(allowedDifficulties as ('gentle' | 'moderate' | 'challenging')[], targetCategory)
                    .filter(ex => !existingIds.has(ex.id) && !allExIds.has(ex.id));

                for (const candidate of supplementalCandidates) {
                    if (phaseFilteredExercises.length >= MIN_EXERCISES) break;
                    const sentences = candidate.description.split('.').filter(s => s.trim());
                    const lastSentence = sentences[sentences.length - 1]?.trim() || '3 sets of 10';

                    phaseFilteredExercises.push({
                        id: candidate.id,
                        name: candidate.name,
                        reps_or_duration: lastSentence,
                        frequency_per_week: frequencyPerDay * 7,
                        description: candidate.description,
                    });
                }
            }

            // Get additional exercises from catalog for variety between weeks
            const allCandidates = getExercisesByDifficulty(
                allowedDifficulties as ('gentle' | 'moderate' | 'challenging')[],
                undefined
            ).filter(ex => {
                // Exclude exercises already in phaseFilteredExercises
                return !phaseFilteredExercises.some(pfe => pfe.id === ex.id);
            });

            // Add week-specific exercises for variety
            const weekOffset = (week - 1) % Math.max(1, allCandidates.length);
            const additionalCount = Math.min(2, allCandidates.length); // Add up to 2 unique exercises per week
            const weekSpecificCandidates = allCandidates.slice(weekOffset, weekOffset + additionalCount);

            // Only add if they don't already exist
            for (const candidate of weekSpecificCandidates) {
                if (!phaseFilteredExercises.some(e => e.id === candidate.id)) {
                    const sentences = candidate.description.split('.').filter(s => s.trim());
                    const lastSentence = sentences[sentences.length - 1]?.trim() || '3 sets of 10';

                    phaseFilteredExercises.push({
                        id: candidate.id,
                        name: candidate.name,
                        reps_or_duration: lastSentence,
                        frequency_per_week: frequencyPerDay * 7,
                        description: candidate.description,
                    });
                }
            }

            // Rotate exercises: each week gets a different ordering/subset
            // This ensures Week 1 and Week 2 don't have identical exercise lists
            const rotateStart = (week - 1) % phaseFilteredExercises.length;
            const rotatedExercises = [
                ...phaseFilteredExercises.slice(rotateStart),
                ...phaseFilteredExercises.slice(0, rotateStart)
            ];

            const weekExercises = rotatedExercises.map(ex => {
                const isTimeBasedMatch = ex.reps_or_duration.match(/(\d+)\s*(sec|seconds?|min|minutes?)/i);
                const isRepBasedMatch = ex.reps_or_duration.match(/(\d+)\s*(reps?|times?|each)/i);

                let progressedDuration = ex.reps_or_duration;

                if (isTimeBasedMatch) {
                    const baseTime = parseInt(isTimeBasedMatch[1]);
                    const unit = isTimeBasedMatch[2];
                    const newTime = Math.round(baseTime * (1 + (week - 1) * 0.1));
                    progressedDuration = `${newTime} ${unit}`;
                } else if (isRepBasedMatch) {
                    const baseReps = parseInt(isRepBasedMatch[1]);
                    const unit = isRepBasedMatch[2];
                    const newReps = Math.min(baseReps + (week - 1) * 2, baseReps * 2);
                    progressedDuration = `${newReps} ${unit}`;
                }

                return {
                    ...ex,
                    id: `${ex.id}_w${week}`,
                    reps_or_duration: progressedDuration,
                };
            });

            const weekTip = week === 1 ? '💡 Focus on form over speed' :
                week >= durationWeeks - 1 ? '💪 Challenge yourself but maintain good form' : undefined;

            exercisesByWeek.push({
                week,
                phase: phaseInfo.phase,
                phaseGoal: phaseInfo.goal,
                weekTip,
                exercises: weekExercises,
            });
        }

        const progressionStrategy = `Progressive ${durationWeeks}-week plan (${frequencyPerDay}x daily): Acute phase uses gentle mobility exercises, Subacute adds stability exercises, Strengthening introduces challenging load-bearing movements.`;

        const { data: createdPlan, error } = await createRehabPlan({
            sourceReportId: pendingReport.id,
            title: `${pendingReport.movement_name} Rehab Plan`,
            durationWeeks,
            exercisesPerDay: exercises.length,
            checkInFrequency: 'weekly',
            aiReasoning: aiRecommendations?.reasoning,
            exercises,
            exercisesByWeek,
            progressionStrategy,
        });

        if (error) {
            Alert.alert('Error', 'Failed to create plan: ' + error.message);
        } else {
            setActivePlan(createdPlan);
            const progress = await getPlanProgress(createdPlan!);
            setPlanProgress(progress);
            setCurrentWeekPage(progress.currentWeek - 1);
            setCreatedPlanDuration(durationWeeks);
            setShowPlanCreatedModal(true);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <Text style={styles.screenTitle}>📊 Your Reports</Text>

                {/* Rehab Plan Section - Always visible */}
                <Text style={styles.sectionTitle}>🎯 Your Rehab Plan</Text>

                {planLoading ? (
                    <View style={styles.planEmptyCard}>
                        <ActivityIndicator size="small" color="#00BCD4" />
                    </View>
                ) : !activePlan ? (
                    <View style={styles.planEmptyCard}>
                        <Text style={styles.planEmptyIcon}>📋</Text>
                        <Text style={styles.planEmptyTitle}>No Active Plan</Text>
                        <Text style={styles.planEmptyText}>
                            Create a personalized rehab plan from one of your movement analysis reports below.
                            Tap a report, then select "Create Rehab Plan" to get started!
                        </Text>
                        {reports.length === 0 && (
                            <TouchableOpacity
                                style={styles.planEmptyButton}
                                onPress={() => router.push('/(tabs)/scan')}
                            >
                                <Text style={styles.planEmptyButtonText}>Start a Scan First</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : planProgress && (
                    <>
                        {/* Plan Guidance Card */}
                        <View style={styles.planGuidanceCard}>
                            <Text style={styles.planGuidanceTitle}>💪 You're All Set!</Text>
                            <Text style={styles.planGuidanceText}>
                                Your personalized {planProgress.totalWeeks}-week plan is ready. Tap below to expand your exercises for each day. Check off exercises as you complete them to track your progress!
                            </Text>
                            <View style={styles.planGuidanceTips}>
                                <Text style={styles.planGuidanceTip}>• Use the arrows to view different weeks</Text>
                                <Text style={styles.planGuidanceTip}>• Tap day tabs to see upcoming exercises</Text>
                                <Text style={styles.planGuidanceTip}>• Check the box when you finish an exercise</Text>
                            </View>
                        </View>

                        <View style={styles.activePlanCard}>
                            <TouchableOpacity
                                style={styles.planHeader}
                                onPress={() => setIsPlanExpanded(!isPlanExpanded)}
                                activeOpacity={0.7}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.planTitle}>🎯 {activePlan.title}</Text>
                                    <Text style={styles.planWeek}>Week {planProgress.currentWeek} of {planProgress.totalWeeks}</Text>
                                </View>
                                <Text style={styles.expandArrow}>{isPlanExpanded ? '▼' : '▶'}</Text>
                                <TouchableOpacity
                                    style={styles.planCancelBtn}
                                    onPress={(e) => {
                                        e.stopPropagation();
                                        setShowCancelModal(true);
                                    }}
                                >
                                    <Text style={styles.planCancelText}>✕</Text>
                                </TouchableOpacity>
                            </TouchableOpacity>

                            {isPlanExpanded && (
                                <>
                                    {/* Progress Bar */}
                                    <View style={styles.progressBarContainer}>
                                        <View style={[styles.progressBar, { width: `${planProgress.percentComplete}%` }]} />
                                    </View>
                                    <Text style={styles.progressText}>{planProgress.percentComplete}% Complete</Text>

                                    {/* Week Navigator */}
                                    <View style={styles.weekNavigator}>
                                        <TouchableOpacity
                                            style={[styles.weekNavBtn, currentWeekPage === 0 && styles.weekNavBtnDisabled]}
                                            onPress={() => setCurrentWeekPage(Math.max(0, currentWeekPage - 1))}
                                            disabled={currentWeekPage === 0}
                                        >
                                            <Text style={[styles.weekNavBtnText, currentWeekPage === 0 && styles.weekNavBtnTextDisabled]}>◀</Text>
                                        </TouchableOpacity>

                                        <View style={styles.weekNavCenter}>
                                            <Text style={styles.weekNavLabel}>
                                                Week {currentWeekPage + 1} of {activePlan.exercises_by_week?.length || planProgress.totalWeeks}
                                            </Text>
                                            {activePlan.exercises_by_week?.[currentWeekPage] && (
                                                <Text style={[styles.weekNavPhase, {
                                                    color: currentWeekPage + 1 === planProgress.currentWeek ? '#4CAF50' :
                                                        activePlan.exercises_by_week[currentWeekPage].phase === 'acute' ? '#FF9800' :
                                                            activePlan.exercises_by_week[currentWeekPage].phase === 'subacute' ? '#2196F3' : '#9C27B0'
                                                }]}>
                                                    {currentWeekPage + 1 === planProgress.currentWeek ? '📍 Current Week' :
                                                        activePlan.exercises_by_week[currentWeekPage].phase.toUpperCase()}
                                                </Text>
                                            )}
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.weekNavBtn, currentWeekPage >= ((activePlan.exercises_by_week?.length || planProgress.totalWeeks) - 1) && styles.weekNavBtnDisabled]}
                                            onPress={() => setCurrentWeekPage(Math.min((activePlan.exercises_by_week?.length || planProgress.totalWeeks) - 1, currentWeekPage + 1))}
                                            disabled={currentWeekPage >= ((activePlan.exercises_by_week?.length || planProgress.totalWeeks) - 1)}
                                        >
                                            <Text style={[styles.weekNavBtnText, currentWeekPage >= ((activePlan.exercises_by_week?.length || planProgress.totalWeeks) - 1) && styles.weekNavBtnTextDisabled]}>▶</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* Week Dots */}
                                    <View style={styles.weekDots}>
                                        {(activePlan.exercises_by_week || Array(planProgress.totalWeeks).fill(null)).map((_, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => setCurrentWeekPage(idx)}
                                                style={[
                                                    styles.weekDot,
                                                    idx === currentWeekPage && styles.weekDotActive,
                                                    idx + 1 === planProgress.currentWeek && styles.weekDotCurrent
                                                ]}
                                            />
                                        ))}
                                    </View>

                                    {/* Day Tabs - Only for current week */}
                                    {currentWeekPage + 1 === planProgress.currentWeek ? (
                                        <>
                                            <View style={styles.weekTabsContainer}>
                                                {(() => {
                                                    const today = new Date();
                                                    const dayOfWeek = today.getDay();
                                                    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

                                                    return dayLabels.map((label, idx) => {
                                                        const dayOffset = idx - dayOfWeek;
                                                        const isToday = dayOffset === 0;
                                                        const isSelected = selectedDayOffset === dayOffset;
                                                        const planStartDate = new Date(activePlan.started_at);
                                                        const dayDate = new Date(today);
                                                        dayDate.setDate(dayDate.getDate() + dayOffset);
                                                        const isBeforePlanStart = dayDate < planStartDate;

                                                        return (
                                                            <TouchableOpacity
                                                                key={idx}
                                                                style={[
                                                                    styles.weekDayTab,
                                                                    isSelected && styles.weekDayTabSelected,
                                                                    isToday && !isSelected && styles.weekDayTabToday,
                                                                    isBeforePlanStart && styles.weekDayTabDisabled,
                                                                ]}
                                                                onPress={() => !isBeforePlanStart && setSelectedDayOffset(dayOffset)}
                                                                disabled={isBeforePlanStart}
                                                            >
                                                                <Text style={[
                                                                    styles.weekDayText,
                                                                    isSelected && styles.weekDayTextSelected,
                                                                    isBeforePlanStart && styles.weekDayTextDisabled,
                                                                ]}>{label}</Text>
                                                            </TouchableOpacity>
                                                        );
                                                    });
                                                })()}
                                            </View>

                                            <Text style={styles.todayLabel}>
                                                {selectedDayOffset === 0 ? "Today's" :
                                                    selectedDayOffset === 1 ? "Tomorrow's" :
                                                        selectedDayOffset === -1 ? "Yesterday's" :
                                                            new Date(Date.now() + selectedDayOffset * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'long' }) + "'s"} Exercises
                                            </Text>

                                            {activePlan.exercises_by_week?.[currentWeekPage]?.weekTip && (
                                                <View style={styles.weekTipCard}>
                                                    <Text style={styles.weekTipText}>
                                                        {activePlan.exercises_by_week[currentWeekPage].weekTip}
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <View style={styles.weekPreviewHeader}>
                                            <Text style={styles.weekPreviewLabel}>
                                                {activePlan.exercises_by_week?.[currentWeekPage]?.phaseGoal || 'Week Exercises'}
                                            </Text>
                                            <Text style={styles.weekPreviewSubtext}>
                                                {currentWeekPage + 1 < planProgress.currentWeek ? '✓ Completed Week' : '🔮 Upcoming Week'}
                                            </Text>
                                            {activePlan.exercises_by_week?.[currentWeekPage]?.weekTip && (
                                                <Text style={styles.weekTipPreview}>
                                                    {activePlan.exercises_by_week[currentWeekPage].weekTip}
                                                </Text>
                                            )}
                                        </View>
                                    )}

                                    {/* Exercise Display */}
                                    {currentWeekPage + 1 !== planProgress.currentWeek ? (
                                        <View style={styles.previewExercises}>
                                            {(() => {
                                                const weekExercises = activePlan.exercises_by_week?.[currentWeekPage]?.exercises || [];
                                                if (weekExercises.length === 0) {
                                                    return <Text style={styles.noExercisesText}>No exercises available for this week</Text>;
                                                }

                                                // Helper to look up type
                                                const getExerciseType = (id: string) => {
                                                    const baseId = id.replace(/_w\d+$/, '');
                                                    const catalogEx = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                    return catalogEx?.type || 'other';
                                                };

                                                // Group exercises
                                                const grouped: Record<string, typeof weekExercises> = {
                                                    mobility: [],
                                                    strengthening: [],
                                                    stretch: [],
                                                    other: []
                                                };

                                                weekExercises.forEach(ex => {
                                                    const type = getExerciseType(ex.id);
                                                    if (grouped[type]) {
                                                        grouped[type].push(ex);
                                                    } else {
                                                        grouped.other.push(ex);
                                                    }
                                                });

                                                // Define display order and titles
                                                const sections = [
                                                    { key: 'mobility', title: 'Mobility' },
                                                    { key: 'strengthening', title: 'Strengthening' },
                                                    { key: 'stretch', title: 'Stretches' },
                                                    { key: 'other', title: 'Other Exercises' }
                                                ];

                                                return sections.map(section => {
                                                    const exercises = grouped[section.key];
                                                    if (!exercises || exercises.length === 0) return null;

                                                    return (
                                                        <View key={section.key}>
                                                            <Text style={styles.categoryHeader}>{section.title}</Text>
                                                            {exercises.map((exercise, idx) => {
                                                                const baseId = exercise.id.replace(/_w\d+$/, '');
                                                                const exerciseImage = getExerciseImage(baseId);
                                                                const isExerciseExpanded = expandedExerciseId === exercise.id;
                                                                const catalogExercise = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                                const description = exercise.description || catalogExercise?.description || '';

                                                                return (
                                                                    <TouchableOpacity
                                                                        key={`${section.key}-${idx}`}
                                                                        style={[
                                                                            styles.exerciseRowPreview,
                                                                            isExerciseExpanded && styles.exerciseRowExpanded
                                                                        ]}
                                                                        onPress={() => setExpandedExerciseId(isExerciseExpanded ? null : exercise.id)}
                                                                        activeOpacity={0.7}
                                                                    >
                                                                        <View style={styles.exerciseRowMain}>
                                                                            {exerciseImage && (
                                                                                <Image
                                                                                    source={exerciseImage}
                                                                                    style={styles.exerciseThumbnail}
                                                                                    resizeMode="contain"
                                                                                />
                                                                            )}
                                                                            <View style={styles.exerciseInfo}>
                                                                                <Text style={styles.exerciseName}>{exercise.name}</Text>
                                                                                <Text style={styles.exerciseDetail}>{exercise.reps_or_duration}</Text>
                                                                            </View>
                                                                            <Text style={styles.expandChevron}>{isExerciseExpanded ? '▼' : '▶'}</Text>
                                                                        </View>
                                                                        {isExerciseExpanded && description && (
                                                                            <View style={styles.exerciseDescription}>
                                                                                <Text style={styles.exerciseDescriptionText}>
                                                                                    {description}
                                                                                </Text>
                                                                                {catalogExercise && (
                                                                                    <TouchableOpacity
                                                                                        onPress={() => Linking.openURL(getExerciseVideoUrl(catalogExercise.name))}
                                                                                        style={styles.learnMoreLink}
                                                                                    >
                                                                                        <Text style={styles.learnMoreText}>📺 Watch Videos →</Text>
                                                                                    </TouchableOpacity>
                                                                                )}
                                                                            </View>
                                                                        )}
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    );
                                                });
                                            })()}
                                        </View>
                                    ) : selectedDayOffset === 0 && planProgress.todaysExercises.every(e => e.completed) && !hideCelebration ? (
                                        <View style={styles.inlineCelebration}>
                                            <Text style={styles.inlineCelebrationEmoji}>🎉</Text>
                                            <Text style={styles.inlineCelebrationTitle}>Great Work!</Text>
                                            <Text style={styles.inlineCelebrationText}>
                                                You've completed all exercises for today. See you tomorrow!
                                            </Text>
                                            <TouchableOpacity onPress={handleViewCompletedExercises}>
                                                <Text style={styles.inlineGoBack}>← View Completed</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : selectedDayOffset !== 0 ? (
                                        <View style={styles.previewExercises}>
                                            {(() => {
                                                // Clinical standard: same exercises every day within a week
                                                // Progression happens week-to-week via phase changes and rep increases
                                                const exercises = planProgress.todaysExercises;
                                                if (exercises.length === 0) {
                                                    return <Text style={styles.noExercisesText}>No exercises available</Text>;
                                                }

                                                // Helper to look up type
                                                const getExerciseType = (id: string) => {
                                                    const baseId = id.replace(/_w\d+$/, '');
                                                    const catalogEx = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                    return catalogEx?.type || 'other';
                                                };

                                                // Group exercises
                                                const grouped: Record<string, typeof exercises> = {
                                                    mobility: [],
                                                    strengthening: [],
                                                    stretch: [],
                                                    other: []
                                                };

                                                exercises.forEach(item => {
                                                    const type = getExerciseType(item.exercise.id);
                                                    if (grouped[type]) {
                                                        grouped[type].push(item);
                                                    } else {
                                                        grouped.other.push(item);
                                                    }
                                                });

                                                // Define display order and titles
                                                const sections = [
                                                    { key: 'mobility', title: 'Mobility' },
                                                    { key: 'strengthening', title: 'Strengthening' },
                                                    { key: 'stretch', title: 'Stretches' },
                                                    { key: 'other', title: 'Other Exercises' }
                                                ];

                                                return sections.map(section => {
                                                    const sectionExercises = grouped[section.key];
                                                    if (!sectionExercises || sectionExercises.length === 0) return null;

                                                    return (
                                                        <View key={section.key}>
                                                            <Text style={styles.categoryHeader}>{section.title}</Text>
                                                            {sectionExercises.map((item, idx) => {
                                                                const baseId = item.exercise.id.replace(/_w\d+$/, '');
                                                                const exerciseImage = getExerciseImage(baseId);
                                                                const isExerciseExpanded = expandedExerciseId === item.exercise.id;
                                                                const catalogExercise = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                                const description = item.exercise.description || catalogExercise?.description || '';
                                                                return (
                                                                    <TouchableOpacity
                                                                        key={`${section.key}-${idx}`}
                                                                        style={[
                                                                            styles.exerciseRowPreview,
                                                                            isExerciseExpanded && styles.exerciseRowExpanded
                                                                        ]}
                                                                        onPress={() => setExpandedExerciseId(isExerciseExpanded ? null : item.exercise.id)}
                                                                        activeOpacity={0.7}
                                                                    >
                                                                        <View style={styles.exerciseRowMain}>
                                                                            {exerciseImage && (
                                                                                <Image
                                                                                    source={exerciseImage}
                                                                                    style={styles.exerciseThumbnail}
                                                                                    resizeMode="contain"
                                                                                />
                                                                            )}
                                                                            <View style={styles.exerciseInfo}>
                                                                                <Text style={styles.exerciseName}>{item.exercise.name}</Text>
                                                                                <Text style={styles.exerciseDetail}>{item.exercise.reps_or_duration}</Text>
                                                                            </View>
                                                                            <Text style={styles.expandChevron}>{isExerciseExpanded ? '▼' : '▶'}</Text>
                                                                        </View>
                                                                        {isExerciseExpanded && description && (
                                                                            <View style={styles.exerciseDescription}>
                                                                                <Text style={styles.exerciseDescriptionText}>
                                                                                    {description}
                                                                                </Text>
                                                                                {catalogExercise && (
                                                                                    <TouchableOpacity
                                                                                        onPress={() => Linking.openURL(getExerciseVideoUrl(catalogExercise.name))}
                                                                                        style={styles.learnMoreLink}
                                                                                    >
                                                                                        <Text style={styles.learnMoreText}>📺 Watch Videos →</Text>
                                                                                    </TouchableOpacity>
                                                                                )}
                                                                            </View>
                                                                        )}
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    );
                                                });
                                            })()}
                                            <Text style={styles.previewNote}>
                                                {selectedDayOffset < 0 ? 'Past session' : 'Upcoming session'}
                                            </Text>
                                        </View>
                                    ) : (
                                        (() => {
                                            const exercises = planProgress.todaysExercises;
                                            if (exercises.length === 0) {
                                                return <Text style={styles.noExercisesText}>No exercises available for today</Text>;
                                            }

                                            // Helper to look up type
                                            const getExerciseType = (id: string) => {
                                                const baseId = id.replace(/_w\d+$/, '');
                                                const catalogEx = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                return catalogEx?.type || 'other';
                                            };

                                            // Group exercises
                                            const grouped: Record<string, typeof exercises> = {
                                                mobility: [],
                                                strengthening: [],
                                                stretch: [],
                                                other: []
                                            };

                                            exercises.forEach(item => {
                                                const type = getExerciseType(item.exercise.id);
                                                if (grouped[type]) {
                                                    grouped[type].push(item);
                                                } else {
                                                    grouped.other.push(item);
                                                }
                                            });

                                            // Define display order and titles
                                            const sections = [
                                                { key: 'mobility', title: 'Mobility' },
                                                { key: 'strengthening', title: 'Strengthening' },
                                                { key: 'stretch', title: 'Stretches' },
                                                { key: 'other', title: 'Other Exercises' }
                                            ];

                                            return sections.map(section => {
                                                const sectionExercises = grouped[section.key];
                                                if (!sectionExercises || sectionExercises.length === 0) return null;

                                                return (
                                                    <View key={section.key}>
                                                        <Text style={styles.categoryHeader}>{section.title}</Text>
                                                        {sectionExercises.map((item, idx) => {
                                                            const baseId = item.exercise.id.replace(/_w\d+$/, '');
                                                            const exerciseImage = getExerciseImage(baseId);
                                                            const isExerciseExpanded = expandedExerciseId === item.exercise.id;
                                                            // Fallback to catalog description for older plans
                                                            const catalogExercise = EXERCISE_CATALOG.find(e => e.id === baseId);
                                                            const description = item.exercise.description || catalogExercise?.description || '';

                                                            return (
                                                                <View
                                                                    key={`${section.key}-${idx}`}
                                                                    style={[
                                                                        styles.exerciseRow,
                                                                        item.completed && styles.exerciseRowCompleted,
                                                                        isExerciseExpanded && styles.exerciseRowExpanded
                                                                    ]}
                                                                >
                                                                    <View style={styles.exerciseRowMain}>
                                                                        <TouchableOpacity
                                                                            style={styles.checkbox}
                                                                            onPress={() => handleExerciseToggle(item.exercise.id, item.completed)}
                                                                        >
                                                                            {item.completed && <Text style={styles.checkmark}>✓</Text>}
                                                                        </TouchableOpacity>
                                                                        <TouchableOpacity
                                                                            style={styles.exerciseContent}
                                                                            onPress={() => setExpandedExerciseId(isExerciseExpanded ? null : item.exercise.id)}
                                                                            activeOpacity={0.7}
                                                                        >
                                                                            {exerciseImage && (
                                                                                <Image
                                                                                    source={exerciseImage}
                                                                                    style={styles.exerciseThumbnail}
                                                                                    resizeMode="contain"
                                                                                />
                                                                            )}
                                                                            <View style={styles.exerciseInfo}>
                                                                                <Text style={[
                                                                                    styles.exerciseName,
                                                                                    item.completed && styles.exerciseNameCompleted
                                                                                ]}>{item.exercise.name}</Text>
                                                                                <Text style={styles.exerciseDetail}>{item.exercise.reps_or_duration}</Text>
                                                                            </View>
                                                                            <Text style={styles.expandChevron}>{isExerciseExpanded ? '▼' : '▶'}</Text>
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                    {isExerciseExpanded && description && (
                                                                        <View style={styles.exerciseDescription}>
                                                                            <Text style={styles.exerciseDescriptionText}>
                                                                                {description}
                                                                            </Text>
                                                                            {catalogExercise && (
                                                                                <TouchableOpacity
                                                                                    onPress={() => Linking.openURL(getExerciseVideoUrl(catalogExercise.name))}
                                                                                    style={styles.learnMoreLink}
                                                                                >
                                                                                    <Text style={styles.learnMoreText}>📺 Watch Videos →</Text>
                                                                                </TouchableOpacity>
                                                                            )}
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                );
                                            });
                                        })()
                                    )}

                                    {shouldPromptProgressScan(activePlan) && (
                                        <TouchableOpacity
                                            style={styles.scanPromptButton}
                                            onPress={() => router.push('/(tabs)/scan')}
                                        >
                                            <Text style={styles.scanPromptText}>📸 Time for a Progress Scan!</Text>
                                        </TouchableOpacity>
                                    )}
                                </>
                            )}
                        </View>
                    </>
                )}

                {/* Movement Analysis Reports */}
                <Text style={styles.sectionTitle}>Movement Analysis Reports</Text>

                {loading ? (
                    <View style={styles.emptyState}>
                        <ActivityIndicator size="large" color="#00BCD4" />
                        <Text style={styles.emptyText}>Loading reports...</Text>
                    </View>
                ) : reports.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📊</Text>
                        <Text style={styles.emptyText}>No reports yet</Text>
                        <Text style={styles.emptySubtext}>Complete a movement scan to see your reports here</Text>
                        <TouchableOpacity
                            style={styles.startScanButton}
                            onPress={() => router.push('/(tabs)/scan')}
                        >
                            <Text style={styles.startScanButtonText}>Start a Scan</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    reports.map(report => {
                        const parsed = parseStructuredReport(report.ai_report);
                        const isExpanded = expandedReport === report.id;

                        return (
                            <View key={report.id} style={styles.reportCard}>
                                <TouchableOpacity
                                    onPress={() => setExpandedReport(isExpanded ? null : report.id ?? null)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.reportHeader}>
                                        <Text style={styles.reportEmoji}>{report.movement_emoji || '🏃'}</Text>
                                        <View style={styles.reportInfo}>
                                            <Text style={styles.reportName}>{report.movement_name}</Text>
                                            <Text style={styles.reportDate}>{formatDate(report.created_at!)}</Text>
                                            {/* Personalized context - uses scan-specific focus, not profile pain areas */}
                                            <Text style={styles.reportPersonalized}>
                                                {userName ? `Tailored for ${userName}` : 'Your personalized analysis'}
                                                {report.pain_location && report.pain_location.length > 0 &&
                                                    ` • Focus: ${report.pain_location.slice(0, 2).map(a => a.replace('_', ' ')).join(', ')}`}
                                            </Text>
                                        </View>
                                        <Text style={styles.expandArrow}>{isExpanded ? '▼' : '▶'}</Text>
                                    </View>
                                </TouchableOpacity>

                                {isExpanded && (
                                    <View style={styles.reportContent}>
                                        {/* Action Buttons - at top for easy access */}
                                        <View style={styles.reportActions}>
                                            {!activePlan && (
                                                <TouchableOpacity
                                                    style={styles.implementButton}
                                                    onPress={() => handleImplementPlan(report, parsed)}
                                                >
                                                    <Text style={styles.implementButtonText}>🎯 Create Rehab Plan</Text>
                                                </TouchableOpacity>
                                            )}
                                            <View style={styles.actionRow}>
                                                <TouchableOpacity
                                                    style={styles.exportButton}
                                                    onPress={() => handleExportReport(report)}
                                                >
                                                    <Text style={styles.exportButtonText}>📤 Share</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.renameButton}
                                                    onPress={() => openRenameModal(report)}
                                                >
                                                    <Text style={styles.renameButtonText}>✏️ Rename</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={styles.deleteButton}
                                                    onPress={() => handleDeleteReport(report)}
                                                >
                                                    <Text style={styles.deleteButtonText}>🗑️</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* TL;DR */}
                                        {parsed.tldr && (
                                            <View style={styles.tldrCard}>
                                                <Text style={styles.tldrLabel}>📝 CLINICAL SUMMARY</Text>
                                                <Text style={styles.tldrText}>{parsed.tldr}</Text>
                                            </View>
                                        )}

                                        {/* Scan Thumbnails - Personal visuals from the actual scan */}
                                        {report.frame_thumbnails && report.frame_thumbnails.length > 0 && (
                                            <View style={styles.scanThumbnailsCard}>
                                                <Text style={styles.scanThumbnailsLabel}>📸 YOUR MOVEMENT SCAN</Text>
                                                <ScrollView
                                                    horizontal
                                                    showsHorizontalScrollIndicator={false}
                                                    style={styles.thumbnailScroll}
                                                >
                                                    {report.frame_thumbnails.map((thumbnail, thumbIdx) => (
                                                        <Image
                                                            key={thumbIdx}
                                                            source={{ uri: `data:image/jpeg;base64,${thumbnail}` }}
                                                            style={styles.scanThumbnail}
                                                            resizeMode="cover"
                                                        />
                                                    ))}
                                                </ScrollView>
                                                <Text style={styles.scanThumbnailsHint}>
                                                    {report.frame_thumbnails.length} frames captured around pain point
                                                </Text>
                                            </View>
                                        )}

                                        {/* Top Exercise */}
                                        {parsed.topExercise && (
                                            <View style={styles.topExerciseCard}>
                                                <Text style={styles.topExerciseLabel}>⭐ Top Exercise</Text>
                                                <Text style={styles.topExerciseText}>{parsed.topExercise}</Text>
                                            </View>
                                        )}

                                        {/* Collapsible Sections */}
                                        {parsed.sections.map((section, idx) => (
                                            <CollapsibleSection
                                                key={idx}
                                                title={section.name}
                                                content={section.content}
                                                defaultExpanded={false}
                                                baseStyle={styles.sectionText}
                                                boldStyle={styles.sectionTextBold}
                                            />
                                        ))}
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Plan Config Modal */}
            <Modal
                visible={showPlanConfigModal}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.planConfigOverlay}>
                    <View style={styles.planConfigModal}>
                        <Text style={styles.planConfigTitle}>Configure Your Plan</Text>

                        {loadingRecommendations ? (
                            <ActivityIndicator size="large" color="#00BCD4" />
                        ) : (
                            <>
                                {aiRecommendations && (
                                    <View style={styles.aiReasoningBox}>
                                        <Text style={styles.aiReasoningLabel}>🤖 AI Recommendation</Text>
                                        <Text style={styles.aiReasoningText}>{aiRecommendations.reasoning}</Text>
                                    </View>
                                )}

                                <Text style={styles.planConfigLabel}>Duration</Text>
                                <View style={styles.selectorRow}>
                                    {[2, 4, 6].map(weeks => (
                                        <TouchableOpacity
                                            key={weeks}
                                            style={[
                                                styles.selectorBtn,
                                                configDuration === weeks && styles.selectorBtnActive
                                            ]}
                                            onPress={() => setConfigDuration(weeks)}
                                        >
                                            <Text style={[
                                                styles.selectorBtnText,
                                                configDuration === weeks && styles.selectorBtnTextActive
                                            ]}>{weeks} weeks</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.modalButtonRow}>
                                    <TouchableOpacity
                                        style={styles.modalCancelBtn}
                                        onPress={() => setShowPlanConfigModal(false)}
                                    >
                                        <Text style={styles.modalCancelText}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.modalCreateBtn}
                                        onPress={createPlanWithConfig}
                                    >
                                        <Text style={styles.modalCreateText}>Create Plan</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Cancel Plan Confirmation Modal */}
            <Modal
                visible={showCancelModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCancelModal(false)}
            >
                <View style={styles.cancelModalOverlay}>
                    <View style={styles.cancelModalContent}>
                        <Text style={styles.cancelModalTitle}>Cancel Plan?</Text>
                        <Text style={styles.cancelModalText}>
                            This will abandon your current rehab plan. You can always create a new one from a report.
                        </Text>
                        <View style={styles.cancelModalButtons}>
                            <TouchableOpacity
                                style={styles.cancelModalKeepBtn}
                                onPress={() => setShowCancelModal(false)}
                            >
                                <Text style={styles.cancelModalKeepText}>Keep Plan</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.cancelModalConfirmBtn}
                                onPress={async () => {
                                    if (activePlan) {
                                        await abandonPlan(activePlan.id);
                                        setActivePlan(null);
                                        setPlanProgress(null);
                                    }
                                    setShowCancelModal(false);
                                }}
                            >
                                <Text style={styles.cancelModalConfirmText}>Cancel Plan</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Rename Report Modal */}
            <Modal
                visible={showRenameModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRenameModal(false)}
            >
                <View style={styles.cancelModalOverlay}>
                    <View style={styles.cancelModalContent}>
                        <Text style={styles.cancelModalTitle}>Rename Report</Text>
                        <TextInput
                            style={styles.renameInput}
                            value={renameValue}
                            onChangeText={setRenameValue}
                            placeholder="Enter new name..."
                            placeholderTextColor="rgba(255,255,255,0.4)"
                            autoFocus
                            selectTextOnFocus
                        />
                        <View style={styles.cancelModalButtons}>
                            <TouchableOpacity
                                style={styles.cancelModalKeepBtn}
                                onPress={() => {
                                    setShowRenameModal(false);
                                    setRenameReportId(null);
                                    setRenameValue('');
                                }}
                            >
                                <Text style={styles.cancelModalKeepText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cancelModalConfirmBtn, { backgroundColor: '#00BCD4' }]}
                                onPress={handleRenameReport}
                            >
                                <Text style={[styles.cancelModalConfirmText, { color: '#0D0D1A' }]}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Plan Created Success Modal */}
            <Modal
                visible={showPlanCreatedModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPlanCreatedModal(false)}
            >
                <View style={styles.successModalOverlay}>
                    <View style={styles.successModalContent}>
                        <Text style={styles.successModalEmoji}>🎯</Text>
                        <Text style={styles.successModalTitle}>Plan Created!</Text>
                        <Text style={styles.successModalText}>
                            Your {createdPlanDuration}-week rehab plan is ready. Let's get started!
                        </Text>
                        <TouchableOpacity
                            style={styles.successModalButton}
                            onPress={() => setShowPlanCreatedModal(false)}
                        >
                            <Text style={styles.successModalButtonText}>Let's Go!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0D1A',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    screenTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 20,
    },
    // Active Plan Card
    planEmptyCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
    },
    planEmptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    planEmptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
        marginBottom: 8,
    },
    planEmptyText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 20,
    },
    planEmptyButton: {
        marginTop: 16,
        backgroundColor: '#00BCD4',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    planEmptyButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0D0D1A',
    },
    // Plan Guidance Card (shows when plan is active)
    planGuidanceCard: {
        backgroundColor: 'rgba(76,175,80,0.1)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(76,175,80,0.3)',
    },
    planGuidanceTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 8,
    },
    planGuidanceText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 20,
        marginBottom: 12,
    },
    planGuidanceTips: {
        marginTop: 4,
    },
    planGuidanceTip: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    activePlanCard: {
        backgroundColor: 'rgba(0,188,212,0.1)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(0,188,212,0.3)',
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    planWeek: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    expandArrow: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        marginRight: 12,
    },
    planCancelBtn: {
        padding: 8,
    },
    planCancelText: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.4)',
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginTop: 16,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#00BCD4',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 6,
        marginBottom: 16,
    },
    // Week Navigator
    weekNavigator: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    weekNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,188,212,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    weekNavBtnDisabled: {
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    weekNavBtnText: {
        fontSize: 16,
        color: '#00BCD4',
        fontWeight: 'bold',
    },
    weekNavBtnTextDisabled: {
        color: 'rgba(255,255,255,0.2)',
    },
    weekNavCenter: {
        alignItems: 'center',
    },
    weekNavLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    weekNavPhase: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 2,
    },
    weekDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
    },
    weekDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    weekDotActive: {
        backgroundColor: '#00BCD4',
        width: 20,
    },
    weekDotCurrent: {
        borderWidth: 2,
        borderColor: '#4CAF50',
    },
    // Week Tabs
    weekTabsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 12,
    },
    weekDayTab: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    weekDayTabSelected: {
        backgroundColor: '#00BCD4',
    },
    weekDayTabToday: {
        borderWidth: 2,
        borderColor: '#00BCD4',
    },
    weekDayTabDisabled: {
        opacity: 0.3,
    },
    weekDayText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    weekDayTextSelected: {
        color: '#1A1A2E',
    },
    weekDayTextDisabled: {
        color: 'rgba(255,255,255,0.3)',
    },
    todayLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 12,
    },
    // Week Tips
    weekTipCard: {
        backgroundColor: 'rgba(255,193,7,0.15)',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#FFC107',
    },
    weekTipText: {
        fontSize: 13,
        color: '#FFC107',
        fontWeight: '500',
    },
    weekTipPreview: {
        fontSize: 12,
        color: '#FFC107',
        marginTop: 8,
        fontStyle: 'italic',
    },
    weekPreviewHeader: {
        marginBottom: 12,
    },
    weekPreviewLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
        marginBottom: 4,
    },
    weekPreviewSubtext: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    // Exercises
    exerciseRow: {
        flexDirection: 'column',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    exerciseRowCompleted: {
        backgroundColor: 'rgba(76,175,80,0.15)',
    },
    exerciseRowPreview: {
        flexDirection: 'column',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        padding: 10,
        marginBottom: 6,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#00BCD4',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmark: {
        color: '#00BCD4',
        fontSize: 14,
        fontWeight: 'bold',
    },
    exerciseThumbnail: {
        width: 50,
        height: 50,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    exerciseInfo: {
        flex: 1,
    },
    exerciseName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    exerciseNameCompleted: {
        textDecorationLine: 'line-through',
        color: 'rgba(255,255,255,0.5)',
    },
    exerciseDetail: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 2,
    },
    previewExercises: {
        marginTop: 8,
    },
    previewNote: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
    noExercisesText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        paddingVertical: 24,
    },
    // Celebration
    inlineCelebration: {
        alignItems: 'center',
        paddingVertical: 24,
    },
    inlineCelebrationEmoji: {
        fontSize: 48,
        marginBottom: 12,
    },
    inlineCelebrationTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4CAF50',
        marginBottom: 8,
    },
    inlineCelebrationText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 16,
    },
    inlineGoBack: {
        fontSize: 14,
        color: '#00BCD4',
    },
    // Scan Prompt
    scanPromptButton: {
        backgroundColor: 'rgba(255,193,7,0.2)',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        alignItems: 'center',
    },
    scanPromptText: {
        fontSize: 14,
        color: '#FFC107',
        fontWeight: '600',
    },
    // Reports Section
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 8,
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginBottom: 20,
    },
    startScanButton: {
        backgroundColor: '#00BCD4',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    startScanButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A2E',
    },
    // Report Cards - Clinical Style
    reportCard: {
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    reportHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderLeftWidth: 3,
        borderLeftColor: '#00BCD4',
    },
    reportEmoji: {
        fontSize: 36,
        marginRight: 14,
    },
    reportInfo: {
        flex: 1,
    },
    reportName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#fff',
        letterSpacing: 0.3,
    },
    reportDate: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 3,
        fontWeight: '500',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    reportPersonalized: {
        fontSize: 13,
        color: 'rgba(0,188,212,0.9)',
        fontStyle: 'italic',
        marginTop: 6,
        fontWeight: '500',
    },
    reportContent: {
        padding: 16,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    // TL;DR Card - Clinical Assessment Summary
    tldrCard: {
        backgroundColor: 'rgba(0,188,212,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#00BCD4',
    },
    tldrLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#00BCD4',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    tldrText: {
        fontSize: 15,
        color: '#fff',
        lineHeight: 22,
        fontWeight: '400',
    },
    // Scan Thumbnails - Personal imagery from user's scan
    scanThumbnailsCard: {
        backgroundColor: 'rgba(156,39,176,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#9C27B0',
    },
    scanThumbnailsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#9C27B0',
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    thumbnailScroll: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    scanThumbnail: {
        width: 60,
        height: 80,
        borderRadius: 6,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    scanThumbnailsHint: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
    },
    // Top Exercise Card - Primary Recommendation
    topExerciseCard: {
        backgroundColor: 'rgba(255,193,7,0.08)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 14,
        borderLeftWidth: 3,
        borderLeftColor: '#FFC107',
    },
    topExerciseLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFC107',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    topExerciseText: {
        fontSize: 15,
        color: '#fff',
        lineHeight: 22,
        fontWeight: '500',
    },
    // Collapsible Sections - Detailed Analysis
    collapsibleSection: {
        marginBottom: 10,
    },
    collapsibleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    collapsibleTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
        letterSpacing: 0.2,
    },
    categoryHeader: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#00BCD4',
        marginTop: 12,
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    collapsibleArrow: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
    },
    collapsibleContent: {
        padding: 12,
    },
    sectionText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 22,
    },
    sectionTextBold: {
        fontWeight: 'bold',
        color: '#fff',
    },
    // Exercise in sections
    exerciseItem: {
        flexDirection: 'row',
        marginBottom: 12,
        alignItems: 'flex-start',
    },
    exerciseImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 12,
    },
    exerciseTextContainer: {
        flex: 1,
    },
    // Action Buttons
    reportActions: {
        marginBottom: 16,
    },
    implementButton: {
        backgroundColor: '#00BCD4',
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    implementButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A2E',
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    exportButton: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    exportButtonText: {
        fontSize: 14,
        color: '#fff',
    },
    renameButton: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        alignItems: 'center',
    },
    renameButtonText: {
        fontSize: 14,
        color: '#fff',
    },
    renameInput: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#fff',
        marginTop: 8,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(0,188,212,0.5)',
    },
    deleteButton: {
        backgroundColor: 'rgba(244,67,54,0.2)',
        borderRadius: 12,
        padding: 12,
        paddingHorizontal: 16,
    },
    deleteButtonText: {
        fontSize: 16,
    },
    // Plan Config Modal
    planConfigOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    planConfigModal: {
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        padding: 24,
        width: '100%',
        maxWidth: 400,
    },
    planConfigTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 16,
    },
    planConfigLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
        marginTop: 16,
        marginBottom: 8,
    },
    aiReasoningBox: {
        backgroundColor: 'rgba(0,188,212,0.1)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(0,188,212,0.3)',
    },
    aiReasoningLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#00BCD4',
        marginBottom: 4,
    },
    aiReasoningText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 18,
    },
    selectorRow: {
        flexDirection: 'row',
        gap: 10,
    },
    selectorBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingVertical: 14,
        paddingHorizontal: 8,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectorBtnActive: {
        borderColor: '#00BCD4',
        backgroundColor: 'rgba(0,188,212,0.15)',
    },
    selectorBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
    },
    selectorBtnTextActive: {
        color: '#00BCD4',
    },
    modalButtonRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    modalCancelBtn: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
    },
    modalCreateBtn: {
        flex: 1,
        backgroundColor: '#00BCD4',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    modalCreateText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1A1A2E',
    },
    // Expandable exercise row styles
    exerciseRowExpanded: {
        borderColor: 'rgba(0,188,212,0.3)',
        borderWidth: 1,
    },
    exerciseRowMain: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    exerciseContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    expandChevron: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginLeft: 8,
    },
    exerciseDescription: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    exerciseDescriptionText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 18,
    },
    learnMoreLink: {
        marginTop: 10,
        paddingVertical: 6,
        paddingHorizontal: 0,
    },
    learnMoreText: {
        fontSize: 13,
        color: '#00BCD4',
        fontWeight: '600',
    },
    // Cancel Plan Modal styles
    cancelModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    cancelModalContent: {
        backgroundColor: '#1A1A2E',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cancelModalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 12,
    },
    cancelModalText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    cancelModalButtons: {
        flexDirection: 'row',
        gap: 12,
    },
    cancelModalKeepBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    cancelModalKeepText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    cancelModalConfirmBtn: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#FF4444',
        alignItems: 'center',
    },
    cancelModalConfirmText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Success Modal (Plan Created)
    successModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    successModalContent: {
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0,188,212,0.3)',
        width: '100%',
        maxWidth: 340,
    },
    successModalEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    successModalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#00BCD4',
        marginBottom: 12,
    },
    successModalText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
    },
    successModalButton: {
        backgroundColor: '#00BCD4',
        borderRadius: 14,
        paddingVertical: 16,
        paddingHorizontal: 48,
        width: '100%',
        alignItems: 'center',
    },
    successModalButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0D0D1A',
    },
});
