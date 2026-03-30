import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const MAP_STYLE_URL =
  extra.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

// Colombo, Sri Lanka
export const DEFAULT_CENTER: [number, number] = [79.8612, 6.9271];
export const DEFAULT_ZOOM = 13;

// Sri Lanka bounds
export const SRI_LANKA_BOUNDS = {
  ne: [82.0, 10.0] as [number, number],
  sw: [79.5, 5.9] as [number, number],
};
