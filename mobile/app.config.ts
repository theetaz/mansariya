import type { ExpoConfig } from 'expo/config';

const baseConfig = require('./app.json').expo as ExpoConfig & {
  extra?: Record<string, unknown>;
};

function envValue(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

const baseExtra = (baseConfig.extra ?? {}) as Record<string, unknown>;

export default (): ExpoConfig => ({
  ...baseConfig,
  extra: {
    ...baseExtra,
    API_URL_IOS: envValue('API_URL_IOS', String(baseExtra.API_URL_IOS ?? 'http://localhost:9900')),
    API_URL_ANDROID: envValue('API_URL_ANDROID', String(baseExtra.API_URL_ANDROID ?? 'http://10.0.2.2:9900')),
    API_URL_PROD: envValue('API_URL_PROD', String(baseExtra.API_URL_PROD ?? 'https://mansariya-api.nipuntheekshana.com')),
    MAP_STYLE_URL: envValue('MAP_STYLE_URL', String(baseExtra.MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty')),
    eas: baseExtra.eas,
  },
});
