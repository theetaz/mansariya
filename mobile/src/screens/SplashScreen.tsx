import React, {useEffect} from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {colors} from '../constants/theme';

interface SplashScreenProps {
  onReady: () => void;
}

export default function SplashScreen({onReady}: SplashScreenProps) {
  useEffect(() => {
    // Behind the scenes: load cached tiles, connect WebSocket, check route updates
    // Don't artificially extend — transition as soon as ready
    const timer = setTimeout(onReady, 1500);
    return () => clearTimeout(timer);
  }, [onReady]);

  return (
    <View style={styles.container}>
      {/* Logo icon */}
      <View style={styles.logoContainer}>
        <Text style={styles.logoIcon}>🚌</Text>
      </View>

      {/* Wordmark */}
      <Text style={styles.wordmarkSinhala}>
        මංසැරිය
      </Text>
      <Text style={styles.wordmarkEnglish}>
        Mansariya
      </Text>

      {/* Loading spinner */}
      <ActivityIndicator
        style={styles.spinner}
        size="small"
        color={colors.green}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.greenLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoIcon: {
    fontSize: 40,
  },
  wordmarkSinhala: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.neutral900,
    marginBottom: 4,
  },
  wordmarkEnglish: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.neutral500,
  },
  spinner: {
    marginTop: 40,
  },
});
