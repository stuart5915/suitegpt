import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase credentials not configured. Please update your .env file with:\n' +
        '   EXPO_PUBLIC_SUPABASE_URL=your_url\n' +
        '   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key'
    );
}

// Universal storage that works on both web (SSR-safe) and native
const universalStorage = {
    getItem: async (key: string): Promise<string | null> => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && window.localStorage) {
                return window.localStorage.getItem(key);
            }
            return null;
        } else {
            // Native - use AsyncStorage
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            return AsyncStorage.getItem(key);
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem(key, value);
            }
        } else {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.setItem(key, value);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web') {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.removeItem(key);
            }
        } else {
            const AsyncStorage = require('@react-native-async-storage/async-storage').default;
            await AsyncStorage.removeItem(key);
        }
    },
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: universalStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
    },
});

// Types for our database
export type Profile = {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    interests: string[];
    created_at: string;
    updated_at: string;
};

export type CourseProgress = {
    id: string;
    user_id: string;
    course_id: string;
    lesson_id: string;
    completed_at: string;
};

export type Bookmark = {
    id: string;
    user_id: string;
    content_type: 'article' | 'course' | 'video';
    content_id: string;
    saved_at: string;
};
