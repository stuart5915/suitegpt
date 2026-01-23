import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Modal,
    Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useTerminologyStore } from '@/context/TerminologyContext';
import { TERMINOLOGY } from '@/lib/terminology';
import {
    COURSES,
    getCoursesByDifficulty,
    getTotalLessons,
    Course,
} from '@/lib/courses';
import EcosystemOverview from '@/components/EcosystemOverview';

const PROGRESS_KEY = 'course_progress_';

type CourseTab = 'continue' | 'all' | 'completed';

interface CourseProgress {
    courseId: string;
    completedLessons: number;
    totalLessons: number;
}

// DeFi Activities for educational section
const DEFI_ACTIVITIES = [
    {
        id: 'swapping',
        emoji: '🔄',
        label: 'Swapping',
        color: '#FF6B35',
        description: 'Exchange one token for another directly on-chain',
        howItWorks: 'Decentralized exchanges (DEXs) like Uniswap use liquidity pools to enable instant swaps without order books.',
        risks: ['Slippage on large trades', 'Impermanent loss for LPs', 'Smart contract risks'],
        advanced: {
            title: 'Advanced Swapping',
            topics: [
                { name: 'Aggregators (1inch, 0x)', desc: 'Route trades across multiple DEXs to get best prices and lowest slippage' },
                { name: 'Cross-chain Swaps', desc: 'Swap tokens between different blockchains (e.g., ETH to SOL) using bridges + DEXs' },
                { name: 'Limit Orders', desc: 'Set target prices for swaps that execute automatically when conditions are met' },
                { name: 'MEV Protection', desc: 'Use private mempools (Flashbots) to avoid sandwich attacks and front-running' },
                { name: 'Gas Optimization', desc: 'Time swaps for low gas, use L2s, or batch multiple swaps together' },
            ]
        },
        relatedCourse: 'defi-fundamentals'
    },
    {
        id: 'lending',
        emoji: '💰',
        label: 'Lending',
        color: '#00B4D8',
        description: 'Earn interest by lending your crypto to borrowers',
        howItWorks: 'Protocols like Aave and Compound pool deposits and algorithmically set interest rates based on supply/demand.',
        risks: ['Smart contract exploits', 'Liquidation cascades', 'Interest rate volatility'],
        advanced: {
            title: 'Advanced Lending',
            topics: [
                { name: 'Flash Loans', desc: 'Borrow millions without collateral—if you repay in the same transaction. Used for arbitrage.' },
                { name: 'Recursive Lending', desc: 'Deposit, borrow, re-deposit to amplify yields (and risks). Called "looping".' },
                { name: 'Isolated Markets', desc: 'Some protocols segment risky assets to protect main pools from contagion' },
                { name: 'Variable vs Fixed Rates', desc: 'Choose floating rates (Aave) or lock in fixed rates (Notional, Yield Protocol)' },
                { name: 'Health Factor', desc: 'Monitor this ratio to avoid liquidation. Below 1.0 = your collateral gets sold' },
            ]
        },
        relatedCourse: 'defi-fundamentals'
    },
    {
        id: 'staking',
        emoji: '🥩',
        label: 'Staking',
        color: '#9B59B6',
        description: 'Lock tokens to secure networks and earn rewards',
        howItWorks: 'Proof-of-stake networks reward validators for locking tokens. Liquid staking (Lido) gives you tradeable receipt tokens.',
        risks: ['Slashing penalties', 'Lock-up periods', 'Validator downtime'],
        advanced: {
            title: 'Advanced Staking',
            topics: [
                { name: 'Liquid Staking (stETH, rETH)', desc: 'Stake ETH and get tradeable tokens. Use them as collateral in DeFi while earning rewards.' },
                { name: 'Restaking (EigenLayer)', desc: 'Re-use your staked ETH to secure other protocols for additional yield' },
                { name: 'Validator Selection', desc: 'Choose validators with high uptime, good commission rates, and MEV-sharing policies' },
                { name: 'DVT (Distributed Validators)', desc: 'Split validator keys across multiple operators to reduce slashing risk' },
                { name: 'LST Depeg Risks', desc: 'Understand how liquid staking tokens can trade below par during market stress' },
            ]
        },
        relatedCourse: 'defi-fundamentals'
    },
    {
        id: 'bridging',
        emoji: '🌉',
        label: 'Bridging',
        color: '#2ECC71',
        description: 'Move assets between different blockchain networks',
        howItWorks: 'Bridges lock tokens on one chain and mint equivalent tokens on another. Some use validators, others use zero-knowledge proofs.',
        risks: ['Bridge hacks (major target)', 'Long confirmation times', 'Wrapped asset risks'],
        advanced: {
            title: 'Advanced Bridging',
            topics: [
                { name: 'Bridge Types', desc: 'Lock & Mint, Burn & Mint, Atomic Swaps, Liquidity Networks—each with different trust assumptions' },
                { name: 'Native vs Canonical', desc: 'Native bridges (rollup to L1) are safest. Third-party bridges are faster but riskier.' },
                { name: 'Intent-based Bridging', desc: 'Express your intent and solvers compete to fill it—often faster and cheaper' },
                { name: 'ZK Bridges', desc: 'Use zero-knowledge proofs to verify cross-chain state without trusting validators' },
                { name: 'Aggregators (Socket, LI.FI)', desc: 'Find best bridge routes across multiple solutions automatically' },
            ]
        },
        relatedCourse: 'blockchain-basics'
    },
    {
        id: 'yield',
        emoji: '🌾',
        label: 'Yield Farming',
        color: '#F39C12',
        description: 'Maximize returns by moving funds between protocols',
        howItWorks: 'Provide liquidity to earn trading fees + token rewards. Yield aggregators automate optimal strategies.',
        risks: ['Impermanent loss', 'Token emission dilution', 'Complex tax implications'],
        advanced: {
            title: 'Advanced Yield Strategies',
            topics: [
                { name: 'Auto-compounders (Yearn, Beefy)', desc: 'Automatically harvest and reinvest rewards for compound growth' },
                { name: 'Delta-neutral Strategies', desc: 'Hedge exposure to neutralize price movements, focus on pure yield' },
                { name: 'Concentrated Liquidity', desc: 'Uniswap V3 lets you focus liquidity in price ranges for higher fees' },
                { name: 'Points & Airdrops', desc: 'Participate early in protocols offering points that convert to tokens' },
                { name: 'Leverage Farming', desc: 'Borrow to amplify LP positions—multiplies both gains AND losses' },
            ]
        },
        relatedCourse: 'advanced-strategies'
    },
];

