import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import * as RNLocalize from 'react-native-localize';

import en from './en.json';
import si from './si.json';
import ta from './ta.json';

const resources = {
  en: {translation: en},
  si: {translation: si},
  ta: {translation: ta},
};

// Detect device language, default to Sinhala
const bestLanguage =
  RNLocalize.findBestLanguageTag(Object.keys(resources))?.languageTag ?? 'si';

i18n.use(initReactI18next).init({
  resources,
  lng: bestLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
