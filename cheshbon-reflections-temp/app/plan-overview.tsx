import { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Typography } from '../components/ui/Typography';
import { DayListItem } from '../components/ui/DayListItem';
import { Colors, Spacing } from '../constants/theme';
import { getPlanById, getReflectionByPlanAndDay, type ReadingPlan } from '../services/database';
import { generateReadingPlan } from '../services/planGenerator';

const PLAN_NAMES: Record<string, string> = {
    canonical: 'Canonical Path',
    chronological: 'Chronological Path',
    nt90: 'NT in 90 Days',
    wisdom: 'Psalms & Proverbs',
    custom: 'Custom Path',
};

export default function PlanOverview() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const planId = Number(params.planId);

    const [plan, setPlan] = useState<ReadingPlan | null>(null);
    const [completedDays, setCompletedDays] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadPlan();
    }, [planId]);

    async function loadPlan() {
        try {
            const planData = await getPlanById(planId);
            if (!planData) {
                console.error('Plan not found');
                router.back();
                return;
            }

            setPlan(planData);

            // Check which days have reflections
            const completed = new Set<number>();
            for (let day = 1; day < planData.current_day; day++) {
                const reflection = await getReflectionByPlanAndDay(planId, day);
                if (reflection) {
                    completed.add(day);
                }
            }
            setCompletedDays(completed);
        } catch (error) {
            console.error('Error loading plan:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleDayPress(dayNumber: number) {
        if (!plan) return;

        const isCompleted = completedDays.has(dayNumber);
        const isCurrent = dayNumber === plan.current_day;

        if (isCompleted || isCurrent) {
            router.push({
                pathname: '/daily',
                params: {
                    planId,
                    dayNumber,
                    mode: isCompleted ? 'review' : 'edit',
                },
            });
        }
    }

    if (loading || !plan) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.gold} />
            </View>
        );
    }

    const days = Array.from({ length: plan.duration }, (_, i) => i + 1);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Typography variant="h1">{PLAN_NAMES[plan.type]}</Typography>
                <Typography variant="body" color={Colors.mediumGray} style={styles.subtitle}>
                    {plan.current_day} of {plan.duration} days completed
                </Typography>
            </View>

            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                {days.map((day) => {
                    const isCompleted = completedDays.has(day);
                    const isCurrent = day === plan.current_day;
                    const isFuture = day > plan.current_day;

                    return (
                        <DayListItem
                            key={day}
                            dayNumber={day}
                            isCompleted={isCompleted}
                            isCurrent={isCurrent}
                            disabled={isFuture}
                            onPress={() => handleDayPress(day)}
                        />
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.cream,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: Colors.cream,
        alignItems: 'center',
        justifyContent: 'center',
    },
    header: {
        padding: Spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
        backgroundColor: Colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Colors.lightGray,
        alignItems: 'center',
    },
    subtitle: {
        marginTop: Spacing.xs,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
    },
});
