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
    // Native uses SecureStore
    const SecureStore = require('expo-secure-store');
    storage = {
        getItem: async (key: string) => {
            return await SecureStore.getItemAsync(key);
        },
        setItem: async (key: string, value: string) => {
            await SecureStore.setItemAsync(key, value);
        },
        removeItem: async (key: string) => {
            await SecureStore.deleteItemAsync(key);
        },
    };
}

// Create Supabase client with persistent session storage
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});


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
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    return { data, error };
};

export const updateProfile = async (userId: string, updates: any) => {
    const { data, error } = await supabase
        .from('profiles')
        .upsert({ id: userId, ...updates })
        .select()
        .single();
    return { data, error };
};

// ============================================
// NUTRITION GOALS FUNCTIONS
// ============================================

export interface NutritionGoals {
    // User profile for RDA calculations
    age?: number;
    gender?: 'male' | 'female';
    weight_kg?: number;
    weight_unit?: 'kg' | 'lb';
    goal_type?: 'weight_loss' | 'weight_gain' | 'maintain';
    // Macro targets
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number;
    target_fat_g: number;
    target_fiber_g: number;
    // Micronutrient targets
    target_vitamin_c_mg: number;
    target_vitamin_d_mcg: number;
    target_calcium_mg: number;
    target_iron_mg: number;
    target_potassium_mg: number;
    target_sodium_mg: number;
    // Preferences
    diet_type: string;
    activity_level: string;
}

export const getNutritionGoals = async (userId: string) => {
    const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', userId)
        .single();
    return { data, error };
};

export const saveNutritionGoals = async (userId: string, goals: Partial<NutritionGoals>) => {
    const { data, error } = await supabase
        .from('nutrition_goals')
        .upsert({ user_id: userId, ...goals })
        .select()
        .single();
    return { data, error };
};

// ============================================
// FOOD LOG FUNCTIONS
// ============================================

export interface FoodLogEntry {
    id?: string;
    user_id?: string;
    logged_at?: string;
    meal_type?: string;
    raw_input?: string;
    photo_url?: string;
    total_calories?: number;
    total_protein_g?: number;
    total_carbs_g?: number;
    total_fat_g?: number;
    total_fiber_g?: number;
    total_vitamin_c_mg?: number;
    total_vitamin_d_mcg?: number;
    total_calcium_mg?: number;
    total_iron_mg?: number;
    total_potassium_mg?: number;
    total_sodium_mg?: number;
    ai_confidence?: number;
    user_verified?: boolean;
    gemini_model?: string;
}

export const saveFoodLog = async (userId: string, log: FoodLogEntry) => {
    const { data, error } = await supabase
        .from('food_logs')
        .insert({ user_id: userId, ...log })
        .select()
        .single();
    return { data, error };
};

export const getFoodLogs = async (userId: string, date?: string) => {
    let query = supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false });

    if (date) {
        // Filter to specific date
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        query = query.gte('logged_at', startOfDay).lte('logged_at', endOfDay);
    }

    const { data, error } = await query;
    return { data, error };
};

export const getTodaysFoodLogs = async (userId: string) => {
    const today = new Date().toISOString().split('T')[0];
    return getFoodLogs(userId, today);
};

export const deleteFoodLog = async (logId: string) => {
    const { error } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', logId);
    return { error };
};

// ============================================
// FOOD ITEMS FUNCTIONS
// ============================================

export interface FoodItem {
    id?: string;
    food_log_id: string;
    name: string;
    quantity: number;
    unit?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    vitamin_c_mg?: number;
    vitamin_d_mcg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    potassium_mg?: number;
    sodium_mg?: number;
}

export const saveFoodItems = async (items: FoodItem[]) => {
    const { data, error } = await supabase
        .from('food_items')
        .insert(items)
        .select();
    return { data, error };
};

export const getFoodItems = async (foodLogId: string) => {
    const { data, error } = await supabase
        .from('food_items')
        .select('*')
        .eq('food_log_id', foodLogId);
    return { data, error };
};

// ============================================
// DAILY SUMMARY FUNCTIONS
// ============================================

export interface DailySummary {
    summary_date: string;
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    total_fiber_g: number;
    total_vitamin_c_mg: number;
    total_vitamin_d_mcg: number;
    total_calcium_mg: number;
    total_iron_mg: number;
    total_potassium_mg: number;
    total_sodium_mg: number;
    log_count: number;
}

export const getDailySummary = async (userId: string, date: string) => {
    const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .eq('summary_date', date)
        .single();
    return { data, error };
};

export const getWeeklySummaries = async (userId: string) => {
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
        .from('daily_summaries')
        .select('*')
        .eq('user_id', userId)
        .gte('summary_date', weekAgo.toISOString().split('T')[0])
        .order('summary_date', { ascending: true });
    return { data, error };
};

export const upsertDailySummary = async (userId: string, summary: Partial<DailySummary>) => {
    const { data, error } = await supabase
        .from('daily_summaries')
        .upsert({
            user_id: userId,
            ...summary
        })
        .select()
        .single();
    return { data, error };
};

// ============================================
// TODAY'S TOTALS HELPER
// ============================================

