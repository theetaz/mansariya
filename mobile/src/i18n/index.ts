import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getLocales} from 'expo-localization';

import en from './en.json';
import si from './si.json';
import ta from './ta.json';

const resources = {
  en: {translation: en},
  si: {translation: si},
  ta: {translation: ta},
};

// Detect device language, default to Sinhala
const deviceLocale = getLocales()[0]?.languageCode ?? 'si';
const bestLanguage = deviceLocale in resources ? deviceLocale : 'si';

i18n.use(initReactI18next).init({
  resources,
  lng: bestLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
