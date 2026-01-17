/**
 * App Feature Configuration
 * Define your free and paid features here
 *
 * CUSTOMIZE: Update APP_ID, APP_NAME, and FEATURES for your app
 */

export interface AppFeature {
  id: string;
  name: string;
  description: string;
  type: 'free' | 'paid';
  creditCost?: number;
}

// ============================================
// CUSTOMIZE THESE FOR YOUR APP
// ============================================
export const APP_ID = 'your-app-slug';  // Must match apps table slug
export const APP_NAME = 'Your App Name';

export const FEATURES: AppFeature[] = [
  // FREE FEATURES
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Main app dashboard',
    type: 'free',
  },
  {
    id: 'basic_feature',
    name: 'Basic Feature',
    description: 'A free feature for all users',
    type: 'free',
  },

  // PAID FEATURES
  {
    id: 'ai_feature',
    name: 'AI Feature',
    description: 'Premium AI-powered feature',
    type: 'paid',
    creditCost: 10,
  },
  {
    id: 'pro_feature',
    name: 'Pro Feature',
    description: 'Advanced functionality',
    type: 'paid',
    creditCost: 5,
  },
];

// ============================================
// HELPER FUNCTIONS (no changes needed)
// ============================================
export function getFreeFeatures(): AppFeature[] {
  return FEATURES.filter(f => f.type === 'free');
}

export function getPaidFeatures(): AppFeature[] {
  return FEATURES.filter(f => f.type === 'paid');
}

export function getFeatureById(id: string): AppFeature | undefined {
  return FEATURES.find(f => f.id === id);
}

export function getFeatureCost(featureId: string): number {
  const feature = getFeatureById(featureId);
  return feature?.creditCost || 0;
}
