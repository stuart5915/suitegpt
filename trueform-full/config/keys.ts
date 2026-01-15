// Supabase Configuration
// IMPORTANT: Use environment variables for all API keys

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Gemini API Configuration
// Get your API key from: https://aistudio.google.com/app/apikey
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
