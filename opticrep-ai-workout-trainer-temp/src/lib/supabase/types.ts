/**
 * Supabase Database Types
 * 
 * These types are generated based on the database schema.
 * In a production app, use `supabase gen types typescript` to auto-generate.
 */

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string | null;
                    display_name: string | null;
                    avatar_url: string | null;
                    preferences: Json;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email?: string | null;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    preferences?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string | null;
                    display_name?: string | null;
                    avatar_url?: string | null;
                    preferences?: Json;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            workout_plans: {
                Row: {
                    id: string;
                    user_id: string;
                    name: string;
                    description: string | null;
                    frequency_days: number;
                    schedule: Json;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    name: string;
                    description?: string | null;
                    frequency_days: number;
                    schedule?: Json;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    name?: string;
                    description?: string | null;
                    frequency_days?: number;
                    schedule?: Json;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            workout_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    plan_id: string | null;
                    started_at: string;
                    ended_at: string | null;
                    duration_seconds: number | null;
                    total_reps: number;
                    total_sets: number;
                    total_volume_lbs: number;
                    ai_summary: string | null;
                    ai_performance_score: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    plan_id?: string | null;
                    started_at?: string;
                    ended_at?: string | null;
                    duration_seconds?: number | null;
                    total_reps?: number;
                    total_sets?: number;
                    total_volume_lbs?: number;
                    ai_summary?: string | null;
                    ai_performance_score?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    plan_id?: string | null;
                    started_at?: string;
                    ended_at?: string | null;
                    duration_seconds?: number | null;
                    total_reps?: number;
                    total_sets?: number;
                    total_volume_lbs?: number;
                    ai_summary?: string | null;
                    ai_performance_score?: number | null;
                    created_at?: string;
                };
            };
            exercises: {
                Row: {
                    id: string;
                    name: string;
                    category: string;
                    muscle_groups: string[];
                    equipment: string | null;
                    tracked_joints: string[] | null;
                    rep_detection_config: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    category: string;
                    muscle_groups: string[];
                    equipment?: string | null;
                    tracked_joints?: string[] | null;
                    rep_detection_config?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    category?: string;
                    muscle_groups?: string[];
                    equipment?: string | null;
                    tracked_joints?: string[] | null;
                    rep_detection_config?: Json | null;
                    created_at?: string;
                };
            };
            exercise_sets: {
                Row: {
                    id: string;
                    session_id: string;
                    exercise_id: string;
                    set_number: number;
                    weight_lbs: number | null;
                    target_reps: number | null;
                    completed_reps: number;
                    tracking_method: 'auto' | 'manual';
                    form_quality: 'excellent' | 'good' | 'fair' | 'poor' | null;
                    started_at: string;
                    ended_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    exercise_id: string;
                    set_number: number;
                    weight_lbs?: number | null;
                    target_reps?: number | null;
                    completed_reps?: number;
                    tracking_method?: 'auto' | 'manual';
                    form_quality?: 'excellent' | 'good' | 'fair' | 'poor' | null;
                    started_at?: string;
                    ended_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    exercise_id?: string;
                    set_number?: number;
                    weight_lbs?: number | null;
                    target_reps?: number | null;
                    completed_reps?: number;
                    tracking_method?: 'auto' | 'manual';
                    form_quality?: 'excellent' | 'good' | 'fair' | 'poor' | null;
                    started_at?: string;
                    ended_at?: string | null;
                    created_at?: string;
                };
            };
            rep_data: {
                Row: {
                    id: string;
                    set_id: string;
                    rep_number: number;
                    joint_angles: Json;
                    tempo_seconds: number | null;
                    eccentric_seconds: number | null;
                    concentric_seconds: number | null;
                    form_quality: 'good' | 'fair' | 'poor' | null;
                    form_notes: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    set_id: string;
                    rep_number: number;
                    joint_angles: Json;
                    tempo_seconds?: number | null;
                    eccentric_seconds?: number | null;
                    concentric_seconds?: number | null;
                    form_quality?: 'good' | 'fair' | 'poor' | null;
                    form_notes?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    set_id?: string;
                    rep_number?: number;
                    joint_angles?: Json;
                    tempo_seconds?: number | null;
                    eccentric_seconds?: number | null;
                    concentric_seconds?: number | null;
                    form_quality?: 'good' | 'fair' | 'poor' | null;
                    form_notes?: string | null;
                    created_at?: string;
                };
            };
            audio_reflections: {
                Row: {
                    id: string;
                    session_id: string;
                    storage_path: string;
                    duration_seconds: number | null;
                    transcript: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    storage_path: string;
                    duration_seconds?: number | null;
                    transcript?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    storage_path?: string;
                    duration_seconds?: number | null;
                    transcript?: string | null;
                    created_at?: string;
                };
            };
            journal_entries: {
                Row: {
                    id: string;
                    user_id: string;
                    entry_date: string;
                    sleep_hours: number | null;
                    sleep_quality: number | null;
                    stress_level: number | null;
                    energy_level: number | null;
                    muscle_soreness: number | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    entry_date?: string;
                    sleep_hours?: number | null;
                    sleep_quality?: number | null;
                    stress_level?: number | null;
                    energy_level?: number | null;
                    muscle_soreness?: number | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    entry_date?: string;
                    sleep_hours?: number | null;
                    sleep_quality?: number | null;
                    stress_level?: number | null;
                    energy_level?: number | null;
                    muscle_soreness?: number | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            diet_logs: {
                Row: {
                    id: string;
                    user_id: string;
                    log_date: string;
                    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout' | null;
                    description: string | null;
                    calories: number | null;
                    protein_g: number | null;
                    carbs_g: number | null;
                    fat_g: number | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    log_date?: string;
                    meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout' | null;
                    description?: string | null;
                    calories?: number | null;
                    protein_g?: number | null;
                    carbs_g?: number | null;
                    fat_g?: number | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    log_date?: string;
                    meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout' | null;
                    description?: string | null;
                    calories?: number | null;
                    protein_g?: number | null;
                    carbs_g?: number | null;
                    fat_g?: number | null;
                    created_at?: string;
                };
            };
            injury_history: {
                Row: {
                    id: string;
                    user_id: string;
                    body_part: string;
                    injury_type: string | null;
                    severity: 'minor' | 'moderate' | 'severe' | null;
                    description: string | null;
                    occurred_at: string | null;
                    resolved_at: string | null;
                    is_active: boolean;
                    avoid_exercises: string[] | null;
                    notes: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    body_part: string;
                    injury_type?: string | null;
                    severity?: 'minor' | 'moderate' | 'severe' | null;
                    description?: string | null;
                    occurred_at?: string | null;
                    resolved_at?: string | null;
                    is_active?: boolean;
                    avoid_exercises?: string[] | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    body_part?: string;
                    injury_type?: string | null;
                    severity?: 'minor' | 'moderate' | 'severe' | null;
                    description?: string | null;
                    occurred_at?: string | null;
                    resolved_at?: string | null;
                    is_active?: boolean;
                    avoid_exercises?: string[] | null;
                    notes?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
            };
            chat_messages: {
                Row: {
                    id: string;
                    user_id: string;
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    metadata: Json | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    role: 'user' | 'assistant' | 'system';
                    content: string;
                    metadata?: Json | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    user_id?: string;
                    role?: 'user' | 'assistant' | 'system';
                    content?: string;
                    metadata?: Json | null;
                    created_at?: string;
                };
            };
            message_embeddings: {
                Row: {
                    id: string;
                    message_id: string;
                    embedding: number[];
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    message_id: string;
                    embedding: number[];
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    message_id?: string;
                    embedding?: number[];
                    created_at?: string;
                };
            };
        };
        Views: Record<string, never>;
        Functions: {
            match_messages: {
                Args: {
                    query_embedding: number[];
                    match_threshold: number;
                    match_count: number;
                };
                Returns: {
                    id: string;
                    message_id: string;
                    content: string;
                    similarity: number;
                }[];
            };
        };
        Enums: Record<string, never>;
    };
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type WorkoutPlan = Database['public']['Tables']['workout_plans']['Row'];
export type WorkoutSession = Database['public']['Tables']['workout_sessions']['Row'];
export type Exercise = Database['public']['Tables']['exercises']['Row'];
export type ExerciseSet = Database['public']['Tables']['exercise_sets']['Row'];
export type RepData = Database['public']['Tables']['rep_data']['Row'];
export type AudioReflection = Database['public']['Tables']['audio_reflections']['Row'];
export type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];
export type DietLog = Database['public']['Tables']['diet_logs']['Row'];
export type InjuryHistory = Database['public']['Tables']['injury_history']['Row'];
export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
export type MessageEmbedding = Database['public']['Tables']['message_embeddings']['Row'];
