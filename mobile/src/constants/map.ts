import Config from 'react-native-config';

export const MAP_STYLE_URL =
  Config.MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty';

// Colombo, Sri Lanka
export const DEFAULT_CENTER: [number, number] = [79.8612, 6.9271];
export const DEFAULT_ZOOM = 13;

// Sri Lanka bounds
export const SRI_LANKA_BOUNDS = {
  ne: [82.0, 10.0] as [number, number],
  sw: [79.5, 5.9] as [number, number],
};