export const calculateTodaysTotals = async (userId: string) => {
    const { data: logs, error } = await getTodaysFoodLogs(userId);

    if (error || !logs) {
        return { totals: null, error };
    }

    const totals = {
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        vitamin_c_mg: 0,
        vitamin_d_mcg: 0,
        calcium_mg: 0,
        iron_mg: 0,
        potassium_mg: 0,
        sodium_mg: 0,
        log_count: logs.length,
    };

    logs.forEach((log: FoodLogEntry) => {
        totals.calories += log.total_calories || 0;
        totals.protein_g += log.total_protein_g || 0;
        totals.carbs_g += log.total_carbs_g || 0;
        totals.fat_g += log.total_fat_g || 0;
        totals.fiber_g += log.total_fiber_g || 0;
        totals.vitamin_c_mg += log.total_vitamin_c_mg || 0;
        totals.vitamin_d_mcg += log.total_vitamin_d_mcg || 0;
        totals.calcium_mg += log.total_calcium_mg || 0;
        totals.iron_mg += log.total_iron_mg || 0;
        totals.potassium_mg += log.total_potassium_mg || 0;
        totals.sodium_mg += log.total_sodium_mg || 0;
    });

    return { totals, error: null };
};

// ============================================
// FAVORITE MEALS FUNCTIONS
// ============================================

export interface FavoriteMeal {
    id?: string;
    user_id?: string;
    name: string;
    description?: string;
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    fiber_g?: number;
    // Micronutrients
    vitamin_c_mg?: number;
    vitamin_d_mcg?: number;
    calcium_mg?: number;
    iron_mg?: number;
    potassium_mg?: number;
    sodium_mg?: number;
    source?: 'ai_suggestion' | 'logged_meal' | 'manual';
    source_log_id?: string;
    created_at?: string;
}

export const saveFavoriteMeal = async (userId: string, meal: FavoriteMeal) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .insert({
            user_id: userId,
            name: meal.name,
            description: meal.description,
            calories: meal.calories,
            protein_g: meal.protein_g,
            carbs_g: meal.carbs_g,
            fat_g: meal.fat_g,
            fiber_g: meal.fiber_g,
            source: meal.source || 'manual',
            source_log_id: meal.source_log_id,
        })
        .select()
        .single();
    return { data, error };
};

export const getFavoriteMeals = async (userId: string) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    return { data: data as FavoriteMeal[] | null, error };
};

export const deleteFavoriteMeal = async (mealId: string) => {
    const { error } = await supabase
        .from('favorite_meals')
        .delete()
        .eq('id', mealId);
    return { error };
};

export const isMealFavorited = async (userId: string, mealName: string) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .select('id')
        .eq('user_id', userId)
        .eq('name', mealName)
        .maybeSingle();
    return { isFavorited: !!data, favoriteId: data?.id, error };
};

/**
 * Quick add a favorite meal to today's food log
 */
export const addFavoriteToToday = async (userId: string, favorite: FavoriteMeal) => {
    const { data, error } = await supabase
        .from('food_logs')
        .insert({
            user_id: userId,
            raw_input: favorite.name + (favorite.description ? ` (${favorite.description})` : ''),
            total_calories: favorite.calories,
            total_protein_g: favorite.protein_g,
            total_carbs_g: favorite.carbs_g,
            total_fat_g: favorite.fat_g,
            total_fiber_g: favorite.fiber_g,
            // Micronutrients from meal suggestion
            total_vitamin_c_mg: favorite.vitamin_c_mg || 0,
            total_vitamin_d_mcg: favorite.vitamin_d_mcg || 0,
            total_calcium_mg: favorite.calcium_mg || 0,
            total_iron_mg: favorite.iron_mg || 0,
            total_potassium_mg: favorite.potassium_mg || 0,
            total_sodium_mg: favorite.sodium_mg || 0,
            meal_type: 'snack',
            user_verified: true,
        })
        .select()
        .single();
    return { data, error };
};

/**
 * Check if a logged meal is already favorited by its source_log_id
 */
export const isMealFavoritedByLogId = async (userId: string, logId: string) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .select('id')
        .eq('user_id', userId)
        .eq('source_log_id', logId)
        .maybeSingle();
    return { isFavorited: !!data, favoriteId: data?.id, error };
};

/**
 * Get all favorited log IDs for a user for quick lookup
 */
export const getFavoritedLogIds = async (userId: string) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .select('id, source_log_id')
        .eq('user_id', userId)
        .not('source_log_id', 'is', null);

    // Build a map from source_log_id to favorite_id
    const favoritesMap: Record<string, string> = {};
    if (data) {
        data.forEach((fav) => {
            if (fav.source_log_id) {
                favoritesMap[fav.source_log_id] = fav.id;
            }
        });
    }
    return { favoritesMap, error };
};

/**
 * Save a FoodLogEntry as a favorite meal
 */
export const saveFavoriteFromLog = async (userId: string, log: FoodLogEntry) => {
    const { data, error } = await supabase
        .from('favorite_meals')
        .insert({
            user_id: userId,
            name: log.raw_input || 'Saved Meal',
            calories: log.total_calories,
            protein_g: log.total_protein_g,
            carbs_g: log.total_carbs_g,
            fat_g: log.total_fat_g,
            fiber_g: log.total_fiber_g,
            source: 'logged_meal',
            source_log_id: log.id,
        })
        .select()
        .single();
    return { data, error };
};

// ============================================
// SAVED TIPS (from AI chat)
// ============================================

export interface SavedTip {
    id: string;
    user_id: string;
    content: string;
    source: string;
    created_at: string;
}

export const saveTip = async (userId: string, content: string, source: string = 'insights_chat') => {
    const { data, error } = await supabase
        .from('saved_tips')
        .insert({
            user_id: userId,
            content,
            source,
        })
        .select()
        .single();
    return { data, error };
};

export const getSavedTips = async (userId: string) => {
    const { data, error } = await supabase
        .from('saved_tips')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
    return { data: data as SavedTip[] | null, error };
};

export const deleteSavedTip = async (tipId: string) => {
    const { error } = await supabase
        .from('saved_tips')
        .delete()
        .eq('id', tipId);
    return { error };
};
