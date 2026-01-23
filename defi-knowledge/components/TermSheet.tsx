// TermSheet Component - Bottom sheet displaying term definitions
// Uses RECURSIVE inline expansion - terms within expanded cards are also clickable

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Pressable,
    Modal,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    runOnJS,
    FadeIn,
    FadeOut,
} from 'react-native-reanimated';
import {
    Gesture,
    GestureDetector,
    GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { Colors, Typography, Spacing, BorderRadius } from '@/constants/Colors';
import { useTerminologyStore } from '@/context/TerminologyContext';
import { CATEGORY_INFO, Term, findTerm } from '@/lib/terminology';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.6; // Slightly taller for nested content
const DISMISS_THRESHOLD = 100;

export function TermSheet() {
    const { isVisible, termStack, currentTerm, goBack, close } = useTerminologyStore();
    const term = currentTerm();

    // Stack of expanded terms (for nested expansion)
    const [expandedStack, setExpandedStack] = useState<Term[]>([]);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const context = useSharedValue({ y: 0 });

    // Clear expanded stack when main term changes
    useEffect(() => {
        setExpandedStack([]);
    }, [term?.id]);

    useEffect(() => {
        if (isVisible) {
            // Smooth slide up - no bounce
            translateY.value = withTiming(0, { duration: 250 });
        } else {
            translateY.value = withTiming(SHEET_HEIGHT, { duration: 200 });
            setExpandedStack([]);
        }
    }, [isVisible]);

    const gesture = Gesture.Pan()
        .onStart(() => {
            context.value = { y: translateY.value };
        })
        .onUpdate((event) => {
            translateY.value = Math.max(0, context.value.y + event.translationY);
        })
        .onEnd((event) => {
            if (translateY.value > DISMISS_THRESHOLD || event.velocityY > 500) {
                translateY.value = withTiming(SHEET_HEIGHT, { duration: 200 });
                runOnJS(close)();
            } else {
                // Smooth snap back - no bounce
                translateY.value = withTiming(0, { duration: 150 });
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: withTiming(isVisible ? 1 : 0, { duration: 200 }),
    }));

    // Handle term expansion - adds to stack
    const handleExpandTerm = (termName: string, depth: number) => {
        const foundTerm = findTerm(termName);
        if (foundTerm) {
            // Check if already in stack at this depth
            if (expandedStack[depth]?.id === foundTerm.id) {
                // Collapse this and all deeper levels
                setExpandedStack(prev => prev.slice(0, depth));
            } else {
                // Replace at this depth and remove deeper levels
                setExpandedStack(prev => [...prev.slice(0, depth), foundTerm]);
            }
        }
    };

    // Close a specific level and all below it
    const handleCloseLevel = (depth: number) => {
        setExpandedStack(prev => prev.slice(0, depth));
    };

    if (!term) return null;

    const categoryInfo = CATEGORY_INFO[term.category];
    const hasHistory = termStack.length > 1;
    const previousTerm = hasHistory ? termStack[termStack.length - 2] : null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="none"
            onRequestClose={close}
        >
            <GestureHandlerRootView style={styles.gestureRoot}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} />
                </Animated.View>

                {/* Sheet */}
                <GestureDetector gesture={gesture}>
                    <Animated.View style={[styles.sheet, animatedStyle]}>
                        {/* Handle */}
                        <View style={styles.handleContainer}>
                            <View style={styles.handle} />
                        </View>

                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                {hasHistory && (
                                    <TouchableOpacity onPress={goBack} style={styles.backButton}>
                                        <Ionicons name="chevron-back" size={20} color={Colors.primary} />
                                        <Text style={styles.backText} numberOfLines={1}>
                                            {previousTerm?.term}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity onPress={close} style={styles.closeButton}>
                                <Ionicons name="close" size={22} color={Colors.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {/* Content */}
                        <ScrollView
                            style={styles.content}
                            contentContainerStyle={styles.contentContainer}
                            showsVerticalScrollIndicator={false}
                        >
                            {/* Category Badge */}
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryEmoji}>{categoryInfo.emoji}</Text>
                                <Text style={styles.categoryLabel}>{categoryInfo.label}</Text>
                            </View>

                            {/* Term Title */}
                            <Text style={styles.termTitle}>{term.term}</Text>

                            {/* Short Definition */}
                            <Text style={styles.shortDef}>{term.shortDef}</Text>

                            {/* Full Definition with inline linked terms */}
                            <View style={styles.fullDefContainer}>
                                <ClickableTermText
                                    text={term.fullDef}
                                    onTermPress={(termName) => handleExpandTerm(termName, 0)}
                                    expandedStack={expandedStack}
                                    depth={0}
                                />
                            </View>

                            {/* Recursive Expanded Cards */}
                            {expandedStack.map((expandedTerm, index) => (
                                <ExpandedTermCard
                                    key={`${expandedTerm.id}-${index}`}
                                    term={expandedTerm}
                                    depth={index}
                                    onClose={() => handleCloseLevel(index)}
                                    onTermPress={(termName) => handleExpandTerm(termName, index + 1)}
                                    expandedStack={expandedStack}
                                />
                            ))}


                            {/* Depth Indicator */}
                            {expandedStack.length > 0 && (
                                <View style={styles.depthIndicator}>
                                    <Ionicons name="layers-outline" size={14} color={Colors.textMuted} />
                                    <Text style={styles.depthText}>
                                        {expandedStack.length} {expandedStack.length === 1 ? 'level' : 'levels'} deep
                                    </Text>
                                    <TouchableOpacity onPress={() => setExpandedStack([])}>
                                        <Text style={styles.collapseAllText}>Collapse All</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </Animated.View>
                </GestureDetector>
            </GestureHandlerRootView>
        </Modal>
    );
}

// Expanded Term Card Component - renders a nested expandable card
interface ExpandedTermCardProps {
    term: Term;
    depth: number;
    onClose: () => void;
    onTermPress: (termName: string) => void;
    expandedStack: Term[];
}

function ExpandedTermCard({ term, depth, onClose, onTermPress, expandedStack }: ExpandedTermCardProps) {
    const categoryInfo = CATEGORY_INFO[term.category];

    // Calculate nesting indent (subtle visual hierarchy)
    const marginLeft = Math.min(depth * 8, 24);

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={[
                styles.inlineCard,
                { marginLeft },
                depth > 0 && styles.nestedCard,
            ]}
        >
            <View style={styles.inlineCardHeader}>
                <View style={styles.inlineCardTitleRow}>
                    <Text style={styles.inlineCardEmoji}>{categoryInfo.emoji}</Text>
                    <Text style={styles.inlineCardTitle}>{term.term}</Text>
                    <View style={styles.depthBadge}>
                        <Text style={styles.depthBadgeText}>L{depth + 1}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={onClose}
                    style={styles.inlineCardClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
            </View>

            <Text style={styles.inlineCardShortDef}>{term.shortDef}</Text>

            {/* Clickable full definition */}
            <View style={styles.inlineCardDefContainer}>
                <ClickableTermText
                    text={term.fullDef}
                    onTermPress={onTermPress}
                    expandedStack={expandedStack}
                    depth={depth + 1}
                />
            </View>
        </Animated.View>
    );
}

// Clickable Term Text - renders text with tappable [[terms]]
interface ClickableTermTextProps {
    text: string;
    onTermPress: (termName: string) => void;
    expandedStack: Term[];
    depth: number;
}

function ClickableTermText({ text, onTermPress, expandedStack, depth }: ClickableTermTextProps) {
    const regex = /\[\[([^\]]+)\]\]/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(text)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            parts.push(
                <Text key={key++}>
                    {text.slice(lastIndex, match.index)}
                </Text>
            );
        }

        // Add the linked term
        const termName = match[1];
        const termData = findTerm(termName);
        const isExpanded = expandedStack[depth]?.term === termName;

        if (termData) {
            parts.push(
                <Text
                    key={key++}
                    style={[styles.linkedTerm, isExpanded && styles.linkedTermActive]}
                    onPress={() => onTermPress(termName)}
                >
                    {termName}
                </Text>
            );
        } else {
            // Term not in our database - show as regular text
            parts.push(
                <Text key={key++}>{termName}</Text>
            );
        }

        lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(
            <Text key={key++}>{text.slice(lastIndex)}</Text>
        );
    }

    return <Text style={styles.defText}>{parts}</Text>;
}

