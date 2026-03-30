import {useColorScheme} from 'react-native';
import {useSettingsStore, type ThemeMode} from '../stores/useSettingsStore';

export type ResolvedTheme = 'light' | 'dark';

const lightColors = {
  background: '#FFFFFF',
  surface: '#F9FAFB',
  card: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
  inputBg: '#F3F4F6',
  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  headerBg: '#FFFFFF',
} as const;

const darkColors = {
  background: '#0F0F0F',
  surface: '#1A1A1A',
  card: '#1F1F1F',
  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  border: '#2D2D2D',
  divider: '#252525',
  inputBg: '#252525',
  tabBar: '#141414',
  tabBarBorder: '#2D2D2D',
  headerBg: '#0F0F0F',
} as const;

export type ThemeColors = typeof lightColors;

export function useTheme() {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);

  const resolved: ResolvedTheme =
    themeMode === 'system'
      ? (systemScheme === 'dark' ? 'dark' : 'light')
      : themeMode;

  const isDark = resolved === 'dark';
  const themeColors = isDark ? darkColors : lightColors;

  return {
    isDark,
    resolved,
    themeMode,
    colors: themeColors,
  };
}
