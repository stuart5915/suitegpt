import { useCallback, useRef, useState } from 'react';

import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface ActiveSetData {
    sessionId: string;
    exerciseId: string;
    exerciseName: string;
    setNumber: number;
    weight?: number;
    targetReps?: number;
}

interface RepDataPayload {
    repNumber: number;
    jointAngles: Record<string, number[]>;
    tempoSeconds: number;
    formQuality: 'good' | 'fair' | 'poor';
}

/**
 * Auto-logger for tracking reps and sets during a workout session.
 */
export function useAutoLogger() {
    const [currentSet, setCurrentSet] = useState<ActiveSetData | null>(null);
    const [setId, setSetId] = useState<string | null>(null);
    const [repCount, setRepCount] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);

    const repDataBuffer = useRef<RepDataPayload[]>([]);
    const lastSyncTimeRef = useRef<number>(0);

    const SYNC_INTERVAL_MS = 5000;

    /**
     * Start tracking a new set
     */
    const startSet = useCallback(async (setData: ActiveSetData) => {
        setCurrentSet(setData);
        setRepCount(0);
        repDataBuffer.current = [];

        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('exercise_sets')
                    .insert({
                        session_id: setData.sessionId,
                        exercise_id: setData.exerciseId,
                        set_number: setData.setNumber,
                        weight_lbs: setData.weight,
                        target_reps: setData.targetReps,
                        tracking_method: 'auto',
                        started_at: new Date().toISOString(),
                    } as never)
                    .select()
                    .single();

                if (error) {
                    console.error('[AutoLogger] Failed to create set:', error);
                } else if (data) {
                    const setRecord = data as { id: string };
                    setSetId(setRecord.id);
                    if (__DEV__) console.log('[AutoLogger] Set created:', setRecord.id);
                }
            } catch (error) {
                console.error('[AutoLogger] Error creating set:', error);
            }
        }
    }, []);

    /**
     * Log a completed rep
     */
    const logRep = useCallback((repData: RepDataPayload) => {
        setRepCount((prev) => prev + 1);
        repDataBuffer.current.push(repData);

        const now = Date.now();
        if (now - lastSyncTimeRef.current >= SYNC_INTERVAL_MS) {
            syncRepData();
        }
    }, []);

    /**
     * Sync buffered rep data to Supabase
     */
    const syncRepData = useCallback(async () => {
        if (!setId || repDataBuffer.current.length === 0) return;
        if (!isSupabaseConfigured()) return;

        setIsSyncing(true);
        lastSyncTimeRef.current = Date.now();

        const repsToSync = [...repDataBuffer.current];
        repDataBuffer.current = [];

        try {
            const repRecords = repsToSync.map((rep) => ({
                set_id: setId,
                rep_number: rep.repNumber,
                joint_angles: rep.jointAngles,
                tempo_seconds: rep.tempoSeconds,
                form_quality: rep.formQuality,
            }));

            const { error } = await supabase
                .from('rep_data')
                .insert(repRecords as never);

            if (error) {
                console.error('[AutoLogger] Failed to sync reps:', error);
                repDataBuffer.current = [...repsToSync, ...repDataBuffer.current];
            } else {
                if (__DEV__) console.log('[AutoLogger] Synced', repsToSync.length, 'reps');
            }
        } catch (error) {
            console.error('[AutoLogger] Error syncing reps:', error);
            repDataBuffer.current = [...repsToSync, ...repDataBuffer.current];
        } finally {
            setIsSyncing(false);
        }
    }, [setId]);

    /**
     * End the current set
     */
    const endSet = useCallback(async (): Promise<void> => {
        await syncRepData();

        if (setId && isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('exercise_sets')
                    .update({
                        completed_reps: repCount,
                        ended_at: new Date().toISOString(),
                    } as never)
                    .eq('id', setId);

                if (error) {
                    console.error('[AutoLogger] Failed to finalize set:', error);
                } else {
                    if (__DEV__) console.log('[AutoLogger] Set finalized with', repCount, 'reps');
                }
            } catch (error) {
                console.error('[AutoLogger] Error finalizing set:', error);
            }
        }

        setCurrentSet(null);
        setSetId(null);
        setRepCount(0);
        repDataBuffer.current = [];
    }, [setId, repCount, syncRepData]);

    /**
     * Update form quality
     */
    const updateFormQuality = useCallback(async (
        quality: 'excellent' | 'good' | 'fair' | 'poor'
    ) => {
        if (!setId || !isSupabaseConfigured()) return;

        try {
            const { error } = await supabase
                .from('exercise_sets')
                .update({ form_quality: quality } as never)
                .eq('id', setId);

            if (error) {
                console.error('[AutoLogger] Failed to update form quality:', error);
            }
        } catch (error) {
            console.error('[AutoLogger] Error updating form quality:', error);
        }
    }, [setId]);

    return {
        currentSet,
        repCount,
        isSyncing,
        startSet,
        logRep,
        endSet,
        updateFormQuality,
        syncRepData,
    };
}

/**
 * Create a new workout session
 */
export async function createSession(
    userId: string,
    planId?: string
): Promise<string | null> {
    if (!isSupabaseConfigured()) {
        console.warn('[AutoLogger] Supabase not configured, using local session');
        return `local-${Date.now()}`;
    }

    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .insert({
                user_id: userId,
                plan_id: planId,
                started_at: new Date().toISOString(),
            } as never)
            .select()
            .single();

        if (error) {
            console.error('[AutoLogger] Failed to create session:', error);
            return null;
        }

        const session = data as { id: string };
        if (__DEV__) console.log('[AutoLogger] Session created:', session.id);
        return session.id;
    } catch (error) {
        console.error('[AutoLogger] Error creating session:', error);
        return null;
    }
}

/**
 * Finalize a workout session
 */
export async function finalizeSession(
    sessionId: string,
    stats: {
        totalReps: number;
        totalSets: number;
        totalVolume: number;
        durationSeconds: number;
    },
    aiSummary?: string
): Promise<boolean> {
    if (!isSupabaseConfigured() || sessionId.startsWith('local-')) {
        if (__DEV__) console.log('[AutoLogger] Session finalized locally');
        return true;
    }

    try {
        const { error } = await supabase
            .from('workout_sessions')
            .update({
                ended_at: new Date().toISOString(),
                duration_seconds: stats.durationSeconds,
                total_reps: stats.totalReps,
                total_sets: stats.totalSets,
                total_volume_lbs: stats.totalVolume,
                ai_summary: aiSummary,
            } as never)
            .eq('id', sessionId);

        if (error) {
            console.error('[AutoLogger] Failed to finalize session:', error);
            return false;
        }

        if (__DEV__) console.log('[AutoLogger] Session finalized:', sessionId);
        return true;
    } catch (error) {
        console.error('[AutoLogger] Error finalizing session:', error);
        return false;
    }
}