const styles = StyleSheet.create({
    gestureRoot: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SHEET_HEIGHT,
        backgroundColor: Colors.surfaceElevated,
        borderTopLeftRadius: BorderRadius['2xl'],
        borderTopRightRadius: BorderRadius['2xl'],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 16,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    handle: {
        width: 36,
        height: 4,
        backgroundColor: Colors.border,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    backText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.primary,
        maxWidth: 150,
    },
    closeButton: {
        padding: Spacing.xs,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: Spacing.lg,
        paddingBottom: Spacing['5xl'],
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    categoryEmoji: {
        fontSize: 14,
    },
    categoryLabel: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    termTitle: {
        fontSize: Typography.fontSize['2xl'],
        fontWeight: '700',
        color: Colors.textPrimary,
        marginBottom: Spacing.xs,
    },
    shortDef: {
        fontSize: Typography.fontSize.base,
        color: Colors.textSecondary,
        marginBottom: Spacing.lg,
    },
    fullDefContainer: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    defText: {
        fontSize: Typography.fontSize.base,
        color: Colors.textPrimary,
        lineHeight: Typography.fontSize.base * 1.7,
    },
    linkedTerm: {
        color: Colors.primary,
        fontWeight: '600',
    },
    linkedTermActive: {
        backgroundColor: Colors.primary + '30',
    },

    // Inline expanded card
    inlineCard: {
        marginTop: Spacing.md,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        borderWidth: 1,
        borderColor: Colors.primary + '40',
    },
    nestedCard: {
        borderColor: Colors.secondary + '40',
        backgroundColor: Colors.background,
    },
    inlineCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    inlineCardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        flex: 1,
    },
    inlineCardEmoji: {
        fontSize: 14,
    },
    inlineCardTitle: {
        fontSize: Typography.fontSize.base,
        fontWeight: '600',
        color: Colors.primary,
        flex: 1,
    },
    depthBadge: {
        backgroundColor: Colors.primary + '20',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    depthBadgeText: {
        fontSize: 10,
        color: Colors.primary,
        fontWeight: '600',
    },
    inlineCardClose: {
        padding: 2,
    },
    inlineCardShortDef: {
        fontSize: Typography.fontSize.sm,
        color: Colors.textSecondary,
        marginBottom: Spacing.sm,
        fontStyle: 'italic',
    },
    inlineCardDefContainer: {
        backgroundColor: Colors.surfaceElevated,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
    },

    // Related section
    relatedSection: {
        marginTop: Spacing.xl,
    },
    relatedTitle: {
        fontSize: Typography.fontSize.sm,
        fontWeight: '600',
        color: Colors.textSecondary,
        marginBottom: Spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    relatedTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    relatedTag: {
        backgroundColor: Colors.surface,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    relatedTagActive: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primary + '20',
    },
    relatedTagText: {
        fontSize: Typography.fontSize.sm,
        color: Colors.primary,
        fontWeight: '500',
    },
    relatedTagTextActive: {
        color: Colors.primary,
    },

    // Depth indicator
    depthIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.xl,
        paddingTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
    },
    depthText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.textMuted,
    },
    collapseAllText: {
        fontSize: Typography.fontSize.xs,
        color: Colors.primary,
        fontWeight: '500',
    },
});
