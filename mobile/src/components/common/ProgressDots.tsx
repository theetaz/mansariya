import React from 'react';
import {View, StyleSheet} from 'react-native';
import {colors} from '../../constants/theme';

interface ProgressDotsProps {
  total: number;
  current: number;
}

export default function ProgressDots({total, current}: ProgressDotsProps) {
  return (
    <View style={styles.container}>
      {Array.from({length: total}).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current ? styles.active : styles.inactive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  active: {
    width: 24,
    backgroundColor: colors.green,
  },
  inactive: {
    width: 8,
    backgroundColor: colors.neutral300,
  },
});
