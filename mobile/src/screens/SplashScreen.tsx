import React, {useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {StatusBar} from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import {palette, radii, typography} from '../constants/theme';
import {useTheme} from '../hooks/useTheme';

type SplashScreenProps = {
  onReady: () => void;
};

/**
 * Splash — design handoff screen 01.
 *
 * Radial emerald backdrop, tilted emerald tile with the bus glyph, two
 * accent orbit dots (amber + road-blue), wordmark, trilingual tagline,
 * and a pulsing "Syncing routes…" indicator at the bottom.
 */
export default function SplashScreen({onReady}: SplashScreenProps) {
  const {isDark, surface} = useTheme();

  // Behaviour preserved from pre-redesign: advance after ~1.5s.
  useEffect(() => {
    const timer = setTimeout(onReady, 1500);
    return () => clearTimeout(timer);
  }, [onReady]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {duration: 1200, easing: Easing.inOut(Easing.ease)}),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.5,
    transform: [{scale: 1 + pulse.value * 0.3}],
  }));

  const bgInner = isDark ? '#164032' : palette.greenSoft;
  const bgOuter = isDark ? '#07110D' : '#F3F2EE';

  return (
    <View style={[styles.container, {backgroundColor: bgOuter}]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Radial-ish glow — RN has no true radial gradient, so we stack a
          centred linear gradient above a solid background. */}
      <LinearGradient
        colors={[bgInner, bgOuter]}
        start={{x: 0.5, y: 0.05}}
        end={{x: 0.5, y: 0.75}}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <View style={styles.logoStack}>
          <LinearGradient
            colors={[palette.green, palette.emerald]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 1}}
            style={styles.logoTile}
          />
          <View style={styles.logoInnerHighlight} pointerEvents="none" />
          <View style={styles.logoIcon}>
            <Ionicons name="bus" size={60} color="#FFFFFF" />
          </View>
          <View style={[styles.orbitDot, styles.orbitAmber]} />
          <View style={[styles.orbitDot, styles.orbitBlue]} />
        </View>

        <Text style={[styles.wordmark, {color: surface.text}]}>Mansariya</Text>
        <Text style={[styles.tagline, {color: surface.textDim}]}>
          මන්සාරිය · மன்சாரியா
        </Text>
      </View>

      <View style={styles.footer}>
        <Animated.View style={[styles.pulseDot, pulseStyle]} />
        <Text style={[styles.syncText, {color: surface.textDim}]}>
          Syncing routes…
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoStack: {
    width: 120,
    height: 120,
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTile: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    transform: [{rotate: '-4deg'}],
    shadowColor: palette.emerald,
    shadowOffset: {width: 0, height: 20},
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  logoInnerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
    transform: [{rotate: '-4deg'}],
  },
  logoIcon: {
    transform: [{rotate: '-4deg'}],
  },
  orbitDot: {
    position: 'absolute',
    borderRadius: radii.pill,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 10,
  },
  orbitAmber: {
    width: 14,
    height: 14,
    top: -6,
    right: -10,
    backgroundColor: palette.amber,
    shadowColor: palette.amber,
    shadowOpacity: 0.5,
  },
  orbitBlue: {
    width: 10,
    height: 10,
    bottom: 6,
    left: -14,
    backgroundColor: '#378ADD',
    shadowColor: '#378ADD',
    shadowOpacity: 0.5,
  },
  wordmark: {
    ...typography.display,
    fontSize: 44,
    letterSpacing: -1,
    fontWeight: '800',
  },
  tagline: {
    fontSize: 14,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.green,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
