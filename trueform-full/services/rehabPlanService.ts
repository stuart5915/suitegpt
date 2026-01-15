/**
 * Rehab Plan Service
 * 
 * Manages rehabilitation plans created from movement reports.
 * Handles plan creation, exercise tracking, and progress monitoring.
 */

import { supabase } from './supabase';

// ============================================
// TYPES
// ============================================

export interface RehabExercise {
    id: string;
    name: string;
    sets?: number;
    reps_or_duration: string; // e.g., "15 reps" or "30 seconds"
    frequency_per_week: number;
    description: string;
    notes?: string; // e.g., "Focus on form" or "Add resistance band if comfortable"
}

// Week-based exercise structure for progressive plans
export interface WeeklyExercises {
    week: number;              // 1-6
    phase: 'acute' | 'subacute' | 'strengthening' | 'maintenance';
    phaseGoal?: string;        // e.g., "Reduce inflammation, gentle mobility"
    weekTip?: string;          // Single tip for the week (e.g., "Focus on form")
    exercises: RehabExercise[];
}

export interface RehabPlan {
    id: string;
    user_id: string;
    source_report_id?: string;
    title: string;
    duration_weeks: number;
    exercises_per_day: number;
    check_in_frequency: string;
    ai_reasoning?: string;
    exercises: RehabExercise[];           // Flat list (legacy/fallback)
    exercises_by_week?: WeeklyExercises[]; // Progressive week-by-week structure
    progression_strategy?: string;         // AI explanation of progression
    status: 'active' | 'completed' | 'abandoned';
    started_at: string;
    completed_at?: string;
    created_at: string;
}

export interface ExerciseCompletion {
    id: string;
    plan_id: string;
    user_id: string;
    exercise_id: string;
    completed_at: string;
    pain_level?: number;
    notes?: string;
}

export interface PlanProgress {
    totalDays: number;
    daysCompleted: number;
    currentWeek: number;
    totalWeeks: number;
    percentComplete: number;
    todaysExercises: { exercise: RehabExercise; completed: boolean }[];
    daysUntilCheckIn: number;
}

// ============================================
// PLAN CRUD
// ============================================

/**
 * Create a new rehab plan from a movement report
 */
export const createRehabPlan = async (params: {
    sourceReportId?: string;
    title: string;
    durationWeeks: number;
    exercisesPerDay: number;
    checkInFrequency?: string;
    aiReasoning?: string;
    exercises: RehabExercise[];
    exercisesByWeek?: WeeklyExercises[];   // Progressive week-by-week structure
    progressionStrategy?: string;           // AI explanation of progression
}): Promise<{ data: RehabPlan | null; error: any }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const { data, error } = await supabase
        .from('rehab_plans')
        .insert({
            user_id: user.id,
            source_report_id: params.sourceReportId,
            title: params.title,
            duration_weeks: params.durationWeeks,
            exercises_per_day: params.exercisesPerDay,
            check_in_frequency: params.checkInFrequency || 'weekly',
            ai_reasoning: params.aiReasoning,
            exercises: params.exercises,
            exercises_by_week: params.exercisesByWeek || null,
            progression_strategy: params.progressionStrategy || null,
            status: 'active',
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    return { data, error };
};

/**
 * Get user's currently active plan
 */
export const getActivePlan = async (): Promise<{ data: RehabPlan | null; error: any }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const { data, error } = await supabase
        .from('rehab_plans')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    return { data, error };
};

/**
 * Complete a plan (mark as finished)
 */
export const completePlan = async (planId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('rehab_plans')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

    return { error };
};

/**
 * Abandon/cancel a plan
 */
export const abandonPlan = async (planId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('rehab_plans')
        .update({
            status: 'abandoned',
            updated_at: new Date().toISOString(),
        })
        .eq('id', planId);

    return { error };
};

// ============================================
// EXERCISE COMPLETION TRACKING
// ============================================

/**
 * Mark an exercise as completed for today
 */
