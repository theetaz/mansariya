import React from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';

import {useTheme} from '../../hooks/useTheme';
import {blur, radii, shadows} from '../../constants/theme';

type GlassProps = {
  children?: React.ReactNode;
  radius?: number;
  /** expo-blur BlurView intensity (iOS) */
  intensity?: number;
  /** Disable the specular highlight sweep at the top. Default on. */
  specular?: boolean;
  /** Drop the elevation shadow. Use when the surface already sits in one. */
  noShadow?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Liquid-glass surface per design handoff §6.1.
 *
 * Stack (bottom → top):
 *   1. BlurView (expo-blur) — real blur on iOS; tinted rgba fallback on Android.
 *   2. Solid tint overlay — pulls the surface toward the theme's glassBg token.
 *   3. Specular highlight — top-aligned linear gradient, adds that iOS 26 shine.
 *   4. Inner hairline — 1px (StyleSheet.hairlineWidth) top border in glassEdge.
 *   5. Children.
 *
 * Use for every elevated surface: tab bar, sheets, HUD, cards, chips.
 */
export function Glass({
  children,
  radius = radii.xl,
  intensity = blur.glassIntensity,
  specular = true,
  noShadow = false,
  style,
}: GlassProps) {
  const {isDark, surface} = useTheme();

  return (
    <View
      style={[
        noShadow ? null : shadows.glass,
        {borderRadius: radius, overflow: 'hidden'},
        style,
      ]}>
      {/* Real blur on iOS. On Android expo-blur is unreliable on older versions,
          so we still render it but rely on the tint overlay for visual weight. */}
      <BlurView
        intensity={Platform.OS === 'ios' ? intensity : Math.min(intensity, 35)}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />

      {/* Tint overlay — the design's glassBg token, which already encodes
          an rgba with blur-friendly opacity. This also IS the Android
          fallback when BlurView can't do a real backdrop filter. */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: surface.glassBg},
        ]}
      />

      {/* Specular highlight — top-aligned gradient fading to transparent.
          Feels like the iOS 26 sheen on a control surface. */}
      {specular ? (
        <LinearGradient
          pointerEvents="none"
          colors={
            isDark
              ? ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']
              : ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']
          }
          start={{x: 0, y: 0}}
          end={{x: 0, y: 0.55}}
          style={[StyleSheet.absoluteFill, {height: '55%'}]}
        />
      ) : null}

      {/* Inner hairline at the top edge — the "glassEdge" stroke. */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: surface.glassEdge,
            borderRadius: radius,
          },
        ]}
      />

      {children}
    </View>
  );
}

export default Glass;
