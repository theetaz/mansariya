import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, radii} from '../../constants/theme';

interface ETABadgeProps {
  minutes: number;
  isLive?: boolean;
}

export default function ETABadge({minutes, isLive = true}: ETABadgeProps) {
  return (
    <View style={[styles.badge, isLive ? styles.live : styles.schedule]}>
      <Text
        style={[styles.text, isLive ? styles.liveText : styles.scheduleText]}
       >
        {minutes} min
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    height: 24,
    borderRadius: radii.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  live: {
    backgroundColor: colors.greenLight,
  },
  schedule: {
    backgroundColor: colors.neutral100,
  },
  text: {
    fontSize: 11,
    fontWeight: '500',
  },
  liveText: {
    color: colors.greenDark,
  },
  scheduleText: {
    color: colors.neutral500,
  },
});
