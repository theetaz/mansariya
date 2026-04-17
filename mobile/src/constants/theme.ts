import type {TextStyle} from 'react-native';

// ── Brand palette ──────────────────────────────────────────────────────────
// Deep emerald primary, warm amber reserved for LIVE / contributor signals,
// coral for destructive / alerts. No red-orange warnings.
export const palette = {
  emerald: '#0F6E56', // primary dark — brand, primary CTA, filled pills
  green: '#1D9E75', // primary accent — pressed / focus / dots
  greenSoft: '#D7F0E5',

  amber: '#E89A3C', // reserved for LIVE / contribution signals
  amberSoft: '#FCE9CF',

  coral: '#E56A57', // destructive / service-alert / danger

  ink: '#0B1E18',
} as const;

// ── Surfaces (light + dark) ────────────────────────────────────────────────
export const surfaces = {
  light: {
    bg: '#F3F2EE', // warm cream — PAGE background, not pure white
    bgAlt: '#E9E7E0',
    card: '#FFFFFF',
    cardAlt: '#F7F5F0',
    text: '#1A1D1B',
    textDim: '#5C635E',
    textSoft: '#8A9089',
    hairline: 'rgba(10,20,15,0.08)',
    glassBg: 'rgba(255,255,255,0.58)',
    glassEdge: 'rgba(255,255,255,0.9)',
  },
  dark: {
    bg: '#07110D', // slightly green-tinted near-black
    bgAlt: '#0D1A15',
    card: '#14221C',
    cardAlt: '#1B2A24',
    text: '#ECF2EE',
    textDim: '#98A39D',
    textSoft: '#5F6A64',
    hairline: 'rgba(255,255,255,0.08)',
    glassBg: 'rgba(36,54,47,0.45)',
    glassEdge: 'rgba(255,255,255,0.14)',
  },
} as const;

// ── Back-compat colors ─────────────────────────────────────────────────────
// Keep the existing `colors.*` API stable so screens migrate incrementally.
// Values now resolve to the new palette.
export const colors = {
  green: palette.green,
  greenLight: palette.greenSoft,
  greenDark: palette.emerald,

  blue: '#378ADD',
  blueLight: '#E6F1FB',
  blueDark: '#185FA5',

  amber: palette.amber,
  amberLight: palette.amberSoft,
  amberDark: '#854F0B',
  red: palette.coral,

  neutral900: '#1A1D1B',
  neutral700: '#5C635E',
  neutral500: '#8A9089',
  neutral300: '#D1D5DB',
  neutral200: '#E5E7EB',
  neutral100: '#F3F4F6',

  background: surfaces.light.bg,
  surface: surfaces.light.card,

  confidenceVerified: palette.green,
  confidenceGood: palette.green,
  confidenceApproximate: palette.amber,
  confidenceStale: '#8A9089',
} as const;

// ── Spacing / radii ────────────────────────────────────────────────────────
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
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
  // Back-compat alias for pre-redesign screens that used `radii.full`.
  full: 999,
} as const;

// ── Typography ─────────────────────────────────────────────────────────────
export const typography: Record<string, TextStyle> = {
  display: {fontSize: 34, fontWeight: '700', lineHeight: 40, letterSpacing: -0.6},
  largeTitle: {fontSize: 28, fontWeight: '700', lineHeight: 34, letterSpacing: -0.4},
  title1: {fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3},
  title2: {fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2},
  body: {fontSize: 15, fontWeight: '400', lineHeight: 22},
  bodyStrong: {fontSize: 15, fontWeight: '600', lineHeight: 22},
  bodySinhala: {fontSize: 16, fontWeight: '400', lineHeight: 26},
  caption: {fontSize: 12, fontWeight: '500', lineHeight: 16},
  eyebrow: {fontSize: 11, fontWeight: '700', lineHeight: 14, letterSpacing: 1.2},
  button: {fontSize: 16, fontWeight: '600', lineHeight: 20},
  routeNumberLarge: {fontSize: 24, fontWeight: '700', lineHeight: 24, letterSpacing: 0.3},
  routeNumberCard: {fontSize: 14, fontWeight: '700', lineHeight: 14, letterSpacing: 0.3},

  // Back-compat aliases for existing screens (h1/h2/small).
  h1: {fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.3},
  h2: {fontSize: 18, fontWeight: '600', lineHeight: 24, letterSpacing: -0.2},
  small: {fontSize: 11, fontWeight: '400', lineHeight: 14.3},
};

// ── Blur intensities (expo-blur) ───────────────────────────────────────────
export const blur = {
  glassIntensity: 60,
  glassSheetIntensity: 80,
  glassStrongIntensity: 95,
} as const;

// ── Shadows / elevation ────────────────────────────────────────────────────
export const shadows = {
  glass: {
    shadowColor: '#14281F',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 8,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

// ── Service-type → badge colors (new palette) ──────────────────────────────
export const serviceTypeColors = {
  Normal: {bg: palette.greenSoft, text: palette.emerald},
  'Semi Luxury': {bg: palette.amberSoft, text: '#854F0B'},
  'AC Luxury': {bg: '#E6F1FB', text: '#185FA5'},
} as const;

export type ServiceType = keyof typeof serviceTypeColors;
