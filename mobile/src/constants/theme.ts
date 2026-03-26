import {TextStyle} from 'react-native';

export const colors = {
  // Brand
  green: '#1D9E75',
  greenLight: '#E1F5EE',
  greenDark: '#0F6E56',

  // Secondary
  blue: '#378ADD',
  blueLight: '#E6F1FB',
  blueDark: '#185FA5',

  // Status
  amber: '#BA7517',
  amberLight: '#FAEEDA',
  amberDark: '#854F0B',
  red: '#E24B4A',

  // Neutral
  neutral900: '#1A1A1A',
  neutral700: '#374151',
  neutral500: '#6B7280',
  neutral300: '#D1D5DB',
  neutral200: '#E5E7EB',
  neutral100: '#F3F4F6',

  // Surfaces
  background: '#FFFFFF',
  surface: '#F9FAFB',

  // Confidence
  confidenceVerified: '#1D9E75',
  confidenceGood: '#1D9E75',
  confidenceApproximate: '#888780',
  confidenceStale: '#888780',
} as const;

export const typography: Record<string, TextStyle> = {
  routeNumberLarge: {fontSize: 32, fontWeight: '700', lineHeight: 32},
  routeNumberCard: {fontSize: 14, fontWeight: '600', lineHeight: 14},
  h1: {fontSize: 22, fontWeight: '500', lineHeight: 28.6},
  h2: {fontSize: 18, fontWeight: '500', lineHeight: 23.4},
  body: {fontSize: 15, fontWeight: '400', lineHeight: 22.5},
  bodySinhala: {fontSize: 16, fontWeight: '400', lineHeight: 25.6},
  caption: {fontSize: 12, fontWeight: '400', lineHeight: 16.8},
  small: {fontSize: 11, fontWeight: '400', lineHeight: 14.3},
  button: {fontSize: 16, fontWeight: '600', lineHeight: 20},
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

// Service type → badge color mapping
export const serviceTypeColors = {
  Normal: {bg: colors.greenLight, text: colors.greenDark},
  'Semi Luxury': {bg: colors.amberLight, text: colors.amberDark},
  'AC Luxury': {bg: colors.blueLight, text: colors.blueDark},
} as const;
