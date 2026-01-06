// Design tokens for Life Hub - Industrial Surrealism aesthetic

export const COLORS = {
  // Background
  background: '#0D0D0D',
  surface: '#1A1A1A',
  surfaceLight: '#2A2A2A',
  
  // Primary accents
  cyan: '#00D9FF',
  purple: '#A855F7',
  
  // Gradients (for buttons, etc.)
  gradientStart: '#A855F7',
  gradientEnd: '#00D9FF',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  
  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  
  // Chat bubbles
  userBubble: '#A855F7',
  aiBubble: '#2A2A2A',
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const APP_CONFIG = {
  name: 'Life Hub',
  version: '1.0.0',
  suiteTokenCost: {
    simpleQuery: 0,
    deepQuery: 0.01,
    complexQuery: 0.05,
  },
};
