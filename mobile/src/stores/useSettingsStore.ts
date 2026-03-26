import {create} from 'zustand';

type Language = 'en' | 'si' | 'ta';

interface SettingsState {
  language: Language;
  trackingConsent: boolean;
  hasCompletedOnboarding: boolean;

  setLanguage: (lang: Language) => void;
  setTrackingConsent: (consent: boolean) => void;
  completeOnboarding: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  language: 'si', // Default to Sinhala
  trackingConsent: false,
  hasCompletedOnboarding: false,

  setLanguage: (language) => set({language}),
  setTrackingConsent: (trackingConsent) => set({trackingConsent}),
  completeOnboarding: () => set({hasCompletedOnboarding: true}),
}));
