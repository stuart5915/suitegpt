import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/keys';

// Platform-aware storage adapter
let storage: any;

if (Platform.OS === 'web') {
    // Web uses localStorage
    storage = {
        getItem: (key: string) => {
            if (typeof window !== 'undefined') {
                return Promise.resolve(window.localStorage.getItem(key));
            }
            return Promise.resolve(null);
        },
        setItem: (key: string, value: string) => {
            if (typeof window !== 'undefined') {
                window.localStorage.setItem(key, value);
            }
            return Promise.resolve();
        },
        removeItem: (key: string) => {
            if (typeof window !== 'undefined') {
                window.localStorage.removeItem(key);
            }
            return Promise.resolve();
        },
    };
} else {
    // Native uses AsyncStorage
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    storage = AsyncStorage;
}

// Create Supabase client with Platform-aware storage
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});


// Utility: Wrap a promise with a timeout to prevent infinite hangs
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number = 10000): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Query timed out after ${timeoutMs}ms`)), timeoutMs)
        )
    ]);
};

// ============================================
// AUTH FUNCTIONS
// ============================================

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
    return { data, error };
};

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
};

// ============================================
// PROFILE FUNCTIONS
// ============================================

export const getProfile = async (userId: string) => {
    console.log('[getProfile] Fetching profile for:', userId);

    // Check if we have a valid session
    const { data: { session } } = await supabase.auth.getSession();
    console.log('[getProfile] Session check - has session:', !!session, 'user:', session?.user?.id?.substring(0, 8) || 'none');

    if (!session) {
        console.warn('[getProfile] No auth session found, returning default profile');
        return {
            data: {
                id: userId,
                onboarding_complete: true,  // Skip onboarding, use profile tab instead
                health_profile_complete: false
            },
            error: null
        };
    }

    try {
        console.log('[getProfile] Starting Supabase query...');
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', userId)
                    .maybeSingle();
            })(),
            10000 // 10 second timeout
        );

        console.log('[getProfile] Query complete - data:', !!result.data, 'error:', result.error?.message || 'none');

        if (result.error) {
            console.error('[getProfile] Supabase error:', result.error);
            return { data: null, error: result.error };
        }

        if (!result.data) {
            console.warn('[getProfile] No profile found, returning default');
            return {
                data: {
                    id: userId,
                    onboarding_complete: true,  // Skip onboarding, use profile tab instead
                    health_profile_complete: false
                },
                error: null
            };
        }

        return { data: result.data, error: null };
    } catch (e) {
        console.error('[getProfile] Exception:', e);
        return {
            data: {
                id: userId,
                onboarding_complete: true,  // Skip onboarding, use profile tab instead
                health_profile_complete: false
            },
            error: e
        };
    }
};

export const updateProfile = async (userId: string, updates: any) => {
    try {
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('profiles')
                    .upsert({ id: userId, ...updates })
                    .select()
                    .single();
            })()
        );
        return { data: result.data, error: result.error };
    } catch (e) {
        console.error('[updateProfile] Timeout or exception:', e);
        return { data: null, error: e };
    }
};

// ============================================
// HEALTH PROFILE FUNCTIONS
// ============================================

export interface HealthProfile {
    weight_lbs?: number;
    height_inches?: number;
    birth_year?: number;
    activity_level?: 'sedentary' | 'light' | 'moderate' | 'active';
    medical_conditions?: string[];
    health_notes?: string;
    health_profile_complete?: boolean;
}

export const getHealthProfile = async (userId: string): Promise<{ data: HealthProfile | null; error: any }> => {
    try {
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('profiles')
                    .select('weight_lbs, height_inches, birth_year, activity_level, medical_conditions, health_notes, health_profile_complete')
                    .eq('id', userId)
                    .maybeSingle();
            })()
        );

        // If no row exists for this user, return a default empty profile instead of null
        if (!result.data && !result.error) {
            return {
                data: {
                    weight_lbs: undefined,
                    height_inches: undefined,
                    birth_year: undefined,
                    activity_level: undefined,
                    medical_conditions: [],
                    health_notes: '',
                    health_profile_complete: false,
                },
                error: null,
            };
        }

        return { data: result.data, error: result.error };
    } catch (e) {
        console.error('[getHealthProfile] Timeout or exception:', e);
        return {
            data: {
                weight_lbs: undefined,
                height_inches: undefined,
                birth_year: undefined,
                activity_level: undefined,
                medical_conditions: [],
                health_notes: '',
                health_profile_complete: false,
            },
            error: e,
        };
    }
};

export const updateHealthProfile = async (userId: string, healthData: HealthProfile): Promise<{ data: any; error: any }> => {
    // Check if required fields are filled to set health_profile_complete
    const isComplete = !!(
        healthData.weight_lbs &&
        healthData.height_inches &&
        healthData.birth_year &&
        healthData.activity_level
    );

    try {
        // Wrap in async function to convert PostgrestBuilder to Promise
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('profiles')
                    .upsert(
                        {
                            id: userId,
                            ...healthData,
                            health_profile_complete: isComplete,
                            updated_at: new Date().toISOString(),
                        },
                        { onConflict: 'id' }
                    )
                    .select()
                    .single();
            })()
        );

        if (result.error) {
            console.error('[updateHealthProfile] Error:', result.error);
        }

        return { data: result.data, error: result.error };
    } catch (e) {
        console.error('[updateHealthProfile] Timeout or exception:', e);
        return { data: null, error: e };
    }
};

export const isHealthProfileComplete = async (userId: string): Promise<boolean> => {
    try {
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('profiles')
                    .select('health_profile_complete')
                    .eq('id', userId)
                    .maybeSingle();
            })()
        );

        if (result.error || !result.data) return false;
        return result.data.health_profile_complete === true;
    } catch (e) {
        console.error('[isHealthProfileComplete] Timeout or exception:', e);
        return false;
    }
};

// ============================================
// PAIN CONTEXT FUNCTIONS
// ============================================

export const savePainContext = async (userId: string, context: {
    pain_areas: string[];
    pain_duration: string;
    pain_triggers: string[];
    goals: string[];
}) => {
    try {
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('pain_context')
                    .insert({ user_id: userId, ...context })
                    .select()
                    .single();
            })()
        );
        return { data: result.data, error: result.error };
    } catch (e) {
        console.error('[savePainContext] Timeout or exception:', e);
        return { data: null, error: e };
    }
};

export const getPainContext = async (userId: string) => {
    try {
        const result = await withTimeout(
            (async () => {
                return await supabase
                    .from('pain_context')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle(); // Use maybeSingle() to avoid error when no pain_context exists
            })()
        );
        return { data: result.data, error: result.error };
    } catch (e) {
        console.error('[getPainContext] Timeout or exception:', e);
        return { data: null, error: e };
    }
};

// ============================================
// SCAN FUNCTIONS
// ============================================

export const saveScan = async (userId: string, scan: {
    duration_seconds: number;
    pose_data: any[];
    notes?: string;
}) => {
    const { data, error } = await supabase
        .from('scans')
        .insert({ user_id: userId, ...scan })
        .select()
        .single();
    return { data, error };
};

export const getScans = async (userId: string) => {
    const { data, error } = await supabase
        .from('scans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return { data, error };
};

export const getScan = async (scanId: string) => {
    const { data, error } = await supabase
        .from('scans')
        .select('*, pain_points(*)')
        .eq('id', scanId)
        .single();
    return { data, error };
};

// ============================================
// PAIN POINT FUNCTIONS
// ============================================

export const savePainPoint = async (scanId: string, painPoint: {
    timestamp_seconds: number;
    pose_snapshot: any;
    intensity: number;
    body_part: string;
}) => {
    const { data, error } = await supabase
        .from('pain_points')
        .insert({ scan_id: scanId, ...painPoint })
        .select()
        .single();
    return { data, error };
};

export const getPainPoints = async (scanId: string) => {
    const { data, error } = await supabase
        .from('pain_points')
        .select('*')
        .eq('scan_id', scanId)
        .order('timestamp_seconds', { ascending: true });
    return { data, error };
};

// ============================================
// PLAN FUNCTIONS
// ============================================

export const savePlan = async (userId: string, plan: {
    generated_from_scan: string;
    exercises: any[];
    frequency: string;
    duration_weeks: number;
    ai_reasoning: string;
}) => {
    const { data, error } = await supabase
        .from('plans')
        .insert({ user_id: userId, ...plan })
        .select()
        .single();
    return { data, error };
};

export const getCurrentPlan = async (userId: string) => {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    return { data, error };
};

export const getPlans = async (userId: string) => {
    const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return { data, error };
};

// ============================================
// WORKOUT LOG FUNCTIONS
// ============================================

export const logWorkout = async (userId: string, log: {
    plan_id: string;
    notes?: string;
    pain_level?: number;
}) => {
    const { data, error } = await supabase
        .from('workout_logs')
        .insert({ user_id: userId, ...log })
        .select()
        .single();
    return { data, error };
};

export const getWorkoutLogs = async (userId: string, planId?: string) => {
    let query = supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

    if (planId) {
        query = query.eq('plan_id', planId);
    }

    const { data, error } = await query;
    return { data, error };
};

export const getWorkoutCount = async (userId: string, planId: string) => {
    const { count, error } = await supabase
        .from('workout_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('plan_id', planId);
    return { count, error };
};

// ============================================
// MOVEMENT REPORT FUNCTIONS
// ============================================

export interface MovementReport {
    id?: string;
    user_id?: string;
    created_at?: string;
    movement_name: string;
    movement_emoji?: string;
    duration_seconds?: number;
    pain_location?: string[];
    pain_duration?: string;
    pain_triggers?: string[];
    pain_type?: string[];
    prior_injuries?: string;
    ai_report: string;
    pain_points_count?: number;
    avg_intensity?: number;
    frame_count?: number;
    model_used?: string;
    processing_time_ms?: number;
    frame_thumbnails?: string[]; // Base64-encoded tiny JPEG thumbnails
}

export const saveMovementReport = async (report: MovementReport) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { data: null, error: { message: 'Not authenticated' } };
    }

    const { data, error } = await supabase
        .from('movement_reports')
        .insert([{
            user_id: user.id,
            ...report
        }])
        .select()
        .single();

    return { data, error };
};

export const getMovementReports = async (limit = 50) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { data: null, error: { message: 'Not authenticated' } };
    }

    const { data, error } = await supabase
        .from('movement_reports')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

    return { data, error };
};

export const deleteMovementReport = async (reportId: string) => {
    const { error } = await supabase
        .from('movement_reports')
        .delete()
        .eq('id', reportId);

    return { error };
};

export const updateMovementReport = async (reportId: string, updates: Partial<MovementReport>) => {
    const { data, error } = await supabase
        .from('movement_reports')
        .update(updates)
        .eq('id', reportId)
        .select()
        .single();

    return { data, error };
};
