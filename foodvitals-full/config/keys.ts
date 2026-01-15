// ============================================
// FoodVitalsAI Configuration
// ============================================

// Supabase Configuration
export const SUPABASE_URL = 'https://fhsrcesrvazvmnqxtdpx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoc3JjZXNydmF6dm1ucXh0ZHB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMTE2NjMsImV4cCI6MjA4MjY4NzY2M30.8LScpltn94kcolE1hfsC8x1N5MTW2DxQZXChYJ5GpJU';

// Gemini API Configuration
// Get your API key from: https://aistudio.google.com/app/apikey
export const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// Gemini Model IDs (Dec 2025)
// Trying gemini-3-flash for potentially better rate limits
export const GEMINI_MODELS = {
  FLASH: 'gemini-3-flash-preview',      // Try Gemini 3 for better limits
  PRO: 'gemini-2.5-pro',                // Pro for complex tasks
  FLASH_LITE: 'gemini-2.5-flash-lite',  // Ultra-fast
} as const;

export type GeminiModel = typeof GEMINI_MODELS[keyof typeof GEMINI_MODELS];