interface AdvancedTopic {
    name: string;
    desc: string;
}

interface ActivityInfo {
    id: string;
    emoji: string;
    label: string;
    color: string;
    description: string;
    howItWorks: string;
    risks: string[];
    advanced: {
        title: string;
        topics: AdvancedTopic[];
    };
    relatedCourse: string;
}

export default function LearnScreen() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState<CourseTab>('all');
    const [userCourses, setUserCourses] = useState<CourseProgress[]>([]);
    const [selectedActivity, setSelectedActivity] = useState<ActivityInfo | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const openTerm = useTerminologyStore((state) => state.openTerm);

    // Load user's course progress
    useEffect(() => {
        loadUserProgress();
    }, []);

    const loadUserProgress = async () => {
        try {
            const progressList: CourseProgress[] = [];
            for (const course of COURSES) {
                const stored = await AsyncStorage.getItem(PROGRESS_KEY + course.id);
                if (stored) {
                    const completed = JSON.parse(stored) as string[];
                    if (completed.length > 0) {
                        progressList.push({
                            courseId: course.id,
                            completedLessons: completed.length,
                            totalLessons: getTotalLessons(course),
                        });
                    }
                }
            }
            setUserCourses(progressList);
            // Auto-select tab based on progress
            const hasInProgress = progressList.some(p => p.completedLessons < p.totalLessons);
            if (hasInProgress) {
                setActiveTab('continue');
            }
        } catch (e) {
            console.error('Failed to load progress:', e);
        }
    };

    const openCourse = (courseId: string) => {
        router.push({
            pathname: '/(app)/course/[courseId]',
            params: { courseId },
        });
    };

    // Split courses into categories
    const inProgressCourses = userCourses.filter(p => p.completedLessons < p.totalLessons);
    const completedCourses = userCourses.filter(p => p.completedLessons >= p.totalLessons);

    // Filter for search
    const filteredTerms = searchQuery.trim()
        ? TERMINOLOGY.filter(t =>
            t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.shortDef.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    const filteredCourses = searchQuery.trim()
        ? COURSES.filter(c =>
            c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : [];

    // Render course card
    const renderCourseCard = (course: Course, progress?: CourseProgress) => {
        const isCompleted = progress && progress.completedLessons >= progress.totalLessons;
        const isInProgress = progress && progress.completedLessons < progress.totalLessons;
        const percent = progress ? progress.completedLessons / progress.totalLessons : 0;

        return (
            <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => openCourse(course.id)}
                activeOpacity={0.7}
            >
                <Text style={styles.courseEmoji}>{course.emoji}</Text>
                <View style={styles.courseContent}>
                    <Text style={styles.courseTitle}>{course.title}</Text>
                    {isInProgress ? (
                        <View>
                            <Text style={styles.courseProgress}>
                                {progress.completedLessons}/{progress.totalLessons} lessons
                            </Text>
                            <View style={styles.progressBar}>
                                <View style={[styles.progressFill, { width: `${percent * 100}%` }]} />
                            </View>
                        </View>
                    ) : isCompleted ? (
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                            <Text style={styles.completedText}>Completed</Text>
                        </View>
                    ) : (
                        <Text style={styles.courseMeta}>
                            {course.duration} • {getTotalLessons(course)} lessons
                        </Text>
                    )}
                </View>
                <View style={[
                    styles.courseAction,
                    isCompleted && styles.courseActionCompleted
                ]}>
                    <Ionicons
                        name={isInProgress ? "play" : isCompleted ? "refresh" : "chevron-forward"}
                        size={16}
                        color={isCompleted ? Colors.success : "#fff"}
                    />
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Search Bar */}
                <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color={Colors.textMuted} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search courses & terms..."
                            placeholderTextColor={Colors.textMuted}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Search Results */}
                    {searchQuery.trim().length > 0 && (
                        <View style={styles.searchResults}>
                            {filteredCourses.length === 0 && filteredTerms.length === 0 ? (
                                <Text style={styles.noResults}>No results found</Text>
                            ) : (
                                <>
                                    {filteredCourses.slice(0, 3).map((course) => (
                                        <TouchableOpacity
                                            key={course.id}
                                            style={styles.searchResultItem}
                                            onPress={() => {
                                                openCourse(course.id);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <View style={styles.searchResultLeft}>
                                                <Text style={styles.searchResultEmoji}>{course.emoji}</Text>
                                                <View>
                                                    <Text style={styles.searchResultTerm}>{course.title}</Text>
                                                    <Text style={styles.searchResultDef}>{course.difficulty}</Text>
                                                </View>
                                            </View>
                                            <Text style={styles.searchResultType}>Course</Text>
                                        </TouchableOpacity>
                                    ))}
                                    {filteredTerms.slice(0, 3).map((term) => (
                                        <TouchableOpacity
                                            key={term.id}
                                            style={styles.searchResultItem}
                                            onPress={() => {
                                                openTerm(term.term);
                                                setSearchQuery('');
                                            }}
                                        >
                                            <View style={styles.searchResultLeft}>
                                                <Text style={styles.searchResultEmoji}>📖</Text>
                                                <View>
                                                    <Text style={styles.searchResultTerm}>{term.term}</Text>
                                                    <Text style={styles.searchResultDef} numberOfLines={1}>
                                                        {term.shortDef}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.searchResultType}>Term</Text>
                                        </TouchableOpacity>
                                    ))}
                                </>
                            )}
                        </View>
                    )}
                </Animated.View>

                {/* Browse Glossary Card */}
                <TouchableOpacity
                    style={styles.glossaryCard}
                    onPress={() => router.push('/(app)/glossary')}
                    activeOpacity={0.8}
                >
                    <View style={styles.glossaryIcon}>
                        <Ionicons name="book" size={20} color="#fff" />
                    </View>
                    <View style={styles.glossaryContent}>
                        <Text style={styles.glossaryTitle}>Browse Glossary</Text>
                        <Text style={styles.glossaryDesc}>Master {TERMINOLOGY.length}+ DeFi terms</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                </TouchableOpacity>

                {/* Ecosystem Overview */}
                <Animated.View entering={FadeInDown.delay(200).duration(400)} style={{ marginBottom: Spacing.lg }}>
                    <EcosystemOverview />
                </Animated.View>

                {/* DeFi Activities Section */}
                <Animated.View entering={FadeInDown.delay(250).duration(400)} style={{ marginBottom: Spacing.xl }}>
                    <View style={styles.activitiesSection}>
                        <Text style={styles.activitiesHeader}>DeFi Activities</Text>
                        <Text style={styles.activitiesSubheader}>Learn what you can do in DeFi</Text>

                        <View style={styles.activitiesGrid}>
                            {DEFI_ACTIVITIES.map(activity => (
                                <TouchableOpacity
                                    key={activity.id}
                                    style={[styles.activityCard, { borderColor: activity.color + '50' }]}
                                    onPress={() => {
                                        setShowAdvanced(false);
                                        setSelectedActivity(activity);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.activityEmoji}>{activity.emoji}</Text>
                                    <Text style={[styles.activityLabel, { color: activity.color }]}>{activity.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </Animated.View>

                {/* Courses Section with Tabs */}
                <View style={styles.coursesSection}>
                    <Text style={styles.coursesHeader}>Courses</Text>

                    {/* Tab Navigation */}
                    <View style={styles.tabContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'continue' && styles.tabActive]}
                            onPress={() => setActiveTab('continue')}
                        >
                            <Text style={[styles.tabText, activeTab === 'continue' && styles.tabTextActive]}>
                                In Progress {inProgressCourses.length > 0 && `(${inProgressCourses.length})`}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
                            onPress={() => setActiveTab('all')}
                        >
                            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                                All
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
                            onPress={() => setActiveTab('completed')}
                        >
                            <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
                                Done {completedCourses.length > 0 && `(${completedCourses.length})`}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tab Content */}
                    <Animated.View entering={FadeIn.duration(200)}>
                        {activeTab === 'continue' && (
                            inProgressCourses.length > 0 ? (
                                inProgressCourses.map((progress) => {
                                    const course = COURSES.find(c => c.id === progress.courseId);
                                    return course ? renderCourseCard(course, progress) : null;
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="play-circle-outline" size={40} color={Colors.textMuted} />
                                    <Text style={styles.emptyTitle}>No courses in progress</Text>
                                    <Text style={styles.emptyDesc}>Start a course from the "All" tab</Text>
                                </View>
                            )
                        )}

                        {activeTab === 'all' && (
                            <>
                                {(['beginner', 'intermediate', 'advanced'] as const).map((difficulty) => {
                                    const courses = getCoursesByDifficulty(difficulty);
                                    const difficultyEmoji = difficulty === 'beginner' ? '🌱' : difficulty === 'intermediate' ? '📈' : '🔥';
                                    const difficultyColor = difficulty === 'beginner' ? Colors.success : difficulty === 'intermediate' ? Colors.warning : Colors.error;

                                    return (
                                        <View key={difficulty} style={styles.difficultyGroup}>
                                            <Text style={[styles.difficultyLabel, { color: difficultyColor }]}>
                                                {difficultyEmoji} {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
                                            </Text>
                                            {courses.map((course) => {
                                                const progress = userCourses.find(p => p.courseId === course.id);
                                                return renderCourseCard(course, progress);
                                            })}
                                        </View>
                                    );
                                })}
                            </>
                        )}

                        {activeTab === 'completed' && (
                            completedCourses.length > 0 ? (
                                completedCourses.map((progress) => {
                                    const course = COURSES.find(c => c.id === progress.courseId);
                                    return course ? renderCourseCard(course, progress) : null;
                                })
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="trophy-outline" size={40} color={Colors.textMuted} />
                                    <Text style={styles.emptyTitle}>No completed courses yet</Text>
                                    <Text style={styles.emptyDesc}>Finish a course to earn your badge!</Text>
                                </View>
                            )
                        )}
                    </Animated.View>
                </View>

                {/* Attribution */}
                <View style={styles.attribution}>
                    <Text style={styles.attributionText}>
                        Content curated from Binance Academy, Investopedia, and more.
                    </Text>
                </View>
            </ScrollView>

            {/* Activity Info Modal */}
            <Modal visible={!!selectedActivity} transparent animationType="fade">
                <Pressable style={styles.modalOverlay} onPress={() => setSelectedActivity(null)}>
                    <Pressable style={styles.activityModal}>
                        {selectedActivity && (
                            <>
                                <View style={styles.activityModalHeader}>
                                    <Text style={styles.activityModalEmoji}>{selectedActivity.emoji}</Text>
                                    <Text style={[styles.activityModalTitle, { color: selectedActivity.color }]}>
                                        {selectedActivity.label}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.activityModalClose}
                                        onPress={() => setSelectedActivity(null)}
                                    >
                                        <Ionicons name="close" size={22} color={Colors.textMuted} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView style={styles.activityModalScroll} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.activityModalDesc}>{selectedActivity.description}</Text>

                                    <View style={styles.activityModalSection}>
                                        <Text style={styles.activityModalSectionTitle}>⚙️ How it works</Text>
                                        <Text style={styles.activityModalText}>{selectedActivity.howItWorks}</Text>
                                    </View>

                                    <View style={styles.activityModalSection}>
                                        <Text style={styles.activityModalSectionTitle}>⚠️ Risks to know</Text>
                                        {selectedActivity.risks.map((risk, i) => (
                                            <View key={i} style={styles.riskItem}>
                                                <View style={styles.riskDot} />
                                                <Text style={styles.riskText}>{risk}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Advanced Section - Collapsible */}
                                    <TouchableOpacity
                                        style={[styles.activityModalSection, styles.advancedSection]}
                                        onPress={() => setShowAdvanced(!showAdvanced)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={styles.advancedHeader}>
                                            <Ionicons name="rocket" size={16} color={Colors.primary} />
                                            <Text style={styles.advancedTitle}>{selectedActivity.advanced.title}</Text>
                                            <View style={{ flex: 1 }} />
                                            <Ionicons
                                                name={showAdvanced ? "chevron-up" : "chevron-down"}
                                                size={18}
                                                color={Colors.primary}
                                            />
                                        </View>
                                        {!showAdvanced && (
                                            <Text style={styles.advancedHint}>Tap to see {selectedActivity.advanced.topics.length} advanced topics</Text>
                                        )}
                                    </TouchableOpacity>

                                    {showAdvanced && (
                                        <View style={styles.advancedTopics}>
                                            {selectedActivity.advanced.topics.map((topic, i) => (
                                                <View key={i} style={styles.advancedTopic}>
                                                    <Text style={styles.advancedTopicName}>{topic.name}</Text>
                                                    <Text style={styles.advancedTopicDesc}>{topic.desc}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </ScrollView>

                                <TouchableOpacity
                                    style={[styles.takeCourseBtn, { backgroundColor: selectedActivity.color }]}
                                    onPress={() => {
                                        setSelectedActivity(null);
                                        router.push({
                                            pathname: '/(app)/course/[courseId]',
                                            params: { courseId: selectedActivity.relatedCourse }
                                        });
                                    }}
                                >
                                    <Ionicons name="book" size={18} color="#fff" />
                                    <Text style={styles.takeCourseBtnText}>Take Related Course</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    content: {
        padding: Spacing.lg,
        paddingBottom: Spacing['3xl'],
    },

    // Search
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.sm,
    },
    searchInput: {
        flex: 1,
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
    },
    searchResults: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
        overflow: 'hidden',
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    searchResultLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    searchResultEmoji: {
        fontSize: 24,
    },
    searchResultTerm: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    searchResultDef: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        maxWidth: 200,
    },
    searchResultType: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        fontWeight: '500',
        textTransform: 'uppercase',
    },
    noResults: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        textAlign: 'center',
        padding: Spacing.lg,
    },

    // Glossary Card
    glossaryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    glossaryIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glossaryContent: {
        flex: 1,
    },
    glossaryTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    glossaryDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },

    // Go Live Card
    goLiveCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.success + '15',
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.success + '30',
        gap: Spacing.md,
    },
    goLiveIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    goLiveContent: {
        flex: 1,
    },
    goLiveTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.success,
    },
    goLiveDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },

    // Courses Section
    coursesSection: {
        flex: 1,
    },
    coursesHeader: {
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.md,
    },

    // Tab Navigation
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: 4,
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    tab: {
        flex: 1,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: Colors.primary,
    },
    tabText: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '500',
        color: Colors.textMuted,
    },
    tabTextActive: {
        color: '#fff',
    },

    // Difficulty Groups
    difficultyGroup: {
        marginBottom: Spacing.lg,
    },
    difficultyLabel: {
        fontSize: Typography.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
    },

    // Course Cards
    courseCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
        gap: Spacing.md,
    },
    courseEmoji: {
        fontSize: 28,
    },
    courseContent: {
        flex: 1,
    },
    courseTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    courseMeta: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
    },
    courseProgress: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
        marginBottom: 4,
    },
    progressBar: {
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 2,
    },
    courseAction: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    courseActionCompleted: {
        backgroundColor: Colors.success + '20',
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    completedText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.success,
        fontWeight: '500',
    },

    // Empty States
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing['2xl'],
        paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginTop: Spacing.md,
    },
    emptyDesc: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textMuted,
        marginTop: Spacing.xs,
        textAlign: 'center',
    },

    // Attribution
    attribution: {
        marginTop: Spacing.xl,
        alignItems: 'center',
    },
    attributionText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textAlign: 'center',
    },

    // Activities Section
    activitiesSection: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    activitiesHeader: {
        fontSize: Typography.fontSize.lg,
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    activitiesSubheader: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
        marginBottom: Spacing.md,
    },
    activitiesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        backgroundColor: Colors.background,
    },
    activityEmoji: {
        fontSize: 18,
    },
    activityLabel: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
    },

    // Activity Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: Spacing.lg,
    },
    activityModal: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    activityModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    activityModalEmoji: {
        fontSize: 32,
    },
    activityModalTitle: {
        flex: 1,
        fontSize: Typography.fontSize.xl,
        fontWeight: '700',
    },
    activityModalClose: {
        padding: 4,
    },
    activityModalDesc: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        lineHeight: 22,
        marginBottom: Spacing.lg,
    },
    activityModalSection: {
        marginBottom: Spacing.md,
    },
    activityModalSectionTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    activityModalText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    riskItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: 4,
    },
    riskDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: Colors.warning,
    },
    riskText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
    },
    takeCourseBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.md,
    },
    takeCourseBtnText: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: '#fff',
    },

    // Advanced Section
    activityModalScroll: {
        maxHeight: 400,
    },
    advancedSection: {
        backgroundColor: Colors.primary + '08',
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.primary + '20',
    },
    advancedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    advancedTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    advancedHint: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        marginTop: Spacing.xs,
    },
    advancedTopics: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    advancedTopic: {
        marginBottom: Spacing.sm,
    },
    advancedTopicName: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    advancedTopicDesc: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        marginTop: 2,
        lineHeight: 16,
    },
});
