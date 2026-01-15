import { useState } from 'react';
import {
    View,
    Text,
    Pressable,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { WORKOUT_TEMPLATES, WorkoutTemplate } from '../data/workoutTemplates';

export default function TemplateSelectionScreen() {
    const router = useRouter();
    const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);

    const handleStartFromScratch = () => {
        router.push('/plan-wizard');
    };

    const handleSelectTemplate = (template: WorkoutTemplate) => {
        router.push({
            pathname: '/template-preview',
            params: { templateId: template.id },
        });
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
                <Text style={styles.headerTitle}>Create Plan</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
                {/* Start from Scratch Option */}
                <Pressable
                    style={styles.scratchCard}
                    onPress={handleStartFromScratch}
                >
                    <View style={styles.scratchIcon}>
                        <Text style={styles.scratchEmoji}>✏️</Text>
                    </View>
                    <View style={styles.scratchContent}>
                        <Text style={styles.scratchTitle}>Start from Scratch</Text>
                        <Text style={styles.scratchSubtitle}>Build your custom workout plan step by step</Text>
                    </View>
                    <Text style={styles.scratchArrow}>→</Text>
                </Pressable>

                {/* Divider */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR CHOOSE A TEMPLATE</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Template Categories */}
                <View style={styles.templatesGrid}>
                    {WORKOUT_TEMPLATES.map((template) => (
                        <Pressable
                            key={template.id}
                            style={styles.templateCard}
                            onPress={() => handleSelectTemplate(template)}
                        >
                            <View style={styles.templateHeader}>
                                <Text style={styles.templateEmoji}>{template.emoji}</Text>
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

                            <Text style={styles.templateName}>{template.name}</Text>
                            <Text style={styles.templateDescription}>{template.description}</Text>

                            <View style={styles.templateMeta}>
                                <Text style={styles.templateMetaText}>
                                    📅 {template.daysPerWeek} days/week
                                </Text>
                                <Text style={styles.templateMetaText}>
                                    💪 {template.days.reduce((sum, d) => sum + d.exercises.length, 0)} exercises
                                </Text>
                            </View>

                            <View style={styles.templateFooter}>
                                <Text style={styles.templateAudience}>{template.targetAudience}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            </ScrollView>
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
        paddingBottom: 40,
    },

    // Start from Scratch
    scratchCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        borderColor: '#7CFC00',
        marginBottom: 24,
    },
    scratchIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#1a2e1a',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    scratchEmoji: {
        fontSize: 24,
    },
    scratchContent: {
        flex: 1,
    },
    scratchTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
    },
    scratchSubtitle: {
        fontSize: 14,
        color: '#94a3b8',
        marginTop: 4,
    },
    scratchArrow: {
        fontSize: 20,
        color: '#7CFC00',
        fontWeight: '600',
    },

    // Divider
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#1e293b',
    },
    dividerText: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '600',
        paddingHorizontal: 16,
        letterSpacing: 0.5,
    },

    // Templates Grid
    templatesGrid: {
        gap: 16,
    },
    templateCard: {
        backgroundColor: '#151b24',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1e293b',
    },
    templateHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    templateEmoji: {
        fontSize: 32,
    },
    difficultyBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    difficultyText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'capitalize',
    },
    templateName: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    templateDescription: {
        fontSize: 14,
        color: '#94a3b8',
        lineHeight: 20,
        marginBottom: 12,
    },
    templateMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    templateMetaText: {
        fontSize: 13,
        color: '#64748b',
    },
    templateFooter: {
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#1e293b',
    },
    templateAudience: {
        fontSize: 12,
        color: '#7CFC00',
        fontWeight: '500',
    },
});
