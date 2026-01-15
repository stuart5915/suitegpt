import { Platform } from 'react-native';

export const Colors = {
  cream: '#F5F2ED',
  gold: '#D4AF37',
  darkGold: '#B8941F',
  charcoal: '#2C2C2C',
  softBlack: '#1A1A1A',
  white: '#FFFFFF',
  lightGray: '#E8E5E1',
  mediumGray: '#9B9B9B',
  darkGray: '#4A4A4A',
  brown: '#A67C52',
  blue: '#3B82F6',
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