export const markExerciseComplete = async (
    planId: string,
    exerciseId: string,
    painLevel?: number,
    notes?: string
): Promise<{ data: ExerciseCompletion | null; error: any }> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: { message: 'Not authenticated' } };

    const { data, error } = await supabase
        .from('exercise_completions')
        .insert({
            plan_id: planId,
            user_id: user.id,
            exercise_id: exerciseId,
            pain_level: painLevel,
            notes: notes,
        })
        .select()
        .single();

    return { data, error };
};

/**
 * Get today's completions for a plan
 */
export const getTodaysCompletions = async (planId: string): Promise<{ data: ExerciseCompletion[]; error: any }> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
        .from('exercise_completions')
        .select('*')
        .eq('plan_id', planId)
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

    return { data: data || [], error };
};

/**
 * Remove a completion (undo)
 */
export const removeCompletion = async (completionId: string): Promise<{ error: any }> => {
    const { error } = await supabase
        .from('exercise_completions')
        .delete()
        .eq('id', completionId);

    return { error };
};

/**
 * Unmark an exercise as completed for today (toggle off)
 */
export const unmarkExerciseComplete = async (
    planId: string,
    exerciseId: string
): Promise<{ error: any }> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { error } = await supabase
        .from('exercise_completions')
        .delete()
        .eq('plan_id', planId)
        .eq('exercise_id', exerciseId)
        .gte('completed_at', today.toISOString())
        .lt('completed_at', tomorrow.toISOString());

    return { error };
};

// ============================================
// PROGRESS & ANALYTICS
// ============================================

/**
 * Calculate plan progress and today's exercises
 */
export const getPlanProgress = async (plan: RehabPlan): Promise<PlanProgress> => {
    const startDate = new Date(plan.started_at);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = plan.duration_weeks * 7;
    const currentWeek = Math.min(Math.floor(daysSinceStart / 7) + 1, plan.duration_weeks);

    // Get today's completions
    const { data: todaysCompletions } = await getTodaysCompletions(plan.id);
    const completedIds = new Set(todaysCompletions.map(c => c.exercise_id));

    // Get all completions for days completed calculation
    const { data: allCompletions } = await supabase
        .from('exercise_completions')
        .select('completed_at')
        .eq('plan_id', plan.id);

    // Count unique days with at least one completion
    const uniqueDays = new Set(
        (allCompletions || []).map(c => new Date(c.completed_at).toDateString())
    );

    // Calculate days until next check-in
    const checkInDays = plan.check_in_frequency === 'biweekly' ? 14 : 7;
    const daysUntilCheckIn = checkInDays - (daysSinceStart % checkInDays);


    // Build today's exercise list with completion status
    // Use exercises_by_week if available (progressive plans), otherwise fallback to flat exercises
    let currentExercises: RehabExercise[] = plan.exercises;

    if (plan.exercises_by_week && plan.exercises_by_week.length > 0) {
        // Find current week's exercises from progressive plan
        const weekData = plan.exercises_by_week.find(w => w.week === currentWeek)
            || plan.exercises_by_week[plan.exercises_by_week.length - 1]; // Fallback to last week if current week not found
        if (weekData) {
            currentExercises = weekData.exercises;
        }
    }

    const todaysExercises = currentExercises.map(exercise => ({
        exercise,
        completed: completedIds.has(exercise.id),
    }));

    return {
        totalDays,
        daysCompleted: uniqueDays.size,
        currentWeek,
        totalWeeks: plan.duration_weeks,
        percentComplete: Math.min(100, Math.round((daysSinceStart / totalDays) * 100)),
        todaysExercises,
        daysUntilCheckIn,
    };
};

/**
 * Check if it's time for a progress scan
 */
export const shouldPromptProgressScan = (plan: RehabPlan): boolean => {
    const startDate = new Date(plan.started_at);
    const now = new Date();
    const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const totalDays = plan.duration_weeks * 7;

    // Prompt for scan in last 3 days of plan or if past end date
    return (totalDays - daysSinceStart) <= 3;
};
