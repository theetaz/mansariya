import {create} from 'zustand';

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

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'si',
  themeMode: 'system',
  trackingConsent: false,
  hasCompletedOnboarding: false,

  setLanguage: (language) => set({language}),
  setThemeMode: (themeMode) => set({themeMode}),
  setTrackingConsent: (trackingConsent) => set({trackingConsent}),
  completeOnboarding: () => set({hasCompletedOnboarding: true}),
}));
