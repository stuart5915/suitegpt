import { Platform } from 'react-native';

export const Colors = {
  // === DREAM THEME - Surreal & Ethereal ===

  // Backgrounds (dark to light)
  void: '#0A0A12',           // Deepest dark - app background
  midnight: '#0F0F23',       // Primary dark background
  nebula: '#1A1A2E',         // Card backgrounds
  cosmic: '#16213E',         // Elevated surfaces

  // Primary accent - Ethereal Purple/Violet
  dreamPurple: '#8B5CF6',    // Primary interactive
  deepViolet: '#6D28D9',     // Pressed/active states
  lavender: '#A78BFA',       // Highlights/hover

  // Secondary accent - Cosmic Cyan
  cosmicCyan: '#22D3EE',     // Secondary accent
  electricBlue: '#06B6D4',   // Links/actions
  iceGlow: '#67E8F9',        // Glowing effects

  // Warm accent - Sunset/Dream warmth
  dreamOrange: '#F97316',    // Warm accent
  ember: '#FB923C',          // Recording active
  sunrise: '#FBBF24',        // Success/achievement

  // Text colors
  starlight: '#F8FAFC',      // Primary text
  mist: '#CBD5E1',           // Secondary text
  fog: '#64748B',            // Muted text
  shadow: '#334155',         // Disabled text

  // Semantic colors
  lucid: '#10B981',          // Success green
  nightmare: '#EF4444',      // Error/danger red
  prophetic: '#F59E0B',      // Warning amber

  // Legacy mappings (for gradual migration)
  cream: '#0F0F23',          // → midnight
  gold: '#8B5CF6',           // → dreamPurple
  darkGold: '#6D28D9',       // → deepViolet
  charcoal: '#F8FAFC',       // → starlight (inverted for dark mode)
  softBlack: '#0A0A12',      // → void
  white: '#F8FAFC',          // → starlight
  lightGray: '#1A1A2E',      // → nebula
  mediumGray: '#64748B',     // → fog
  darkGray: '#CBD5E1',       // → mist
  brown: '#8B5CF6',          // → dreamPurple
};

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
};

export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: Colors.charcoal,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.charcoal,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  xl: {
    shadowColor: Colors.charcoal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const FontFamilies = {
  sans: 'Inter',
  serif: 'Playfair Display',
  serifBold: 'Playfair Display Bold',
  serifItalic: 'Playfair Display Italic',
  sansMedium: 'Inter Medium',
  sansSemiBold: 'Inter SemiBold',
  sansBold: 'Inter Bold',
};
