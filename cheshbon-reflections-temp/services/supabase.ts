import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Hardcoded fallbacks for web builds (where Constants.expoConfig may not be available)
const FALLBACK_SUPABASE_URL = 'https://zbrkexdandknnsuprbxu.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpicmtleGRhbmRrbm5zdXByYnh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzUwNzQ4MDcsImV4cCI6MjA1MDY1MDgwN30.pCNdDKbPnIjJiGUaSE0yd_kW3sUFqBkNfKBexcMiqMg';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;


// Use localStorage for web, AsyncStorage for native
let storage;
if (Platform.OS === 'web') {
    // Web uses browser localStorage
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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web', // Enable for web to parse OAuth tokens from URL
    },
});
