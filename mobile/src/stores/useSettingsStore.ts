import {create} from 'zustand';
import {persist, createJSONStorage} from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'en' | 'si' | 'ta';
export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  language: Language;
  themeMode: ThemeMode;
  trackingConsent: boolean;
  hasCompletedOnboarding: boolean;

  setLanguage: (lang: Language) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setTrackingConsent: (consent: boolean) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'si',
      themeMode: 'system',
      trackingConsent: false,
      hasCompletedOnboarding: false,

      setLanguage: (language) => set({language}),
      setThemeMode: (themeMode) => set({themeMode}),
      setTrackingConsent: (trackingConsent) => set({trackingConsent}),
      completeOnboarding: () => set({hasCompletedOnboarding: true}),
    }),
    {
      name: 'mansariya-settings',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
