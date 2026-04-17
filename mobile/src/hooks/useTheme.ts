import {useColorScheme} from 'react-native';
import {useSettingsStore, type ThemeMode} from '../stores/useSettingsStore';
import {surfaces} from '../constants/theme';

export type ResolvedTheme = 'light' | 'dark';

// Theme colors mapped onto the new surface tokens, but keeping the legacy
// shape (background/card/text/etc.) so existing screens don't break.
function buildThemeColors(resolved: ResolvedTheme) {
  const s = surfaces[resolved];
  return {
    background: s.bg,
    surface: s.bgAlt,
    card: s.card,
    cardAlt: s.cardAlt,
    text: s.text,
    textSecondary: s.textDim,
    textTertiary: s.textSoft,
    border: s.hairline,
    divider: s.hairline,
    inputBg: s.bgAlt,
    tabBar: s.card,
    tabBarBorder: s.hairline,
    headerBg: s.bg,
    glassBg: s.glassBg,
    glassEdge: s.glassEdge,
  } as const;
}

export type ThemeColors = ReturnType<typeof buildThemeColors>;

export function useTheme() {
  const systemScheme = useColorScheme();
  const themeMode = useSettingsStore((s) => s.themeMode);

  const resolved: ResolvedTheme =
    themeMode === 'system'
      ? systemScheme === 'dark'
        ? 'dark'
        : 'light'
      : themeMode;

  const isDark = resolved === 'dark';

  return {
    isDark,
    resolved,
    themeMode,
    colors: buildThemeColors(resolved),
    surface: surfaces[resolved],
  };
}

export type {ThemeMode};
