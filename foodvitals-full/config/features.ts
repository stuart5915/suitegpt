/**
 * FoodVitals Feature Configuration
 * Defines all free and paid features for the admin panel
 *
 * This config is synced to Supabase `app_features` table
 * and auto-populates in the Admin Apps panel
 */

export interface AppFeature {
  id: string;
  name: string;
  description: string;
  type: 'free' | 'paid' | 'freemium';
  creditCost?: number;
  tier?: 'basic' | 'pro';
  apiCost?: 'none' | 'low' | 'medium' | 'high';
}

export const APP_ID = 'foodvitals';
export const APP_NAME = 'FoodVitals AI';

export const FEATURES: AppFeature[] = [
  // ============================================
  // FREE FEATURES (No API cost)
  // ============================================
  {
    id: 'barcode_scan',
    name: 'Barcode Scanning',
    description: 'Scan product barcodes for instant nutrition info',
    type: 'free',
    apiCost: 'none',
  },
  {
    id: 'food_history',
    name: 'Food History',
    description: 'View and search your logged meals',
    type: 'free',
    apiCost: 'none',
  },
  {
    id: 'manual_logging',
    name: 'Manual Calorie Logging',
    description: 'Manually enter calories and macros',
    type: 'free',
    apiCost: 'none',
  },
  {
    id: 'nutrition_dashboard',
    name: 'Nutrition Dashboard',
    description: 'Track daily calories and macros',
    type: 'free',
    apiCost: 'none',
  },

  // ============================================
  // FREEMIUM FEATURES (Cache/USDA = free, AI fallback = paid)
  // ============================================
  {
    id: 'text_food_logging',
    name: 'Text Food Logging',
    description: 'Type food descriptions for nutrition lookup. Uses USDA database (free) or AI (paid) for unknown foods.',
    type: 'freemium',
    creditCost: 0, // Free when found in cache/USDA
    apiCost: 'low',
  },

  // ============================================
  // PAID FEATURES (Always costs credits)
  // ============================================
  {
    id: 'photo_analysis',
    name: 'Photo Analysis',
    description: 'Take a photo of your meal for AI-powered nutrition analysis',
    type: 'paid',
    creditCost: 10,
    apiCost: 'high',
  },
  {
    id: 'ai_pro_analysis',
    name: 'AI Pro Analysis',
    description: 'Enhanced AI analysis with Gemini Pro for complex meals',
    type: 'paid',
    creditCost: 10,
    tier: 'pro',
    apiCost: 'high',
  },
  {
    id: 'insights_chat',
    name: 'AI Nutrition Coach',
    description: 'Chat with AI about your nutrition and get personalized advice',
    type: 'paid',
    creditCost: 5,
    apiCost: 'medium',
  },
  {
    id: 'meal_suggestions',
    name: 'AI Meal Suggestions',
    description: 'Get personalized meal suggestions based on your macro goals',
    type: 'paid',
    creditCost: 5,
    apiCost: 'medium',
  },
  {
    id: 'weekly_insights',
    name: 'Weekly AI Insights',
    description: 'AI-generated weekly nutrition summary and recommendations',
    type: 'paid',
    creditCost: 10,
    apiCost: 'medium',
  },
];

// Helper functions
export function getFreeFeatures(): AppFeature[] {
  return FEATURES.filter(f => f.type === 'free');
}

export function getPaidFeatures(): AppFeature[] {
  return FEATURES.filter(f => f.type === 'paid');
}

export function getFreemiumFeatures(): AppFeature[] {
  return FEATURES.filter(f => f.type === 'freemium');
}

export function getFeatureById(id: string): AppFeature | undefined {
  return FEATURES.find(f => f.id === id);
}

// Format for display
export function formatFeaturesForAdmin(): {
  free: string[];
  paid: string[];
} {
  return {
    free: [
      ...getFreeFeatures().map(f => f.name),
      ...getFreemiumFeatures().map(f => `${f.name} (via USDA)`),
    ],
    paid: getPaidFeatures().map(f => `${f.name} (${f.creditCost} credits)`),
  };
}

// Sync to Supabase (call on app startup or deploy)
export async function syncFeaturesToSupabase(supabaseClient: any): Promise<void> {
  try {
    // Upsert features for this app
    for (const feature of FEATURES) {
      await supabaseClient.from('app_features').upsert({
        app_id: APP_ID,
        feature_id: feature.id,
        name: feature.name,
        description: feature.description,
        type: feature.type,
        credit_cost: feature.creditCost || 0,
        tier: feature.tier || 'basic',
        api_cost: feature.apiCost || 'none',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'app_id,feature_id',
      });
    }
    console.log(`Synced ${FEATURES.length} features to Supabase`);
  } catch (error) {
    console.error('Failed to sync features:', error);
  }
}
