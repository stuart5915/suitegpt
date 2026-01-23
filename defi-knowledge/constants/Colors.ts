// DeFi Knowledge Design System Colors
// Dark-first design matching the original app aesthetic

export const Colors = {
  // Primary palette
  background: '#0a0a0f',
  surface: '#1a1a2e',
  surfaceElevated: '#1e1e2f',
  border: '#2a2a4a',
  borderLight: '#3d3d5c',

  // Text
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Accent colors
  primary: '#a855f7',      // Purple
  primaryDark: '#9333ea',
  secondary: '#3b82f6',    // Blue

  // Semantic colors
  success: '#4ade80',
  warning: '#fbbf24',
  error: '#f87171',
  info: '#38bdf8',

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#1e1e2f', '#2d2d44'],
  gradientAccent: ['#a855f7', '#6366f1'],

  // Tab bar specific
  tabBar: {
    background: '#0f0f14',
    active: '#a855f7',
    inactive: '#64748b',
    border: '#2a2a4a',
  },

  // Card styling
  card: {
    background: '#1e1e2f',
    border: '#3d3d5c',
    shadow: 'rgba(0, 0, 0, 0.4)',
  },
};

// Typography
export const Typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System',
    bold: 'System',
    mono: 'SpaceMono',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// Spacing scale
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
};

// Border radius
export const BorderRadius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
};

// Default export for backwards compatibility
export default {
  light: {
    text: Colors.textPrimary,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.tabBar.inactive,
    tabIconSelected: Colors.tabBar.active,
  },
  dark: {
    text: Colors.textPrimary,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.tabBar.inactive,
    tabIconSelected: Colors.tabBar.active,
  },
};
