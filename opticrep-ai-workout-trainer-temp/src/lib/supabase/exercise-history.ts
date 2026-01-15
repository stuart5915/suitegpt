import { supabase } from './client';

export interface ExerciseHistoryEntry {
    id: string;
    exercise_name: string;
    weight: number | null;
    weight_unit: string;
    reps: number;
    set_number: number;
    plan_id: string | null;
    created_at: string;
}

/**
 * Get the last recorded weight for an exercise
 */
export async function getLastWeight(exerciseName: string): Promise<number | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await (supabase as any)
            .from('exercise_history')
            .select('weight')
            .eq('user_id', user.id)
            .eq('exercise_name', exerciseName)
            .not('weight', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;
        return data.weight;
    } catch (error) {
        console.error('Error fetching last weight:', error);
        return null;
    }
}

/**
 * Save a completed set to history
 */
export async function saveSetHistory(
    exerciseName: string,
    weight: number | null,
    reps: number,
    setNumber: number,
    planId?: string
): Promise<boolean> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;

        const { error } = await (supabase as any)
            .from('exercise_history')
            .insert({
                user_id: user.id,
                exercise_name: exerciseName,
                weight,
                weight_unit: 'lbs',
                reps,
                set_number: setNumber,
                plan_id: planId || null,
            });

        if (error) {
            console.error('Error saving set history:', error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error saving set history:', error);
        return false;
    }
}

/**
 * Get recent history for an exercise
 */
export async function getExerciseHistory(
    exerciseName: string,
    limit: number = 10
): Promise<ExerciseHistoryEntry[]> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await (supabase as any)
            .from('exercise_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('exercise_name', exerciseName)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) return [];
        return data || [];
    } catch (error) {
        console.error('Error fetching exercise history:', error);
        return [];
    }
}
